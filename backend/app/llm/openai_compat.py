import json
from typing import AsyncIterator

import httpx

from app.llm.base import LLMClient


class OpenAICompatClient(LLMClient):
    def __init__(self, base_url: str, api_key: str, model: str):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.model = model

    @property
    def _headers(self) -> dict:
        return {"Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"}

    async def chat(self, messages: list[dict], **kw) -> str:
        payload = {"model": self.model, "messages": messages, **kw}
        async with httpx.AsyncClient(timeout=60) as c:
            r = await c.post(f"{self.base_url}/chat/completions",
                             headers=self._headers, json=payload)
            r.raise_for_status()
            return r.json()["choices"][0]["message"]["content"]

    async def stream(self, messages: list[dict], **kw) -> AsyncIterator[str]:
        payload = {"model": self.model, "messages": messages, "stream": True, **kw}
        async with httpx.AsyncClient(timeout=60) as c:
            async with c.stream("POST", f"{self.base_url}/chat/completions",
                                headers=self._headers, json=payload) as r:
                r.raise_for_status()
                async for line in r.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    data = line[5:].strip()
                    if data == "[DONE]":
                        break
                    try:
                        delta = json.loads(data)["choices"][0]["delta"].get("content", "")
                    except (json.JSONDecodeError, KeyError, IndexError):
                        delta = ""
                    if delta:
                        yield delta
