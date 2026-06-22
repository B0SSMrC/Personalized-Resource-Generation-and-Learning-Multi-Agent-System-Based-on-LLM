from typing import AsyncIterator

from app.llm.base import LLMClient

DEFAULT_CANNED = {
    "画像": '{"mastered": ["array"], "weak_points": ["dynamic_programming"], "goal": "准备期末考", "preference": "喜欢看动画", "pace": "medium"}',
    "规划": "根据你的画像，建议先巩固薄弱点，再循序渐进推进。",
    "讲解": "（演示）这是该知识点的个性化讲解。",
    "出题": "（演示）请说明该结构的时间复杂度。",
}


class FakeLLMClient(LLMClient):
    """离线/测试用：优先返回注入的 responses，否则按关键词匹配 canned。"""

    def __init__(self, responses: list[str] | None = None,
                 canned: dict | None = None):
        self._responses = list(responses or [])
        self._canned = canned or DEFAULT_CANNED

    def _match(self, messages: list[dict]) -> str:
        text = " ".join(m.get("content", "") for m in messages)
        for kw, resp in self._canned.items():
            if kw in text:
                return resp
        return "（演示）"

    async def chat(self, messages: list[dict], **kw) -> str:
        if self._responses:
            return self._responses.pop(0)
        return self._match(messages)

    async def stream(self, messages: list[dict], **kw) -> AsyncIterator[str]:
        text = await self.chat(messages, **kw)
        for piece in text.split(" "):
            yield piece + " "
