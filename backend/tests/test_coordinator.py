from app.agents.coordinator import Coordinator
from app.data.repository import InMemoryProfileRepo
from app.llm.fake import FakeLLMClient


async def _collect(gen):
    return [ev async for ev in gen]


def _coord():
    return Coordinator(FakeLLMClient(), InMemoryProfileRepo())


async def test_generate_resources_runs_three_agents_in_parallel():
    events = await _collect(_coord().generate_resources("array"))
    done_agents = {e.agent for e in events if e.type == "agent_done"}
    assert done_agents == {"tutor", "visualizer", "quizzer"}
    start_agents = {e.agent for e in events if e.type == "agent_start"}
    assert start_agents == {"tutor", "visualizer", "quizzer"}


async def test_chat_runs_profiler_and_persists():
    repo = InMemoryProfileRepo()
    coord = Coordinator(FakeLLMClient(canned={"画像": '{"mastered":["array"]}'}), repo)
    events = await _collect(coord.chat("我学过数组"))
    assert events[-1].agent == "profiler"
    assert "array" in repo.get_profile().mastered


async def test_plan_returns_path():
    repo = InMemoryProfileRepo()
    repo.save_profile(repo.get_profile())  # 默认空画像
    events = await _collect(Coordinator(FakeLLMClient(), repo).plan())
    assert events[-1].agent == "planner"
    assert isinstance(events[-1].data["path"], list)
