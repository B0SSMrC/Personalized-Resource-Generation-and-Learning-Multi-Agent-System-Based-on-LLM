import json

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.agents.coordinator import Coordinator
from app.config import build_llm
from app.data import repository
from app.data.repository import profile_repo
from app.models import Profile

app = FastAPI(title="个性化学习多智能体系统")
app.add_middleware(CORSMiddleware, allow_origins=["*"],
                   allow_methods=["*"], allow_headers=["*"])


def _coordinator() -> Coordinator:
    return Coordinator(build_llm(), profile_repo)


async def _sse(event_gen):
    async for ev in event_gen:
        yield f"data: {json.dumps(ev.model_dump(), ensure_ascii=False)}\n\n"


def _stream(event_gen) -> StreamingResponse:
    return StreamingResponse(_sse(event_gen), media_type="text/event-stream")


class ChatBody(BaseModel):
    message: str


class LearnBody(BaseModel):
    kp_id: str
    agents: list[str] | None = None


class CompleteBody(BaseModel):
    kp_id: str


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/knowledge-graph")
def knowledge_graph():
    points, edges = repository.load_graph()
    return {"points": [p.model_dump() for p in points.values()],
            "edges": [list(e) for e in edges]}


@app.get("/api/profile")
def get_profile():
    return profile_repo.get_profile().model_dump()


@app.post("/api/profile/reset")
def reset_profile():
    """清空当前学习画像（含历史），返回空画像。"""
    profile_repo.save_profile(Profile())
    return profile_repo.get_profile().model_dump()


@app.get("/api/resource/{kp_id}")
def get_resource(kp_id: str):
    bundle = repository.get_resource(kp_id)
    if bundle is None:
        raise HTTPException(status_code=404, detail="知识点资源不存在")
    return bundle.model_dump()


@app.post("/api/chat")
def chat(body: ChatBody):
    return _stream(_coordinator().chat(body.message))


@app.post("/api/plan")
def plan():
    return _stream(_coordinator().plan())


@app.post("/api/learn")
def learn(body: LearnBody):
    return _stream(_coordinator().generate_resources(body.kp_id, body.agents))


@app.post("/api/complete")
def complete(body: CompleteBody):
    p = profile_repo.get_profile()
    if body.kp_id not in p.mastered:
        p.mastered.append(body.kp_id)
    profile_repo.save_profile(p)
    profile_repo.append_history("demo", {"knowledge_id": body.kp_id, "status": "completed"})
    return profile_repo.get_profile().model_dump()
