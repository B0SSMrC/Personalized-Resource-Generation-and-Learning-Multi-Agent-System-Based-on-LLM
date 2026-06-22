from typing import AsyncIterator

from app.agents.base import BaseAgent
from app.data import repository
from app.models import AgentEvent, Profile


class QuizzerAgent(BaseAgent):
    name = "quizzer"

    async def run(self, kp_id: str, profile: Profile) -> AsyncIterator[AgentEvent]:
        yield self.start()
        bundle = repository.get_resource(kp_id)
        if bundle is None:
            yield self.error(f"无知识点资源：{kp_id}")
            yield self.done({"questions": []})
            return
        questions = [q.model_dump() for q in bundle.question_templates]
        yield self.token(f"已为你准备 {len(questions)} 道练习题。")
        yield self.done({"questions": questions})
