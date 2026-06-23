from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_knowledge_graph_endpoint():
    r = client.get("/api/knowledge-graph")
    assert r.status_code == 200
    body = r.json()
    assert any(p["id"] == "array" for p in body["points"])
    assert ["array", "linked_list"] in [list(e) for e in body["edges"]]


def test_resource_endpoint():
    r = client.get("/api/resource/array")
    assert r.status_code == 200
    assert r.json()["id"] == "array"


def test_resource_missing_404():
    assert client.get("/api/resource/nope").status_code == 404


def test_learn_sse_contains_three_agents():
    r = client.post("/api/learn", json={"kp_id": "array"})
    assert r.status_code == 200
    assert "tutor" in r.text and "visualizer" in r.text and "quizzer" in r.text
    assert "agent_done" in r.text


def test_chat_sse_returns_profile():
    r = client.post("/api/chat", json={"message": "我学过数组"})
    assert r.status_code == 200
    assert "profiler" in r.text


def test_complete_marks_mastered():
    r = client.post("/api/complete", json={"kp_id": "array"})
    assert r.status_code == 200
    assert "array" in r.json()["mastered"]


def test_reset_profile_clears_everything():
    from app.data.repository import profile_repo
    from app.models import Profile

    profile_repo.save_profile(
        Profile(mastered=["array"], weak_points=["graph"], goal="期末", history=[{"k": 1}])
    )
    r = client.post("/api/profile/reset")
    assert r.status_code == 200
    body = r.json()
    assert body["mastered"] == [] and body["weak_points"] == []
    assert body["goal"] == "" and body["history"] == []
    # 持久层也已清空
    assert profile_repo.get_profile().mastered == []


def test_favorites_add_list_idempotent_delete_clear():
    from app.data.repository import favorites_repo
    favorites_repo.clear("demo")  # 干净起点
    r = client.post("/api/favorites",
                    json={"kp_id": "array", "stem": "数组访问?", "answer": "O(1)", "difficulty": 1})
    assert r.status_code == 200
    fid = r.json()["id"]
    assert fid
    assert any(f["stem"] == "数组访问?" for f in client.get("/api/favorites").json()["favorites"])
    # 幂等：同题再收一次不增加
    client.post("/api/favorites", json={"kp_id": "array", "stem": "数组访问?", "answer": "O(1)"})
    assert len(client.get("/api/favorites").json()["favorites"]) == 1
    # 删除一题
    assert client.post("/api/favorites/delete", json={"id": fid}).json()["favorites"] == []
    # 按 kp 清空 / 全部清空
    client.post("/api/favorites", json={"kp_id": "queue", "stem": "FIFO?"})
    assert client.post("/api/favorites/clear", json={}).json()["favorites"] == []
