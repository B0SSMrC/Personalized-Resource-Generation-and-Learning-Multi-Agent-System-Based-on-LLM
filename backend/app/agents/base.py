from app.llm.base import LLMClient
from app.models import AgentEvent


class BaseAgent:
    name: str = "agent"

    def __init__(self, llm: LLMClient, repo=None):
        self.llm = llm
        self.repo = repo

    def start(self) -> AgentEvent:
        return AgentEvent(agent=self.name, type="agent_start")

    def token(self, text: str) -> AgentEvent:
        return AgentEvent(agent=self.name, type="token", content=text)

    def done(self, data: dict) -> AgentEvent:
        return AgentEvent(agent=self.name, type="agent_done", data=data)

    def error(self, msg: str) -> AgentEvent:
        return AgentEvent(agent=self.name, type="agent_error", content=msg)
