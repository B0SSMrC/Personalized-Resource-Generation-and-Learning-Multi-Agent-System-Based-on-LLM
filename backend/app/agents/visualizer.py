from typing import AsyncIterator

from app.agents.base import BaseAgent
from app.data import repository
from app.models import AgentEvent, Profile

_TYPE_DESC = {
    "sorting": "用条形高度变化动画演示排序过程",
    "tree": "用树形结构动画演示节点与遍历",
    "graph": "用图遍历动画演示 BFS/DFS",
    "linear": "用线性格子动画演示访问/插入",
}


class VisualizerAgent(BaseAgent):
    name = "visualizer"

    async def run(self, kp_id: str, profile: Profile) -> AsyncIterator[AgentEvent]:
        yield self.start()
        bundle = repository.get_resource(kp_id)
        if bundle is None:
            yield self.error(f"无知识点资源：{kp_id}")
            yield self.done({"viz": {"type": "linear", "params": {}}})
            return
        viz = bundle.viz
        yield self.token(f"已选定可视化：{_TYPE_DESC.get(viz.type, viz.type)}。")
        yield self.done({"viz": {"type": viz.type, "params": viz.params}})
