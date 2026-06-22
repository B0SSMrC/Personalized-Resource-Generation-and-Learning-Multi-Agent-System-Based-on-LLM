import asyncio
from typing import AsyncIterator

from app.agents.planner import PlannerAgent
from app.agents.profiler import ProfilerAgent
from app.agents.quizzer import QuizzerAgent
from app.agents.tutor import TutorAgent
from app.agents.visualizer import VisualizerAgent
from app.llm.base import LLMClient
from app.models import AgentEvent


class Coordinator:
    def __init__(self, llm: LLMClient, repo):
        self.repo = repo
        self.profiler = ProfilerAgent(llm, repo)
        self.planner = PlannerAgent(llm, repo)
        self.tutor = TutorAgent(llm, repo)
        self.visualizer = VisualizerAgent(llm, repo)
        self.quizzer = QuizzerAgent(llm, repo)

    async def chat(self, message: str) -> AsyncIterator[AgentEvent]:
        async for ev in self.profiler.run(message, self.repo.get_profile()):
            yield ev

    async def plan(self) -> AsyncIterator[AgentEvent]:
        async for ev in self.planner.run(self.repo.get_profile()):
            yield ev

    async def generate_resources(self, kp_id: str) -> AsyncIterator[AgentEvent]:
        profile = self.repo.get_profile()
        agents = [self.tutor, self.visualizer, self.quizzer]
        queue: asyncio.Queue = asyncio.Queue()

        async def pump(agent):
            try:
                async for ev in agent.run(kp_id, profile):
                    await queue.put(ev)
            finally:
                await queue.put(None)  # 结束哨兵

        tasks = [asyncio.create_task(pump(a)) for a in agents]
        finished = 0
        while finished < len(agents):
            ev = await queue.get()
            if ev is None:
                finished += 1
                continue
            yield ev
        await asyncio.gather(*tasks)
