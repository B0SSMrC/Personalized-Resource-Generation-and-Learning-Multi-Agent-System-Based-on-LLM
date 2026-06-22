from typing import AsyncIterator

from app.llm.base import LLMClient


class SparkClient(LLMClient):
    """讯飞星火接入位。上台前在此实现星火 HTTP/WS 协议。"""

    def __init__(self, *args, **kwargs):
        pass

    async def chat(self, messages: list[dict], **kw) -> str:
        raise NotImplementedError("SparkClient 待接入星火 API")

    async def stream(self, messages: list[dict], **kw) -> AsyncIterator[str]:
        raise NotImplementedError("SparkClient 待接入星火 API")
        yield  # pragma: no cover
