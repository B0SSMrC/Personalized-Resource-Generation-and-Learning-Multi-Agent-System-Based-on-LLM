import random
from typing import AsyncIterator

from app.agents.base import BaseAgent
from app.data import repository
from app.models import AgentEvent, Profile, VizSpec

_TYPE_DESC = {
    "sorting": "用条形高度变化动画演示排序过程",
    "tree": "用树形结构动画演示节点与遍历",
    "graph": "用图遍历动画演示 BFS/DFS",
    "linear": "用线性格子动画演示访问/插入",
}


def _gen_fib(k: int) -> list[int]:
    a, b = random.choice([(1, 1), (1, 2), (2, 3), (1, 3)])
    seq = [a, b]
    while len(seq) < k:
        seq.append(seq[-1] + seq[-2])
    return seq[:k]


def _gen_factorial(k: int) -> list[int]:
    seq, f = [], 1
    for i in range(1, k + 1):
        f *= i
        seq.append(f)
    return seq


def _randomize_viz(viz: VizSpec) -> dict:
    """保留语义字段(type/op/structure/algorithm/gen)，每次随机生成新的示例数据，
    确保动画每次都不同、但仍贴合该知识点。"""
    t = viz.type
    p = dict(viz.params)

    if t == "sorting":
        p["values"] = random.sample(range(2, 24), random.randint(6, 8))
    elif t == "tree":
        p["nodes"] = random.sample(range(1, 21), random.randint(6, 8))
    elif t == "graph":
        labels = ["A", "B", "C", "D", "E", "F"]
        k = random.randint(5, 6)
        nodes = labels[:k]
        edges: list[list[str]] = []
        for i in range(1, k):  # 先连成一棵生成树，保证连通
            j = random.randint(0, i - 1)
            edges.append([nodes[j], nodes[i]])
        for _ in range(random.randint(1, 2)):  # 再随机加几条边
            a, b = sorted(random.sample(range(k), 2))
            e = [nodes[a], nodes[b]]
            if e not in edges:
                edges.append(e)
        p.update(nodes=nodes, edges=edges, start=random.choice(nodes))
        p.setdefault("mode", "bfs")
    elif t == "linear":
        gen = p.get("gen")
        op = p.get("op", "scan")
        if gen == "fib":
            k = random.randint(6, 8)
            p["values"], p["index"] = _gen_fib(k), k - 1
        elif gen == "factorial":
            k = random.randint(5, 6)
            p["values"], p["index"] = _gen_factorial(k), k - 1
        elif op == "binary_search":
            k = random.randint(5, 7)
            p["values"] = sorted(random.sample(range(1, 30), k))
            p["index"] = random.randint(0, k - 1)
        elif op in ("push", "enqueue"):
            k = random.randint(4, 6)
            p["values"], p["index"] = [random.randint(1, 20) for _ in range(k)], k - 1
        else:  # access / traverse
            k = random.randint(5, 7)
            p["values"] = [random.randint(1, 20) for _ in range(k)]
            p["index"] = random.randint(0, k - 1)

    return {"type": t, "params": p}


class VisualizerAgent(BaseAgent):
    name = "visualizer"

    async def run(self, kp_id: str, profile: Profile) -> AsyncIterator[AgentEvent]:
        yield self.start()
        bundle = repository.get_resource(kp_id)
        if bundle is None:
            yield self.error(f"无知识点资源：{kp_id}")
            yield self.done({"viz": {"type": "linear", "params": {}}})
            return
        viz = _randomize_viz(bundle.viz)
        yield self.token(
            f"已选定可视化：{_TYPE_DESC.get(viz['type'], viz['type'])}（本次随机生成示例数据）。"
        )
        yield self.done({"viz": viz})
