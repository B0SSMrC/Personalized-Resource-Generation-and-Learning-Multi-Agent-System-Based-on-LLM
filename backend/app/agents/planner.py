from typing import AsyncIterator

from app.agents.base import BaseAgent
from app.data import repository
from app.models import AgentEvent, Profile

_SYSTEM = "你是学习路径规划Agent。请用一两句话向学生解释推荐学习顺序的理由。"


class PlannerAgent(BaseAgent):
    name = "planner"

    async def run(self, profile: Profile) -> AsyncIterator[AgentEvent]:
        yield self.start()
        points, _ = repository.load_graph()
        path = repository.compute_path(
            points, set(profile.mastered), set(profile.weak_points))
        names = [points[p].name for p in path if p in points]
        try:
            rationale = await self.llm.chat([
                {"role": "system", "content": _SYSTEM},
                {"role": "user", "content":
                    f"画像：{profile.model_dump()}；推荐顺序：{names}"},
            ])
        except Exception:  # noqa: BLE001  回退固定说明
            rationale = "已按先修关系排序，并优先安排你的薄弱点。"
        yield self.token(rationale)
        yield self.done({"path": path, "rationale": rationale})
