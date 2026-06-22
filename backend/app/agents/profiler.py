import json
from typing import AsyncIterator

from app.agents.base import BaseAgent
from app.models import AgentEvent, Profile

_SYSTEM = (
    "你是学习画像Agent。请阅读学生的话，抽取并仅输出一个 JSON 对象，"
    "字段可含 mastered(list)、weak_points(list)、goal(str)、preference(str)、pace(str)。"
    "不要输出 JSON 以外的任何内容。"
)


def _safe_json(text: str) -> dict:
    try:
        start, end = text.find("{"), text.rfind("}")
        if start >= 0 and end > start:
            return json.loads(text[start:end + 1])
    except json.JSONDecodeError:
        pass
    return {}


def _merge(profile: Profile, inc: dict) -> Profile:
    data = profile.model_dump()
    for k in ("mastered", "weak_points"):
        if isinstance(inc.get(k), list):
            data[k] = sorted(set(data[k]) | set(inc[k]))
    for k in ("goal", "preference", "pace"):
        if inc.get(k):
            data[k] = inc[k]
    return Profile(**data)


class ProfilerAgent(BaseAgent):
    name = "profiler"

    async def run(self, message: str, profile: Profile) -> AsyncIterator[AgentEvent]:
        yield self.start()
        try:
            raw = await self.llm.chat([
                {"role": "system", "content": _SYSTEM},
                {"role": "user", "content": message},
            ])
            inc = _safe_json(raw)
        except Exception as e:  # noqa: BLE001  LLM 失败不阻断
            inc = {}
            yield self.token(f"（画像抽取降级：{e}）")
        new_profile = _merge(profile, inc)
        if self.repo:
            self.repo.save_profile(new_profile)
        yield self.token("已更新你的学习画像。")
        yield self.done({"profile": new_profile.model_dump(), "increment": inc})
