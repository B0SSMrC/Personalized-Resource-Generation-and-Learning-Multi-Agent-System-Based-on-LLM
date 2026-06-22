import json
from typing import AsyncIterator

from app.agents.base import BaseAgent
from app.data import repository
from app.models import AgentEvent, KnowledgePoint, Profile

_SYSTEM_TMPL = (
    "你是学习画像Agent。请阅读学生的话，抽取并仅输出一个 JSON 对象，"
    "字段可含 mastered(list)、weak_points(list)、goal(str)、preference(str)、pace(str)。"
    "mastered 与 weak_points 中的知识点，必须从下列名称中原样选取，不要自创：\n{catalog}\n"
    "不要输出 JSON 以外的任何内容。"
)


def _to_ids(items, points: dict[str, KnowledgePoint]) -> list[str]:
    """把 LLM 抽取的概念（多为中文名，偶尔已是 id）规范化为知识点 id；
    匹配不上的（如模型瞎编的“全部内容”）直接丢弃——避免污染画像、破坏路径计算。"""
    if not isinstance(items, list):
        return []
    name_to_id = {p.name: pid for pid, p in points.items()}
    ids: list[str] = []
    for it in items:
        if not isinstance(it, str):
            continue
        key = it.strip()
        if key in points:           # 已是 id
            ids.append(key)
        elif key in name_to_id:     # 是中文名
            ids.append(name_to_id[key])
    return ids


def _safe_json(text: str) -> dict:
    try:
        start, end = text.find("{"), text.rfind("}")
        if start >= 0 and end > start:
            return json.loads(text[start:end + 1])
    except json.JSONDecodeError:
        pass
    return {}


def _merge(profile: Profile, inc: dict, points: dict[str, KnowledgePoint]) -> Profile:
    data = profile.model_dump()
    inc_mastered = set(_to_ids(inc.get("mastered"), points))
    inc_weak = set(_to_ids(inc.get("weak_points"), points))
    # 既有值也归一（清洗历史中文名/垃圾）
    mastered = set(_to_ids(data["mastered"], points))
    weak = set(_to_ids(data["weak_points"], points))
    # 新信号优先 + 互斥：刚说“薄弱”的从已掌握移除，刚说“已掌握”的从薄弱移除，
    # 同一知识点不可同时出现在两列。
    mastered = (mastered | inc_mastered) - inc_weak
    weak = (weak | inc_weak) - inc_mastered
    # 兜底：清除历史遗留的交叠（无新信号时保守归为薄弱，宁可重学也不误判已掌握）。
    mastered -= weak
    data["mastered"] = sorted(mastered)
    data["weak_points"] = sorted(weak)
    for k in ("goal", "preference", "pace"):
        if inc.get(k):
            data[k] = inc[k]
    return Profile(**data)


class ProfilerAgent(BaseAgent):
    name = "profiler"

    async def run(self, message: str, profile: Profile) -> AsyncIterator[AgentEvent]:
        yield self.start()
        points, _ = repository.load_graph()
        catalog = "、".join(p.name for p in points.values())
        try:
            raw = await self.llm.chat([
                {"role": "system", "content": _SYSTEM_TMPL.format(catalog=catalog)},
                {"role": "user", "content": message},
            ])
            inc = _safe_json(raw)
        except Exception as e:  # noqa: BLE001  LLM 失败不阻断
            inc = {}
            yield self.token(f"（画像抽取降级：{e}）")
        new_profile = _merge(profile, inc, points)
        if self.repo:
            self.repo.save_profile(new_profile)
        yield self.token("已更新你的学习画像。")
        yield self.done({"profile": new_profile.model_dump(), "increment": inc})
