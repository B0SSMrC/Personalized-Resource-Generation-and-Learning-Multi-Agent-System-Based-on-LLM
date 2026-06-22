from app.models import Profile, AgentEvent, KnowledgePoint


def test_profile_defaults():
    p = Profile()
    assert p.learner_id == "demo"
    assert p.mastered == [] and p.weak_points == []
    assert p.pace == "medium"


def test_agent_event_serialization():
    ev = AgentEvent(agent="tutor", type="token", content="hi")
    d = ev.model_dump()
    assert d["agent"] == "tutor" and d["type"] == "token"
    assert d["content"] == "hi" and d["data"] is None


def test_knowledge_point():
    kp = KnowledgePoint(id="array", name="数组", difficulty=1,
                        prerequisites=[], est_minutes=30,
                        resource_ref="resources/array.json")
    assert kp.prerequisites == []
