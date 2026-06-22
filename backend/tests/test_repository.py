from app.data.repository import InMemoryProfileRepo, SQLiteProfileRepo
from app.models import Profile


def test_get_returns_default_profile_for_new_learner():
    repo = InMemoryProfileRepo()
    p = repo.get_profile("demo")
    assert isinstance(p, Profile)
    assert p.learner_id == "demo"


def test_save_then_get_roundtrip():
    repo = InMemoryProfileRepo()
    p = Profile(learner_id="demo", mastered=["array"], goal="期末")
    repo.save_profile(p)
    got = repo.get_profile("demo")
    assert got.mastered == ["array"]
    assert got.goal == "期末"


def test_append_history():
    repo = InMemoryProfileRepo()
    repo.append_history("demo", {"knowledge_id": "stack", "status": "completed"})
    p = repo.get_profile("demo")
    assert p.history[-1]["knowledge_id"] == "stack"


def test_sqlite_roundtrip(tmp_path):
    db = tmp_path / "t.db"
    repo = SQLiteProfileRepo(str(db))
    repo.save_profile(Profile(mastered=["array"], goal="期末"))
    repo2 = SQLiteProfileRepo(str(db))  # 重新打开，验证持久化
    p = repo2.get_profile("demo")
    assert p.mastered == ["array"] and p.goal == "期末"


def test_sqlite_append_history(tmp_path):
    repo = SQLiteProfileRepo(str(tmp_path / "t.db"))
    repo.append_history("demo", {"knowledge_id": "stack", "status": "completed"})
    assert repo.get_profile("demo").history[-1]["knowledge_id"] == "stack"
