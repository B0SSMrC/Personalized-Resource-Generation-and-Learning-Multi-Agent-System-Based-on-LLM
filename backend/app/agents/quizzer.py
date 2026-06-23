import json
from typing import AsyncIterator

from app.agents.base import BaseAgent
from app.data import repository
from app.models import AgentEvent, Profile

_SYSTEM = (
    "你是出题 Agent。根据给定知识点素材，生成 3 道练习题，紧扣该知识点、难度适中。"
    "仅输出一个 JSON 数组，每个元素形如 "
    '{"stem": "题干", "answer": "答案", "difficulty": 1到5的整数}。'
    "不要输出 JSON 以外的任何内容。"
)


def _safe_questions(text: str):
    """从 LLM 文本中解析题目 JSON 数组；非法/空/缺 stem 则返回 None。"""
    try:
        start, end = text.find("["), text.rfind("]")
        if start < 0 or end <= start:
            return None
        data = json.loads(text[start:end + 1])
    except (json.JSONDecodeError, ValueError):
        return None
    if not isinstance(data, list):
        return None
    out = []
    for item in data:
        if not isinstance(item, dict) or not str(item.get("stem", "")).strip():
            continue
        try:
            diff = int(item.get("difficulty", 1))
        except (TypeError, ValueError):
            diff = 1
        out.append({
            "stem": str(item["stem"]).strip(),
            "answer": str(item.get("answer", "")).strip(),
            "difficulty": diff,
        })
    return out or None


class QuizzerAgent(BaseAgent):
    name = "quizzer"

    async def run(self, kp_id: str, profile: Profile) -> AsyncIterator[AgentEvent]:
        yield self.start()
        bundle = repository.get_resource(kp_id)
        if bundle is None:
            yield self.error(f"无知识点资源：{kp_id}")
            yield self.done({"questions": []})
            return
        prebaked = [q.model_dump() for q in bundle.question_templates]
        questions = None
        try:
            raw = await self.llm.chat([
                {"role": "system", "content": _SYSTEM},
                {"role": "user", "content": f"知识点素材：\n{bundle.explanation_md}"},
            ])
            questions = _safe_questions(raw)
        except Exception:  # noqa: BLE001  回退预烘
            questions = None
        questions = questions or prebaked
        yield self.token(f"已为你出 {len(questions)} 道练习题。")
        yield self.done({"questions": questions})
