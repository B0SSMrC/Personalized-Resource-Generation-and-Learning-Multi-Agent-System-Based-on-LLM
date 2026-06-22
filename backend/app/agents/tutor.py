from typing import AsyncIterator

from app.agents.base import BaseAgent
from app.data import repository
from app.models import AgentEvent, Profile

_SYSTEM = ("你是讲解Agent。请基于给定讲解素材，结合学生画像，"
           "用 Markdown（可含 LaTeX 公式）输出更贴合该学生的讲解。"
           "直接输出 Markdown 正文，不要把整段回答用 ``` 代码围栏包裹。")


def _unwrap_fence(text: str) -> str:
    """剥掉模型把整段回答用 ```markdown ... ``` 围栏包裹的外层，
    否则前端会把整块讲解当作代码块渲染（弱模型常见行为）。"""
    t = text.strip()
    if not t.startswith("```"):
        return text
    lines = t.splitlines()
    lines = lines[1:]  # 去掉开头的 ``` / ```markdown / ```md 行
    if lines and lines[-1].strip() == "```":
        lines = lines[:-1]  # 去掉结尾的 ``` 行
    return "\n".join(lines).strip()


class TutorAgent(BaseAgent):
    name = "tutor"

    async def run(self, kp_id: str, profile: Profile) -> AsyncIterator[AgentEvent]:
        yield self.start()
        bundle = repository.get_resource(kp_id)
        if bundle is None:
            yield self.error(f"无知识点资源：{kp_id}")
            yield self.done({"explanation_md": ""})
            return
        base_md = bundle.explanation_md
        acc = ""
        try:
            async for tok in self.llm.stream([
                {"role": "system", "content": _SYSTEM},
                {"role": "user", "content":
                    f"素材：\n{base_md}\n学生偏好：{profile.preference or '无'}"},
            ]):
                acc += tok
                yield self.token(tok)
        except Exception:  # noqa: BLE001  回退预烘
            acc = ""
        final_md = _unwrap_fence(acc.strip()) or base_md
        if not acc.strip():
            yield self.token(base_md)
        yield self.done({"explanation_md": final_md})
