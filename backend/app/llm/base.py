from abc import ABC, abstractmethod
from typing import AsyncIterator


class LLMClient(ABC):
    @abstractmethod
    async def chat(self, messages: list[dict], **kw) -> str:
        ...

    @abstractmethod
    async def stream(self, messages: list[dict], **kw) -> AsyncIterator[str]:
        ...
        yield  # pragma: no cover  (标记为异步生成器)
