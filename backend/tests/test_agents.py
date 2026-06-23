import json

from app.agents.base import BaseAgent
from app.agents.profiler import ProfilerAgent
from app.agents.planner import PlannerAgent
from app.agents.tutor import TutorAgent
from app.agents.visualizer import VisualizerAgent
from app.agents.quizzer import QuizzerAgent
from app.llm.fake import FakeLLMClient
from app.models import Profile


class _Dummy(BaseAgent):
    name = "dummy"


async def _collect(gen):
    return [ev async for ev in gen]


# ---------- Task 7: 基类 ----------

def test_event_helpers_carry_name():
    a = _Dummy(FakeLLMClient())
    assert a.start().type == "agent_start"
    assert a.start().agent == "dummy"
    assert a.token("x").content == "x"
    assert a.done({"k": 1}).data == {"k": 1}
    assert a.error("oops").type == "agent_error"


# ---------- Task 8: 画像 + 规划 ----------

async def test_profiler_merges_increment_into_profile():
    inc = {"mastered": ["array"], "goal": "期末复习"}
    llm = FakeLLMClient(responses=[json.dumps(inc)])
    agent = ProfilerAgent(llm)
    events = await _collect(agent.run("我学过数组，想准备期末", Profile()))
    assert events[0].type == "agent_start"
    done = events[-1]
    assert done.type == "agent_done"
    assert "array" in done.data["profile"]["mastered"]
    assert done.data["profile"]["goal"] == "期末复习"


async def test_profiler_tolerates_bad_json():
    llm = FakeLLMClient(responses=["这不是JSON"])
    agent = ProfilerAgent(llm)
    events = await _collect(agent.run("hi", Profile(mastered=["array"])))
    # 非法 JSON 时保留原画像
    assert events[-1].data["profile"]["mastered"] == ["array"]


async def test_planner_returns_valid_path():
    llm = FakeLLMClient(responses=["先打基础再进阶"])
    agent = PlannerAgent(llm)
    events = await _collect(agent.run(Profile(mastered=["array"], weak_points=["sorting"])))
    done = events[-1]
    assert done.type == "agent_done"
    path = done.data["path"]
    assert "array" not in path  # 已掌握排除
    assert path.index("sorting") < path.index("linked_list")  # 薄弱优先
    assert done.data["rationale"]


# ---------- Task 9: 资源生成三 Agent ----------

async def test_tutor_streams_and_returns_explanation():
    llm = FakeLLMClient(responses=["数组讲解内容"])
    events = await _collect(TutorAgent(llm).run("array", Profile()))
    assert any(e.type == "token" for e in events)
    assert events[-1].type == "agent_done"
    assert events[-1].data["explanation_md"]


async def test_tutor_strips_closing_pleasantry():
    """弱模型爱在结尾加“希望以上讲解能帮助你…”客套，应被确定性剥掉。"""
    md = "## 概念\n数组是连续内存。\n\n## 复杂度\n- 访问 O(1)\n\n希望以上讲解能帮助你理解数组。"
    events = await _collect(TutorAgent(FakeLLMClient(responses=[md])).run("array", Profile()))
    out = events[-1].data["explanation_md"]
    assert "希望以上讲解" not in out
    assert "## 概念" in out and "访问 O(1)" in out


async def test_tutor_keeps_real_trailing_section():
    """不得误删正常的结尾小节（标题/列表结尾）。"""
    md = "## 概念\n数组连续内存。\n\n## 典型应用\n- 排序算法"
    events = await _collect(TutorAgent(FakeLLMClient(responses=[md])).run("array", Profile()))
    out = events[-1].data["explanation_md"]
    assert "## 典型应用" in out and "排序算法" in out


async def test_tutor_falls_back_when_output_is_unstructured_wall():
    """LLM 退化成无标题无列表的纯文本墙时，回退到（有结构的）预烘素材。"""
    wall = "队列是一种先进先出的数据结构。它在很多场景都有用。它的操作效率很高。"
    events = await _collect(TutorAgent(FakeLLMClient(responses=[wall])).run("queue", Profile()))
    out = events[-1].data["explanation_md"]
    assert "##" in out  # 回退到含 ## 标题的预烘 queue.json
    assert wall not in out


async def test_tutor_falls_back_to_prebaked_on_llm_failure():
    class Boom(FakeLLMClient):
        async def stream(self, messages, **kw):
            raise RuntimeError("network down")
            yield  # pragma: no cover
    events = await _collect(TutorAgent(Boom()).run("array", Profile()))
    # 回退到预烘 explanation_md（含“数组”）
    assert "数组" in events[-1].data["explanation_md"]


async def test_visualizer_returns_viz_spec():
    events = await _collect(VisualizerAgent(FakeLLMClient()).run("sorting", Profile()))
    assert events[-1].data["viz"]["type"] == "sorting"


async def test_quizzer_returns_questions():
    events = await _collect(QuizzerAgent(FakeLLMClient()).run("array", Profile()))
    qs = events[-1].data["questions"]
    assert len(qs) >= 1 and "stem" in qs[0]


async def test_agents_handle_missing_resource():
    for AgentCls in (TutorAgent, VisualizerAgent, QuizzerAgent):
        events = await _collect(AgentCls(FakeLLMClient()).run("nope", Profile()))
        assert events[-1].type == "agent_done"


async def test_tutor_strips_whole_markdown_code_fence():
    """弱模型常把整段回答用 ```markdown ... ``` 包裹，导致前端整块当代码渲染。
    讲解 Agent 应剥掉外层围栏，输出可正常渲染的 Markdown。"""
    fenced = "```markdown\n# 二叉树\n正文**重点**\n```"
    events = await _collect(
        TutorAgent(FakeLLMClient(responses=[fenced])).run("binary_tree", Profile())
    )
    md = events[-1].data["explanation_md"]
    assert md.startswith("# 二叉树")
    assert "```" not in md


async def test_profiler_normalizes_concept_names_to_ids():
    """真模型常返回知识点中文名（数组/链表/动态规划），画像须归一成图谱 id，
    否则 compute_path 的已掌握排除/薄弱优先全部失效。"""
    inc = {"mastered": ["数组", "链表"], "weak_points": ["动态规划"]}
    llm = FakeLLMClient(responses=[json.dumps(inc, ensure_ascii=False)])
    events = await _collect(ProfilerAgent(llm).run("我学过数组链表，动规弱", Profile()))
    prof = events[-1].data["profile"]
    assert "array" in prof["mastered"] and "linked_list" in prof["mastered"]
    assert "数组" not in prof["mastered"]
    assert prof["weak_points"] == ["dynamic_programming"]


async def test_profiler_drops_unknown_concepts():
    """LLM 瞎编的概念（如“全部内容”）匹配不上任何知识点，应丢弃而非污染画像。"""
    inc = {"mastered": ["全部内容", "数组"]}
    llm = FakeLLMClient(responses=[json.dumps(inc, ensure_ascii=False)])
    events = await _collect(ProfilerAgent(llm).run("x", Profile()))
    prof = events[-1].data["profile"]
    assert prof["mastered"] == ["array"]


async def test_profiler_moves_concept_from_mastered_to_weak():
    """用户说某个原本'已掌握'的点现在'薄弱'：应从 mastered 移除、加入 weak，绝不并存。"""
    inc = {"mastered": ["图", "堆"], "weak_points": ["链表"]}
    llm = FakeLLMClient(responses=[json.dumps(inc, ensure_ascii=False)])
    start = Profile(mastered=["array", "linked_list", "queue"], weak_points=["binary_tree"])
    events = await _collect(ProfilerAgent(llm).run("我学过图和堆，但链表很弱", start))
    prof = events[-1].data["profile"]
    assert "linked_list" in prof["weak_points"]
    assert "linked_list" not in prof["mastered"]
    assert "graph" in prof["mastered"] and "heap" in prof["mastered"]
    # 任何知识点都不得同时出现在两列
    assert not (set(prof["mastered"]) & set(prof["weak_points"]))


async def test_profiler_moves_concept_from_weak_to_mastered():
    """反向：用户说原本'薄弱'的点已掌握，应从 weak 移除、加入 mastered。"""
    inc = {"mastered": ["二叉树"]}
    llm = FakeLLMClient(responses=[json.dumps(inc, ensure_ascii=False)])
    start = Profile(mastered=["array"], weak_points=["binary_tree", "dynamic_programming"])
    events = await _collect(ProfilerAgent(llm).run("二叉树我已经学会了", start))
    prof = events[-1].data["profile"]
    assert "binary_tree" in prof["mastered"]
    assert "binary_tree" not in prof["weak_points"]
    assert not (set(prof["mastered"]) & set(prof["weak_points"]))


async def test_quizzer_uses_llm_generated_questions():
    payload = ('[{"stem":"队列遵循什么原则?","answer":"FIFO","difficulty":1},'
               '{"stem":"BFS 用什么结构?","answer":"队列","difficulty":2}]')
    events = await _collect(QuizzerAgent(FakeLLMClient(responses=[payload])).run("queue", Profile()))
    qs = events[-1].data["questions"]
    assert len(qs) == 2
    assert qs[0]["stem"] == "队列遵循什么原则?" and qs[0]["answer"] == "FIFO"


async def test_quizzer_falls_back_to_prebaked_on_bad_json():
    events = await _collect(QuizzerAgent(FakeLLMClient(responses=["这不是JSON"])).run("array", Profile()))
    qs = events[-1].data["questions"]
    assert len(qs) >= 1 and "stem" in qs[0]  # 回退到预烘 array.json 的题
