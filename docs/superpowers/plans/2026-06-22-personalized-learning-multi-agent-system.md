# 个性化资源生成与学习多智能体系统 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个 Web 多智能体系统，用数据结构与算法课程演示对话式画像、多 Agent 协同资源生成、个性化路径规划三大能力。

**Architecture:** FastAPI 后端用自写 async 调度器编排 5 个 Agent（画像/规划/讲解/出题/可视化），通过 SSE 把每个 Agent 的工作过程实时推到 React 前端；资源走"预烘 + LLM 增强"，LLM 失败回退预烘内容保证演示稳定。

**Tech Stack:** Python 3.11 / FastAPI / uvicorn / httpx / pydantic / pytest + React 18 / Vite / TypeScript / TailwindCSS / D3。

## Global Constraints

- **测试哲学**：后端业务逻辑用 pytest + TDD（注入 `FakeLLMClient`，免网络）；前端按 spec §9 用「构建 + 手动冒烟」验证，每个前端任务给出具体观察步骤。
- **演示可靠性铁律**：任何 LLM 调用失败必须回退预烘资源，绝不让演示白屏。
- **LLM 适配层**：今天 `LLM_PROVIDER=openai_compat`（Claude 中转，OpenAI 兼容）；保留 `spark` 接入位与 `fake` 离线模式。
- **提交规范**：每个 commit 用 conventional commits 前缀（feat/test/docs/chore），消息体末尾加一行 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`。
- **Python 版本**：3.11+。**Node 版本**：18+。
- **优先级**：任务标 `[P0]`（演示主线必做）`[P1]`（撑场面）`[P2]`（锦上添花）。时间不够可在任一 Pn 边界停下，仍是可运行系统。

### 共享契约（所有任务遵循，类型必须一致）

**SSE 线格式**：每个事件一行 `data: {json}\n\n`，`json` 为下方 AgentEvent。

**AgentEvent JSON**：
```json
{ "agent": "profiler|planner|tutor|quizzer|visualizer",
  "type": "agent_start|token|agent_done|agent_error",
  "content": "流式文本片段或人类可读说明",
  "data": null }
```

**Profile JSON**：`{ "learner_id": "demo", "mastered": [], "weak_points": [], "goal": "", "preference": "", "pace": "medium", "history": [] }`

**KnowledgePoint JSON**：`{ "id": "array", "name": "数组", "difficulty": 1, "prerequisites": [], "est_minutes": 30, "resource_ref": "resources/array.json" }`

**ResourceBundle JSON**：`{ "id": "array", "explanation_md": "...", "viz": {"type":"linear|sorting|tree|graph","params":{}}, "code": {"language":"python","source":"..."}, "question_templates": [{"stem":"","answer":"","difficulty":1}] }`

**HTTP API**：
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/health` | `{"status":"ok"}` |
| GET | `/api/knowledge-graph` | `{"points":[KnowledgePoint...],"edges":[["from","to"]...]}` |
| GET | `/api/profile` | 当前 Profile |
| POST | `/api/chat` `{message}` | SSE：profiler 事件，末 `agent_done.data.profile` |
| POST | `/api/plan` `{}` | SSE：planner 事件，末 `agent_done.data.path / rationale` |
| POST | `/api/learn` `{kp_id}` | SSE：tutor/visualizer/quizzer 并行事件 |
| GET | `/api/resource/{kp_id}` | 预烘 ResourceBundle |

---

## 文件结构

```
backend/
  pytest.ini
  requirements.txt
  .env.example
  app/
    __init__.py
    config.py            # 环境配置 + LLM 工厂
    models.py            # pydantic schemas
    llm/{__init__,base,fake,openai_compat,spark}.py
    agents/{__init__,base,profiler,planner,tutor,quizzer,visualizer,coordinator}.py
    data/
      knowledge_graph.json
      resources/*.json
      repository.py       # 画像仓储(内存/SQLite) + 资源/图加载
    main.py              # FastAPI app + 路由 + SSE
  tests/{conftest,test_models,test_graph,test_resources,test_repository,test_llm,test_agents,test_coordinator,test_api}.py
frontend/
  package.json  vite.config.ts  tsconfig.json  index.html
  tailwind.config.js  postcss.config.js
  src/
    main.tsx  App.tsx  index.css  types.ts
    api/client.ts
    components/{ProfileChat,ProfileCard,KnowledgeGraph,AgentFeed,ResourcePanel}.tsx
    components/animations/{SortingAnim,TreeAnim,GraphAnim,LinearAnim}.tsx
README.md
```

---

## Task 1 [P0]: 后端脚手架 + 配置 + 健康检查

**Files:**
- Create: `backend/requirements.txt`, `backend/pytest.ini`, `backend/.env.example`
- Create: `backend/app/__init__.py`, `backend/app/config.py`, `backend/app/main.py`
- Test: `backend/tests/__init__.py`, `backend/tests/test_api.py`

**Interfaces:**
- Produces: `app.main.app`（FastAPI 实例）；`app.config.settings`（含 `llm_provider/llm_base_url/llm_api_key/llm_model/db_path`）与 `build_llm()`（Task 6 补全实现，此任务先留桩）。

- [ ] **Step 1: 写依赖与配置文件**

`backend/requirements.txt`:
```
fastapi>=0.110
uvicorn[standard]>=0.27
httpx>=0.27
pydantic>=2.6
python-dotenv>=1.0
pytest>=8.0
pytest-asyncio>=0.23
```

`backend/pytest.ini`:
```ini
[pytest]
asyncio_mode = auto
testpaths = tests
```

`backend/.env.example`:
```
LLM_PROVIDER=openai_compat
LLM_BASE_URL=https://your-relay-host/v1
LLM_API_KEY=sk-xxx
LLM_MODEL=claude-3-5-sonnet
DB_PATH=profiles.db
```

`backend/app/__init__.py`: 空文件。
`backend/tests/__init__.py`: 空文件。

- [ ] **Step 2: 写 config.py（LLM 工厂先留桩）**

`backend/app/config.py`:
```python
import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    llm_provider = os.getenv("LLM_PROVIDER", "fake")
    llm_base_url = os.getenv("LLM_BASE_URL", "")
    llm_api_key = os.getenv("LLM_API_KEY", "")
    llm_model = os.getenv("LLM_MODEL", "gpt-4o-mini")
    db_path = os.getenv("DB_PATH", "profiles.db")


settings = Settings()


def build_llm():
    """Task 6 补全。当前返回 None 占位。"""
    return None
```

- [ ] **Step 3: 写失败测试**

`backend/tests/test_api.py`:
```python
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}
```

- [ ] **Step 4: 运行测试确认失败**

Run: `cd backend && python -m pytest tests/test_api.py -v`
Expected: FAIL（`ModuleNotFoundError: app.main` 或导入错误）

- [ ] **Step 5: 写最小 main.py**

`backend/app/main.py`:
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="个性化学习多智能体系统")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"status": "ok"}
```

- [ ] **Step 6: 安装依赖并运行测试**

Run: `cd backend && pip install -r requirements.txt && python -m pytest tests/test_api.py -v`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add backend/
git commit -m "feat: 后端脚手架与健康检查端点"
```

---

## Task 2 [P0]: 数据模型

**Files:**
- Create: `backend/app/models.py`
- Test: `backend/tests/test_models.py`

**Interfaces:**
- Produces: `KnowledgePoint`, `Profile`, `VizSpec`, `CodeSnippet`, `QuestionTemplate`, `ResourceBundle`, `AgentEvent`（均为 pydantic `BaseModel`）。字段见共享契约。

- [ ] **Step 1: 写失败测试**

`backend/tests/test_models.py`:
```python
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
```

- [ ] **Step 2: 运行确认失败**

Run: `cd backend && python -m pytest tests/test_models.py -v`
Expected: FAIL（`ModuleNotFoundError: app.models`）

- [ ] **Step 3: 写 models.py**

`backend/app/models.py`:
```python
from pydantic import BaseModel, Field


class KnowledgePoint(BaseModel):
    id: str
    name: str
    difficulty: int = 1
    prerequisites: list[str] = Field(default_factory=list)
    est_minutes: int = 30
    resource_ref: str = ""


class Profile(BaseModel):
    learner_id: str = "demo"
    mastered: list[str] = Field(default_factory=list)
    weak_points: list[str] = Field(default_factory=list)
    goal: str = ""
    preference: str = ""
    pace: str = "medium"
    history: list[dict] = Field(default_factory=list)


class VizSpec(BaseModel):
    type: str = "linear"  # linear | sorting | tree | graph
    params: dict = Field(default_factory=dict)


class CodeSnippet(BaseModel):
    language: str = "python"
    source: str = ""


class QuestionTemplate(BaseModel):
    stem: str
    answer: str = ""
    difficulty: int = 1


class ResourceBundle(BaseModel):
    id: str
    explanation_md: str = ""
    viz: VizSpec = Field(default_factory=VizSpec)
    code: CodeSnippet = Field(default_factory=CodeSnippet)
    question_templates: list[QuestionTemplate] = Field(default_factory=list)


class AgentEvent(BaseModel):
    agent: str
    type: str  # agent_start | token | agent_done | agent_error
    content: str = ""
    data: dict | None = None
```

- [ ] **Step 4: 运行确认通过**

Run: `cd backend && python -m pytest tests/test_models.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/models.py backend/tests/test_models.py
git commit -m "feat: 核心数据模型 (Profile/KnowledgePoint/ResourceBundle/AgentEvent)"
```

---

## Task 3 [P0]: 知识图谱数据 + 路径规划算法

**Files:**
- Create: `backend/app/data/knowledge_graph.json`
- Create: `backend/app/data/__init__.py`, `backend/app/data/repository.py`（本任务仅加图加载 + compute_path；画像仓储在 Task 5）
- Test: `backend/tests/test_graph.py`

**Interfaces:**
- Produces:
  - `repository.load_graph() -> tuple[dict[str, KnowledgePoint], list[tuple[str,str]]]`（返回 points 字典与 edges 列表）
  - `repository.compute_path(points: dict[str, KnowledgePoint], mastered: set[str], weak_points: set[str]) -> list[str]`

- [ ] **Step 1: 写知识图谱 JSON（P0 先放 4 个点，Task 18 扩到 ~12）**

`backend/app/data/knowledge_graph.json`:
```json
{
  "points": [
    {"id": "array", "name": "数组", "difficulty": 1, "prerequisites": [], "est_minutes": 30, "resource_ref": "resources/array.json"},
    {"id": "linked_list", "name": "链表", "difficulty": 2, "prerequisites": ["array"], "est_minutes": 35, "resource_ref": "resources/linked_list.json"},
    {"id": "sorting", "name": "排序", "difficulty": 2, "prerequisites": ["array"], "est_minutes": 45, "resource_ref": "resources/sorting.json"},
    {"id": "binary_tree", "name": "二叉树", "difficulty": 3, "prerequisites": ["linked_list"], "est_minutes": 40, "resource_ref": "resources/binary_tree.json"}
  ]
}
```
（edges 由 prerequisites 推导，无需单列。）

`backend/app/data/__init__.py`: 空文件。

- [ ] **Step 2: 写失败测试**

`backend/tests/test_graph.py`:
```python
from app.data import repository


def test_load_graph():
    points, edges = repository.load_graph()
    assert "array" in points
    assert points["array"].name == "数组"
    # 边由先修推导：array -> linked_list 等
    assert ("array", "linked_list") in edges


def test_compute_path_respects_prerequisites():
    points, _ = repository.load_graph()
    path = repository.compute_path(points, mastered=set(), weak_points=set())
    # array 无先修，必排在 linked_list / binary_tree 之前
    assert path.index("array") < path.index("linked_list")
    assert path.index("linked_list") < path.index("binary_tree")


def test_compute_path_excludes_mastered():
    points, _ = repository.load_graph()
    path = repository.compute_path(points, mastered={"array"}, weak_points=set())
    assert "array" not in path


def test_compute_path_prioritizes_weak_points():
    points, _ = repository.load_graph()
    # array 已掌握后，linked_list 与 sorting 同时就绪；sorting 为薄弱点应靠前
    path = repository.compute_path(points, mastered={"array"}, weak_points={"sorting"})
    assert path.index("sorting") < path.index("linked_list")
```

- [ ] **Step 3: 运行确认失败**

Run: `cd backend && python -m pytest tests/test_graph.py -v`
Expected: FAIL（`load_graph` 不存在）

- [ ] **Step 4: 写 repository.py 的图部分**

`backend/app/data/repository.py`:
```python
import heapq
import json
from pathlib import Path

from app.models import KnowledgePoint

_DATA_DIR = Path(__file__).parent
_GRAPH_FILE = _DATA_DIR / "knowledge_graph.json"


def load_graph() -> tuple[dict[str, KnowledgePoint], list[tuple[str, str]]]:
    raw = json.loads(_GRAPH_FILE.read_text(encoding="utf-8"))
    points = {p["id"]: KnowledgePoint(**p) for p in raw["points"]}
    edges = [(pre, pid) for pid, p in points.items() for pre in p.prerequisites]
    return points, edges


def compute_path(points: dict[str, KnowledgePoint],
                 mastered: set[str], weak_points: set[str]) -> list[str]:
    """Kahn 拓扑排序 + 优先队列：薄弱点优先、难度低优先，且满足先修约束。"""
    indeg: dict[str, int] = {}
    for pid, p in points.items():
        if pid in mastered:
            continue
        indeg[pid] = sum(1 for pre in p.prerequisites
                         if pre in points and pre not in mastered)

    def key(pid: str):
        p = points[pid]
        return (0 if pid in weak_points else 1, p.difficulty, p.name)

    heap = [(key(pid), pid) for pid, d in indeg.items() if d == 0]
    heapq.heapify(heap)
    order: list[str] = []
    while heap:
        _, pid = heapq.heappop(heap)
        order.append(pid)
        for cid, cp in points.items():
            if cid in indeg and pid in cp.prerequisites:
                indeg[cid] -= 1
                if indeg[cid] == 0:
                    heapq.heappush(heap, (key(cid), cid))
    return order
```

- [ ] **Step 5: 运行确认通过**

Run: `cd backend && python -m pytest tests/test_graph.py -v`
Expected: PASS（4 个测试）

- [ ] **Step 6: Commit**

```bash
git add backend/app/data/ backend/tests/test_graph.py
git commit -m "feat: 知识图谱数据与拓扑路径规划算法"
```

---

## Task 4 [P0]: 预烘资源库（3 个知识点）+ 资源加载

**Files:**
- Create: `backend/app/data/resources/array.json`, `sorting.json`, `binary_tree.json`
- Modify: `backend/app/data/repository.py`（加 `get_resource`）
- Test: `backend/tests/test_resources.py`

**Interfaces:**
- Consumes: `ResourceBundle`（Task 2）
- Produces: `repository.get_resource(kp_id: str) -> ResourceBundle | None`

- [ ] **Step 1: 写三个资源 bundle**

`backend/app/data/resources/array.json`:
```json
{
  "id": "array",
  "explanation_md": "## 数组\n数组是一段**连续内存**上的同类型元素集合，下标访问 $O(1)$，中间插入/删除 $O(n)$。\n\n- 随机访问快\n- 大小通常固定（静态数组）",
  "viz": {"type": "linear", "params": {"structure": "array", "values": [5, 2, 8, 1, 9], "op": "access", "index": 2}},
  "code": {"language": "python", "source": "arr = [5, 2, 8, 1, 9]\nprint(arr[2])  # O(1) 随机访问\narr.insert(2, 99)  # O(n) 中间插入"},
  "question_templates": [
    {"stem": "长度为 n 的数组，在下标 0 处插入元素的时间复杂度是？", "answer": "O(n)", "difficulty": 1},
    {"stem": "数组随机访问 arr[i] 的时间复杂度是？", "answer": "O(1)", "difficulty": 1}
  ]
}
```

`backend/app/data/resources/sorting.json`:
```json
{
  "id": "sorting",
  "explanation_md": "## 排序\n以**快速排序**为例：选基准 pivot，partition 使左 < pivot < 右，再递归。平均 $O(n\\log n)$，最坏 $O(n^2)$。",
  "viz": {"type": "sorting", "params": {"algorithm": "quick", "values": [5, 2, 8, 1, 9, 3]}},
  "code": {"language": "python", "source": "def quick_sort(a):\n    if len(a) <= 1:\n        return a\n    p = a[len(a)//2]\n    return quick_sort([x for x in a if x < p]) + [x for x in a if x == p] + quick_sort([x for x in a if x > p])"},
  "question_templates": [
    {"stem": "快速排序的平均时间复杂度是？", "answer": "O(n log n)", "difficulty": 2},
    {"stem": "快排在什么输入下退化为 O(n^2)？", "answer": "每次基准都是最值（如已有序且取端点为基准）", "difficulty": 3}
  ]
}
```

`backend/app/data/resources/binary_tree.json`:
```json
{
  "id": "binary_tree",
  "explanation_md": "## 二叉树\n每个节点至多两个子节点。常见遍历：前序/中序/后序/层序。中序遍历 BST 得**升序序列**。",
  "viz": {"type": "tree", "params": {"nodes": [8, 3, 10, 1, 6, 14], "traversal": "inorder"}},
  "code": {"language": "python", "source": "class Node:\n    def __init__(self, v):\n        self.v, self.left, self.right = v, None, None\n\ndef inorder(n):\n    if not n:\n        return\n    inorder(n.left); print(n.v); inorder(n.right)"},
  "question_templates": [
    {"stem": "对二叉搜索树做中序遍历，输出序列有什么特点？", "answer": "升序排列", "difficulty": 2}
  ]
}
```

- [ ] **Step 2: 写失败测试**

`backend/tests/test_resources.py`:
```python
from app.data import repository
from app.models import ResourceBundle


def test_get_resource_returns_bundle():
    b = repository.get_resource("array")
    assert isinstance(b, ResourceBundle)
    assert b.id == "array"
    assert b.viz.type == "linear"
    assert len(b.question_templates) >= 1


def test_get_resource_missing_returns_none():
    assert repository.get_resource("nonexistent") is None


def test_all_graph_points_with_resource_ref_loadable():
    points, _ = repository.load_graph()
    for pid, p in points.items():
        if (repository._DATA_DIR / p.resource_ref).exists():
            assert repository.get_resource(pid) is not None
```

- [ ] **Step 3: 运行确认失败**

Run: `cd backend && python -m pytest tests/test_resources.py -v`
Expected: FAIL（`get_resource` 不存在）

- [ ] **Step 4: 给 repository.py 加 get_resource**

在 `backend/app/data/repository.py` 末尾追加：
```python
from app.models import ResourceBundle


def get_resource(kp_id: str) -> ResourceBundle | None:
    points, _ = load_graph()
    p = points.get(kp_id)
    if p is None or not p.resource_ref:
        return None
    path = _DATA_DIR / p.resource_ref
    if not path.exists():
        return None
    return ResourceBundle(**json.loads(path.read_text(encoding="utf-8")))
```

- [ ] **Step 5: 运行确认通过**

Run: `cd backend && python -m pytest tests/test_resources.py -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/data/resources/ backend/app/data/repository.py backend/tests/test_resources.py
git commit -m "feat: 预烘资源库(数组/排序/二叉树)与资源加载"
```

---

## Task 5 [P0]: 画像仓储（内存实现）

**Files:**
- Modify: `backend/app/data/repository.py`（加 `ProfileRepo` 协议 + `InMemoryProfileRepo`）
- Test: `backend/tests/test_repository.py`

**Interfaces:**
- Consumes: `Profile`（Task 2）
- Produces:
  - `InMemoryProfileRepo`，方法：`get_profile(learner_id="demo") -> Profile`、`save_profile(profile: Profile) -> None`、`append_history(learner_id, entry: dict) -> Profile`
  - 模块级单例 `profile_repo`（默认 `InMemoryProfileRepo`，Task 19 可替换为 SQLite）

- [ ] **Step 1: 写失败测试**

`backend/tests/test_repository.py`:
```python
from app.data.repository import InMemoryProfileRepo
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
```

- [ ] **Step 2: 运行确认失败**

Run: `cd backend && python -m pytest tests/test_repository.py -v`
Expected: FAIL

- [ ] **Step 3: 实现 InMemoryProfileRepo**

在 `backend/app/data/repository.py` 末尾追加：
```python
from app.models import Profile


class InMemoryProfileRepo:
    def __init__(self):
        self._store: dict[str, Profile] = {}

    def get_profile(self, learner_id: str = "demo") -> Profile:
        return self._store.get(learner_id) or Profile(learner_id=learner_id)

    def save_profile(self, profile: Profile) -> None:
        self._store[profile.learner_id] = profile

    def append_history(self, learner_id: str, entry: dict) -> Profile:
        p = self.get_profile(learner_id)
        p.history.append(entry)
        self.save_profile(p)
        return p


profile_repo = InMemoryProfileRepo()
```

- [ ] **Step 4: 运行确认通过**

Run: `cd backend && python -m pytest tests/test_repository.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/data/repository.py backend/tests/test_repository.py
git commit -m "feat: 内存画像仓储"
```

---

## Task 6 [P0]: LLM 适配层（base + Fake + OpenAICompat + Spark 占位 + 工厂）

**Files:**
- Create: `backend/app/llm/__init__.py`, `base.py`, `fake.py`, `openai_compat.py`, `spark.py`
- Modify: `backend/app/config.py`（补全 `build_llm`）
- Test: `backend/tests/test_llm.py`

**Interfaces:**
- Produces:
  - `LLMClient`（ABC）：`async chat(messages: list[dict], **kw) -> str`、`async stream(messages: list[dict], **kw) -> AsyncIterator[str]`
  - `FakeLLMClient(responses: list[str] | None = None, canned: dict | None = None)`
  - `OpenAICompatClient(base_url, api_key, model)`
  - `SparkClient`（占位，调用抛 `NotImplementedError`）
  - `config.build_llm() -> LLMClient`

- [ ] **Step 1: 写失败测试**

`backend/tests/test_llm.py`:
```python
from app.llm.fake import FakeLLMClient


async def test_fake_chat_returns_injected_response():
    llm = FakeLLMClient(responses=["hello"])
    out = await llm.chat([{"role": "user", "content": "hi"}])
    assert out == "hello"


async def test_fake_stream_yields_chunks():
    llm = FakeLLMClient(responses=["a b c"])
    chunks = [c async for c in llm.stream([{"role": "user", "content": "x"}])]
    assert "".join(chunks).strip() == "a b c"


async def test_fake_canned_matches_keyword():
    llm = FakeLLMClient(canned={"画像": '{"mastered":["array"]}'})
    out = await llm.chat([{"role": "system", "content": "你是画像Agent"}])
    assert "array" in out


def test_build_llm_defaults_to_fake(monkeypatch):
    from app import config
    monkeypatch.setattr(config.settings, "llm_provider", "fake")
    from app.llm.fake import FakeLLMClient as F
    assert isinstance(config.build_llm(), F)
```

- [ ] **Step 2: 运行确认失败**

Run: `cd backend && python -m pytest tests/test_llm.py -v`
Expected: FAIL

- [ ] **Step 3: 写 base.py**

`backend/app/llm/__init__.py`: 空文件。

`backend/app/llm/base.py`:
```python
from abc import ABC, abstractmethod
from typing import AsyncIterator


class LLMClient(ABC):
    @abstractmethod
    async def chat(self, messages: list[dict], **kw) -> str:
        ...

    @abstractmethod
    async def stream(self, messages: list[dict], **kw) -> AsyncIterator[str]:
        ...
        yield  # pragma: no cover  (标记为异步生成器)
```

- [ ] **Step 4: 写 fake.py**

`backend/app/llm/fake.py`:
```python
from typing import AsyncIterator

from app.llm.base import LLMClient

DEFAULT_CANNED = {
    "画像": '{"mastered": ["array"], "weak_points": ["dynamic_programming"], "goal": "准备期末考", "preference": "喜欢看动画", "pace": "medium"}',
    "规划": "根据你的画像，建议先巩固薄弱点，再循序渐进推进。",
    "讲解": "（演示）这是该知识点的个性化讲解。",
    "出题": "（演示）请说明该结构的时间复杂度。",
}


class FakeLLMClient(LLMClient):
    """离线/测试用：优先返回注入的 responses，否则按关键词匹配 canned。"""

    def __init__(self, responses: list[str] | None = None,
                 canned: dict | None = None):
        self._responses = list(responses or [])
        self._canned = canned or DEFAULT_CANNED

    def _match(self, messages: list[dict]) -> str:
        text = " ".join(m.get("content", "") for m in messages)
        for kw, resp in self._canned.items():
            if kw in text:
                return resp
        return "（演示）"

    async def chat(self, messages: list[dict], **kw) -> str:
        if self._responses:
            return self._responses.pop(0)
        return self._match(messages)

    async def stream(self, messages: list[dict], **kw) -> AsyncIterator[str]:
        text = await self.chat(messages, **kw)
        for piece in text.split(" "):
            yield piece + " "
```

- [ ] **Step 5: 写 openai_compat.py 与 spark.py**

`backend/app/llm/openai_compat.py`:
```python
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
```

`backend/app/llm/spark.py`:
```python
from typing import AsyncIterator

from app.llm.base import LLMClient


class SparkClient(LLMClient):
    """讯飞星火接入位。上台前在此实现星火 HTTP/WS 协议。"""

    def __init__(self, *args, **kwargs):
        pass

    async def chat(self, messages: list[dict], **kw) -> str:
        raise NotImplementedError("SparkClient 待接入星火 API")

    async def stream(self, messages: list[dict], **kw) -> AsyncIterator[str]:
        raise NotImplementedError("SparkClient 待接入星火 API")
        yield  # pragma: no cover
```

- [ ] **Step 6: 补全 config.build_llm**

替换 `backend/app/config.py` 的 `build_llm`：
```python
def build_llm():
    from app.llm.fake import FakeLLMClient
    if settings.llm_provider == "openai_compat":
        from app.llm.openai_compat import OpenAICompatClient
        return OpenAICompatClient(settings.llm_base_url, settings.llm_api_key, settings.llm_model)
    if settings.llm_provider == "spark":
        from app.llm.spark import SparkClient
        return SparkClient()
    return FakeLLMClient()
```

- [ ] **Step 7: 运行确认通过**

Run: `cd backend && python -m pytest tests/test_llm.py -v`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add backend/app/llm/ backend/app/config.py backend/tests/test_llm.py
git commit -m "feat: LLM 适配层 (base/fake/openai_compat/spark) 与工厂"
```

---

## Task 7 [P0]: Agent 基类 + 事件辅助

**Files:**
- Create: `backend/app/agents/__init__.py`, `backend/app/agents/base.py`
- Test: `backend/tests/test_agents.py`（本任务先放基类测试）

**Interfaces:**
- Consumes: `AgentEvent`（Task 2）、`LLMClient`（Task 6）
- Produces: `BaseAgent(llm: LLMClient, repo=None)`，`name: str` 类属性；辅助方法 `start() -> AgentEvent`、`token(text) -> AgentEvent`、`done(data) -> AgentEvent`、`error(msg) -> AgentEvent`，均返回带本 agent `name` 的 `AgentEvent`。

- [ ] **Step 1: 写失败测试**

`backend/tests/test_agents.py`:
```python
from app.agents.base import BaseAgent
from app.llm.fake import FakeLLMClient


class _Dummy(BaseAgent):
    name = "dummy"


def test_event_helpers_carry_name():
    a = _Dummy(FakeLLMClient())
    assert a.start().type == "agent_start"
    assert a.start().agent == "dummy"
    assert a.token("x").content == "x"
    assert a.done({"k": 1}).data == {"k": 1}
    assert a.error("oops").type == "agent_error"
```

- [ ] **Step 2: 运行确认失败**

Run: `cd backend && python -m pytest tests/test_agents.py -v`
Expected: FAIL

- [ ] **Step 3: 写 base.py**

`backend/app/agents/__init__.py`: 空文件。

`backend/app/agents/base.py`:
```python
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
```

- [ ] **Step 4: 运行确认通过**

Run: `cd backend && python -m pytest tests/test_agents.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/agents/ backend/tests/test_agents.py
git commit -m "feat: Agent 基类与事件辅助"
```

---

## Task 8 [P0]: 画像 Agent + 规划 Agent

**Files:**
- Create: `backend/app/agents/profiler.py`, `backend/app/agents/planner.py`
- Test: 追加到 `backend/tests/test_agents.py`

**Interfaces:**
- Consumes: `BaseAgent`、`FakeLLMClient`、`Profile`、`repository.compute_path`/`load_graph`
- Produces:
  - `ProfilerAgent.run(message: str, profile: Profile) -> AsyncIterator[AgentEvent]`；末事件 `agent_done.data = {"profile": <dict>, "increment": <dict>}`
  - `PlannerAgent.run(profile: Profile) -> AsyncIterator[AgentEvent]`；末事件 `agent_done.data = {"path": [ids], "rationale": str}`

- [ ] **Step 1: 写失败测试（追加）**

追加到 `backend/tests/test_agents.py`:
```python
import json
from app.agents.profiler import ProfilerAgent
from app.agents.planner import PlannerAgent
from app.models import Profile


async def _collect(gen):
    return [ev async for ev in gen]


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
```

- [ ] **Step 2: 运行确认失败**

Run: `cd backend && python -m pytest tests/test_agents.py -v`
Expected: FAIL

- [ ] **Step 3: 写 profiler.py**

`backend/app/agents/profiler.py`:
```python
import json
from typing import AsyncIterator

from app.agents.base import BaseAgent
from app.models import AgentEvent, Profile

_SYSTEM = (
    "你是学习画像Agent。请阅读学生的话，抽取并仅输出一个 JSON 对象，"
    "字段可含 mastered(list)、weak_points(list)、goal(str)、preference(str)、pace(str)。"
    "不要输出 JSON 以外的任何内容。"
)


def _safe_json(text: str) -> dict:
    try:
        start, end = text.find("{"), text.rfind("}")
        if start >= 0 and end > start:
            return json.loads(text[start:end + 1])
    except json.JSONDecodeError:
        pass
    return {}


def _merge(profile: Profile, inc: dict) -> Profile:
    data = profile.model_dump()
    for k in ("mastered", "weak_points"):
        if isinstance(inc.get(k), list):
            data[k] = sorted(set(data[k]) | set(inc[k]))
    for k in ("goal", "preference", "pace"):
        if inc.get(k):
            data[k] = inc[k]
    return Profile(**data)


class ProfilerAgent(BaseAgent):
    name = "profiler"

    async def run(self, message: str, profile: Profile) -> AsyncIterator[AgentEvent]:
        yield self.start()
        try:
            raw = await self.llm.chat([
                {"role": "system", "content": _SYSTEM},
                {"role": "user", "content": message},
            ])
            inc = _safe_json(raw)
        except Exception as e:  # noqa: BLE001  LLM 失败不阻断
            inc = {}
            yield self.token(f"（画像抽取降级：{e}）")
        new_profile = _merge(profile, inc)
        if self.repo:
            self.repo.save_profile(new_profile)
        yield self.token("已更新你的学习画像。")
        yield self.done({"profile": new_profile.model_dump(), "increment": inc})
```

- [ ] **Step 4: 写 planner.py**

`backend/app/agents/planner.py`:
```python
from typing import AsyncIterator

from app.agents.base import BaseAgent
from app.data import repository
from app.models import AgentEvent, Profile

_SYSTEM = "你是学习路径规划Agent。请用一两句话向学生解释推荐学习顺序的理由。"


class PlannerAgent(BaseAgent):
    name = "planner"

    async def run(self, profile: Profile) -> AsyncIterator[AgentEvent]:
        yield self.start()
        points, _ = repository.load_graph()
        path = repository.compute_path(
            points, set(profile.mastered), set(profile.weak_points))
        names = [points[p].name for p in path if p in points]
        try:
            rationale = await self.llm.chat([
                {"role": "system", "content": _SYSTEM},
                {"role": "user", "content":
                    f"画像：{profile.model_dump()}；推荐顺序：{names}"},
            ])
        except Exception:  # noqa: BLE001  回退固定说明
            rationale = "已按先修关系排序，并优先安排你的薄弱点。"
        yield self.token(rationale)
        yield self.done({"path": path, "rationale": rationale})
```

- [ ] **Step 5: 运行确认通过**

Run: `cd backend && python -m pytest tests/test_agents.py -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/agents/profiler.py backend/app/agents/planner.py backend/tests/test_agents.py
git commit -m "feat: 画像 Agent 与规划 Agent"
```

---

## Task 9 [P0]: 资源生成三 Agent（讲解 / 可视化 / 出题）

**Files:**
- Create: `backend/app/agents/tutor.py`, `visualizer.py`, `quizzer.py`
- Test: 追加到 `backend/tests/test_agents.py`

**Interfaces:**
- Consumes: `BaseAgent`、`repository.get_resource`、`Profile`
- Produces（三者 `run(kp_id: str, profile: Profile) -> AsyncIterator[AgentEvent]`）：
  - `TutorAgent` 末 `agent_done.data = {"explanation_md": str}`
  - `VisualizerAgent` 末 `agent_done.data = {"viz": {"type","params"}}`
  - `QuizzerAgent` 末 `agent_done.data = {"questions": [{"stem","answer","difficulty"}]}`
  - 三者在 `get_resource` 为 None 时发 `agent_error` 后仍 `agent_done`（空 data），不抛异常。

- [ ] **Step 1: 写失败测试（追加）**

追加到 `backend/tests/test_agents.py`:
```python
from app.agents.tutor import TutorAgent
from app.agents.visualizer import VisualizerAgent
from app.agents.quizzer import QuizzerAgent


async def test_tutor_streams_and_returns_explanation():
    llm = FakeLLMClient(responses=["数组讲解内容"])
    events = await _collect(TutorAgent(llm).run("array", Profile()))
    assert any(e.type == "token" for e in events)
    assert events[-1].type == "agent_done"
    assert events[-1].data["explanation_md"]


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
```

- [ ] **Step 2: 运行确认失败**

Run: `cd backend && python -m pytest tests/test_agents.py -v`
Expected: FAIL

- [ ] **Step 3: 写 tutor.py**

`backend/app/agents/tutor.py`:
```python
from typing import AsyncIterator

from app.agents.base import BaseAgent
from app.data import repository
from app.models import AgentEvent, Profile

_SYSTEM = ("你是讲解Agent。请基于给定讲解素材，结合学生画像，"
           "用 Markdown（可含 LaTeX 公式）输出更贴合该学生的讲解。")


class TutorAgent(BaseAgent):
    name = "tutor"

    async def run(self, kp_id: str, profile: Profile) -> AsyncIterator[AgentEvent]:
        yield self.start()
        bundle = repository.get_resource(kp_id)
        if bundle is None:
            yield self.error(f"无知识点资源：{kp_id}")
            yield self.done({"explanation_md": ""})
            return
        base_md = bundle.explanation_md
        acc = ""
        try:
            async for tok in self.llm.stream([
                {"role": "system", "content": _SYSTEM},
                {"role": "user", "content":
                    f"素材：\n{base_md}\n学生偏好：{profile.preference or '无'}"},
            ]):
                acc += tok
                yield self.token(tok)
        except Exception:  # noqa: BLE001  回退预烘
            acc = ""
        final_md = acc.strip() or base_md
        if not acc.strip():
            yield self.token(base_md)
        yield self.done({"explanation_md": final_md})
```

- [ ] **Step 4: 写 visualizer.py**

`backend/app/agents/visualizer.py`:
```python
from typing import AsyncIterator

from app.agents.base import BaseAgent
from app.data import repository
from app.models import AgentEvent, Profile

_TYPE_DESC = {
    "sorting": "用条形高度变化动画演示排序过程",
    "tree": "用树形结构动画演示节点与遍历",
    "graph": "用图遍历动画演示 BFS/DFS",
    "linear": "用线性格子动画演示访问/插入",
}


class VisualizerAgent(BaseAgent):
    name = "visualizer"

    async def run(self, kp_id: str, profile: Profile) -> AsyncIterator[AgentEvent]:
        yield self.start()
        bundle = repository.get_resource(kp_id)
        if bundle is None:
            yield self.error(f"无知识点资源：{kp_id}")
            yield self.done({"viz": {"type": "linear", "params": {}}})
            return
        viz = bundle.viz
        yield self.token(f"已选定可视化：{_TYPE_DESC.get(viz.type, viz.type)}。")
        yield self.done({"viz": {"type": viz.type, "params": viz.params}})
```

- [ ] **Step 5: 写 quizzer.py**

`backend/app/agents/quizzer.py`:
```python
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
```

- [ ] **Step 6: 运行确认通过**

Run: `cd backend && python -m pytest tests/test_agents.py -v`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add backend/app/agents/tutor.py backend/app/agents/visualizer.py backend/app/agents/quizzer.py backend/tests/test_agents.py
git commit -m "feat: 资源生成三 Agent (讲解/可视化/出题)"
```

---

## Task 10 [P0]: 调度器（并行协同合并事件流）

**Files:**
- Create: `backend/app/agents/coordinator.py`
- Test: `backend/tests/test_coordinator.py`

**Interfaces:**
- Consumes: 全部 Agent、`repository.profile_repo`、`config.build_llm`
- Produces: `Coordinator(llm: LLMClient, repo)`，方法均为 `AsyncIterator[AgentEvent]`：
  - `chat(message: str) -> ...`（运行 profiler）
  - `plan() -> ...`（运行 planner）
  - `generate_resources(kp_id: str) -> ...`（**并行**运行 tutor/visualizer/quizzer，事件交错产出）

- [ ] **Step 1: 写失败测试**

`backend/tests/test_coordinator.py`:
```python
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
```

- [ ] **Step 2: 运行确认失败**

Run: `cd backend && python -m pytest tests/test_coordinator.py -v`
Expected: FAIL

- [ ] **Step 3: 写 coordinator.py**

`backend/app/agents/coordinator.py`:
```python
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
```

- [ ] **Step 4: 运行确认通过**

Run: `cd backend && python -m pytest tests/test_coordinator.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/agents/coordinator.py backend/tests/test_coordinator.py
git commit -m "feat: 多 Agent 并行协同调度器"
```

---

## Task 11 [P0]: FastAPI 路由 + SSE 接线

**Files:**
- Modify: `backend/app/main.py`
- Test: 追加到 `backend/tests/test_api.py`

**Interfaces:**
- Consumes: `Coordinator`、`build_llm`、`profile_repo`、`repository.load_graph/get_resource`
- Produces: 共享契约中的全部 HTTP 端点；SSE 端点用 `text/event-stream`，每事件 `data: {AgentEvent json}\n\n`。

- [ ] **Step 1: 写失败测试（追加）**

追加到 `backend/tests/test_api.py`:
```python
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
```

- [ ] **Step 2: 运行确认失败**

Run: `cd backend && python -m pytest tests/test_api.py -v`
Expected: FAIL（新端点未定义）

- [ ] **Step 3: 重写 main.py**

`backend/app/main.py`:
```python
import json

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.agents.coordinator import Coordinator
from app.config import build_llm
from app.data import repository
from app.data.repository import profile_repo

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
    return _stream(_coordinator().generate_resources(body.kp_id))
```

- [ ] **Step 4: 运行确认通过（全后端回归）**

Run: `cd backend && python -m pytest -v`
Expected: 全部 PASS

- [ ] **Step 5: 手动起服务确认**

Run: `cd backend && uvicorn app.main:app --reload --port 8000`
打开 `http://localhost:8000/docs`，应看到全部端点。`Ctrl+C` 停止。

- [ ] **Step 6: Commit**

```bash
git add backend/app/main.py backend/tests/test_api.py
git commit -m "feat: FastAPI 路由与 SSE 端点接线"
```

---

## Task 12 [P0]: 前端脚手架 + 类型 + SSE 客户端

**Files:**
- Create: `frontend/package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`
- Create: `frontend/tailwind.config.js`, `postcss.config.js`, `frontend/src/index.css`
- Create: `frontend/src/main.tsx`, `frontend/src/types.ts`, `frontend/src/api/client.ts`
- Create: `frontend/src/App.tsx`（最小占位）

**Interfaces:**
- Produces:
  - `types.ts`：`AgentEvent`, `Profile`, `KnowledgePoint`, `Graph`, `ResourceBundle`（与后端契约一致）
  - `api/client.ts`：`getJSON<T>(path)`、`streamSSE(path, body, onEvent)`、`API_BASE`

- [ ] **Step 1: 写配置文件**

`frontend/package.json`:
```json
{
  "name": "learning-agents-frontend",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "d3": "^7.9.0",
    "react-markdown": "^9.0.1",
    "remark-math": "^6.0.0",
    "rehype-katex": "^7.0.0",
    "katex": "^0.16.11"
  },
  "devDependencies": {
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@types/d3": "^7.4.3",
    "@vitejs/plugin-react": "^4.3.1",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.39",
    "tailwindcss": "^3.4.6",
    "typescript": "^5.5.3",
    "vite": "^5.3.4"
  }
}
```

`frontend/vite.config.ts`:
```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { "/api": "http://localhost:8000" },
  },
});
```

`frontend/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true
  },
  "include": ["src"]
}
```

`frontend/index.html`:
```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>个性化学习多智能体系统</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`frontend/tailwind.config.js`:
```js
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
};
```

`frontend/postcss.config.js`:
```js
export default { plugins: { tailwindcss: {}, autoprefixer: {} } };
```

`frontend/src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
@import "katex/dist/katex.min.css";
```

- [ ] **Step 2: 写 types.ts**

`frontend/src/types.ts`:
```ts
export interface AgentEvent {
  agent: string;
  type: "agent_start" | "token" | "agent_done" | "agent_error";
  content: string;
  data: Record<string, any> | null;
}

export interface Profile {
  learner_id: string;
  mastered: string[];
  weak_points: string[];
  goal: string;
  preference: string;
  pace: string;
  history: Record<string, any>[];
}

export interface KnowledgePoint {
  id: string;
  name: string;
  difficulty: number;
  prerequisites: string[];
  est_minutes: number;
  resource_ref: string;
}

export interface Graph {
  points: KnowledgePoint[];
  edges: [string, string][];
}

export interface ResourceBundle {
  id: string;
  explanation_md: string;
  viz: { type: string; params: Record<string, any> };
  code: { language: string; source: string };
  question_templates: { stem: string; answer: string; difficulty: number }[];
}
```

- [ ] **Step 3: 写 api/client.ts**

`frontend/src/api/client.ts`:
```ts
import type { AgentEvent } from "../types";

export const API_BASE = "/api";

export async function getJSON<T>(path: string): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`);
  if (!r.ok) throw new Error(`GET ${path} -> ${r.status}`);
  return r.json();
}

/** POST + 解析 SSE 流，对每个 AgentEvent 调用 onEvent。 */
export async function streamSSE(
  path: string,
  body: unknown,
  onEvent: (ev: AgentEvent) => void,
): Promise<void> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.body) throw new Error("无响应流");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n\n")) >= 0) {
      const chunk = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const line = chunk.split("\n").find((l) => l.startsWith("data:"));
      if (line) onEvent(JSON.parse(line.slice(5).trim()) as AgentEvent);
    }
  }
}
```

- [ ] **Step 4: 写 main.tsx 与最小 App.tsx**

`frontend/src/main.tsx`:
```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

`frontend/src/App.tsx`（占位，Task 13 替换）:
```tsx
import { useEffect, useState } from "react";
import { getJSON } from "./api/client";
import type { Graph } from "./types";

export default function App() {
  const [graph, setGraph] = useState<Graph | null>(null);
  useEffect(() => {
    getJSON<Graph>("/knowledge-graph").then(setGraph).catch(console.error);
  }, []);
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">个性化学习多智能体系统</h1>
      <p className="mt-2 text-gray-600">
        已加载知识点：{graph ? graph.points.length : "加载中…"}
      </p>
    </div>
  );
}
```

- [ ] **Step 5: 安装依赖并构建验证**

Run: `cd frontend && npm install && npm run build`
Expected: 构建成功，无类型错误。

- [ ] **Step 6: 冒烟验证（需后端在跑）**

终端 A：`cd backend && uvicorn app.main:app --port 8000`
终端 B：`cd frontend && npm run dev`
浏览器开 `http://localhost:5173`，应显示标题 + “已加载知识点：4”。

- [ ] **Step 7: Commit**

```bash
git add frontend/
git commit -m "feat: 前端脚手架、类型定义与 SSE 客户端"
```

---

## Task 13 [P0]: 对话式画像视图（ProfileChat + ProfileCard）

**Files:**
- Create: `frontend/src/components/ProfileChat.tsx`, `frontend/src/components/ProfileCard.tsx`
- Modify: `frontend/src/App.tsx`（接入聊天视图）

**Interfaces:**
- Consumes: `streamSSE("/chat", {message}, onEvent)`、`getJSON<Profile>("/profile")`
- Produces: `ProfileChat`（自管聊天 + 触发画像更新回调 `onProfile`）、`ProfileCard({profile})`

- [ ] **Step 1: 写 ProfileCard.tsx**

`frontend/src/components/ProfileCard.tsx`:
```tsx
import type { Profile } from "../types";

export default function ProfileCard({ profile }: { profile: Profile | null }) {
  if (!profile) return <div className="text-gray-400">暂无画像</div>;
  const Tag = ({ text, color }: { text: string; color: string }) => (
    <span className={`inline-block rounded px-2 py-0.5 text-xs ${color} mr-1 mb-1`}>
      {text}
    </span>
  );
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <h3 className="mb-2 font-semibold">学习画像</h3>
      <div className="mb-2 text-sm text-gray-600">目标：{profile.goal || "—"}</div>
      <div className="mb-2 text-sm text-gray-600">偏好：{profile.preference || "—"}</div>
      <div className="mb-1 text-xs text-gray-500">已掌握</div>
      <div>{profile.mastered.map((m) => <Tag key={m} text={m} color="bg-green-100 text-green-700" />)}</div>
      <div className="mb-1 mt-2 text-xs text-gray-500">薄弱点</div>
      <div>{profile.weak_points.map((m) => <Tag key={m} text={m} color="bg-red-100 text-red-700" />)}</div>
    </div>
  );
}
```

- [ ] **Step 2: 写 ProfileChat.tsx**

`frontend/src/components/ProfileChat.tsx`:
```tsx
import { useState } from "react";
import { streamSSE } from "../api/client";
import type { Profile } from "../types";

interface Msg { role: "user" | "agent"; text: string; }

export default function ProfileChat({ onProfile }: { onProfile: (p: Profile) => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setMsgs((m) => [...m, { role: "user", text }]);
    setBusy(true);
    let agentText = "";
    setMsgs((m) => [...m, { role: "agent", text: "" }]);
    await streamSSE("/chat", { message: text }, (ev) => {
      if (ev.type === "token") {
        agentText += ev.content;
        setMsgs((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { role: "agent", text: agentText };
          return copy;
        });
      } else if (ev.type === "agent_done" && ev.data?.profile) {
        onProfile(ev.data.profile as Profile);
      }
    }).catch((e) => console.error(e));
    setBusy(false);
  }

  return (
    <div className="flex h-full flex-col rounded-lg border bg-white">
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {msgs.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
            <span className={`inline-block rounded-lg px-3 py-1.5 text-sm ${
              m.role === "user" ? "bg-blue-500 text-white" : "bg-gray-100"}`}>
              {m.text || "…"}
            </span>
          </div>
        ))}
      </div>
      <div className="flex gap-2 border-t p-2">
        <input
          className="flex-1 rounded border px-2 py-1 text-sm"
          value={input}
          placeholder="说说你的基础、目标和偏好…"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
        />
        <button onClick={send} disabled={busy}
          className="rounded bg-blue-500 px-3 py-1 text-sm text-white disabled:opacity-50">
          发送
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 在 App.tsx 接入（临时双栏布局）**

替换 `frontend/src/App.tsx`:
```tsx
import { useEffect, useState } from "react";
import { getJSON } from "./api/client";
import type { Profile } from "./types";
import ProfileChat from "./components/ProfileChat";
import ProfileCard from "./components/ProfileCard";

export default function App() {
  const [profile, setProfile] = useState<Profile | null>(null);
  useEffect(() => {
    getJSON<Profile>("/profile").then(setProfile).catch(console.error);
  }, []);
  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="mb-4 text-2xl font-bold">个性化学习多智能体系统</h1>
      <div className="grid h-[70vh] grid-cols-3 gap-4">
        <div className="col-span-2"><ProfileChat onProfile={setProfile} /></div>
        <ProfileCard profile={profile} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 冒烟验证**

后端运行中，前端 `npm run dev`。在聊天框输入「我学过数组，但动态规划很弱，想准备期末」，回车。
Expected：聊天区出现 agent 回复；右侧画像卡片「已掌握」「薄弱点」更新（fake 模式下至少出现 canned 内容）。

- [ ] **Step 5: Commit**

```bash
git add frontend/src/
git commit -m "feat: 对话式画像视图 (ProfileChat + ProfileCard)"
```

---

## Task 14 [P0]: 学习工作台（AgentFeed + ResourcePanel）

**Files:**
- Create: `frontend/src/components/AgentFeed.tsx`, `frontend/src/components/ResourcePanel.tsx`
- Modify: `frontend/src/App.tsx`（加「学习工作台」视图 + 视图切换）

**Interfaces:**
- Consumes: `streamSSE("/learn", {kp_id}, onEvent)`
- Produces:
  - `AgentFeed({events})`：按 agent 分组展示状态灯 + 流式文字
  - `ResourcePanel({explanationMd, viz, questions})`：Tab 切换（讲解/动画/练习），动画 Task 15 接入
  - `Workbench({kpId})`：组合上两者，点击「开始学习」触发 `/learn`

- [ ] **Step 1: 写 AgentFeed.tsx**

`frontend/src/components/AgentFeed.tsx`:
```tsx
import type { AgentEvent } from "../types";

const LABELS: Record<string, string> = {
  tutor: "讲解 Agent", visualizer: "可视化 Agent", quizzer: "出题 Agent",
  profiler: "画像 Agent", planner: "规划 Agent",
};

interface AgentState { status: string; text: string; }

function reduce(events: AgentEvent[]): Record<string, AgentState> {
  const acc: Record<string, AgentState> = {};
  for (const ev of events) {
    const s = acc[ev.agent] ?? { status: "等待", text: "" };
    if (ev.type === "agent_start") s.status = "思考中";
    else if (ev.type === "token") { s.status = "生成中"; s.text += ev.content; }
    else if (ev.type === "agent_done") s.status = "完成";
    else if (ev.type === "agent_error") { s.status = "降级"; s.text += ev.content; }
    acc[ev.agent] = s;
  }
  return acc;
}

const DOT: Record<string, string> = {
  等待: "bg-gray-300", 思考中: "bg-yellow-400 animate-pulse",
  生成中: "bg-blue-500 animate-pulse", 完成: "bg-green-500", 降级: "bg-orange-400",
};

export default function AgentFeed({ events }: { events: AgentEvent[] }) {
  const states = reduce(events);
  const order = ["tutor", "visualizer", "quizzer", "profiler", "planner"]
    .filter((a) => a in states);
  return (
    <div className="space-y-3">
      <h3 className="font-semibold">多智能体协同</h3>
      {order.map((a) => (
        <div key={a} className="rounded-lg border bg-white p-3">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${DOT[states[a].status]}`} />
            <span className="font-medium">{LABELS[a] ?? a}</span>
            <span className="ml-auto text-xs text-gray-400">{states[a].status}</span>
          </div>
          {states[a].text && (
            <p className="mt-2 max-h-24 overflow-y-auto text-xs text-gray-600">
              {states[a].text}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: 写 ResourcePanel.tsx（动画位先留占位）**

`frontend/src/components/ResourcePanel.tsx`:
```tsx
import { useState } from "react";
import Markdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

interface Props {
  explanationMd: string;
  viz: { type: string; params: Record<string, any> } | null;
  questions: { stem: string; answer: string; difficulty: number }[];
}

export default function ResourcePanel({ explanationMd, viz, questions }: Props) {
  const [tab, setTab] = useState<"explain" | "anim" | "quiz">("explain");
  const TabBtn = ({ id, label }: { id: typeof tab; label: string }) => (
    <button onClick={() => setTab(id)}
      className={`px-3 py-1.5 text-sm ${tab === id
        ? "border-b-2 border-blue-500 font-medium" : "text-gray-500"}`}>
      {label}
    </button>
  );
  return (
    <div className="rounded-lg border bg-white">
      <div className="flex border-b">
        <TabBtn id="explain" label="讲解" />
        <TabBtn id="anim" label="动画" />
        <TabBtn id="quiz" label="练习" />
      </div>
      <div className="max-h-[55vh] overflow-y-auto p-4">
        {tab === "explain" && (
          <div className="prose prose-sm max-w-none">
            <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
              {explanationMd || "（暂无讲解）"}
            </Markdown>
          </div>
        )}
        {tab === "anim" && (
          <div className="text-sm text-gray-500">
            动画类型：{viz?.type ?? "—"}（Task 15 接入动画组件）
          </div>
        )}
        {tab === "quiz" && (
          <ul className="space-y-3">
            {questions.map((q, i) => (
              <li key={i} className="text-sm">
                <div className="font-medium">{i + 1}. {q.stem}</div>
                <details className="mt-1 text-gray-600">
                  <summary className="cursor-pointer text-blue-500">查看答案</summary>
                  {q.answer}
                </details>
              </li>
            ))}
            {questions.length === 0 && <li className="text-gray-400">（暂无练习）</li>}
          </ul>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 在 App.tsx 加工作台视图 + 视图切换**

替换 `frontend/src/App.tsx`:
```tsx
import { useEffect, useState } from "react";
import { getJSON, streamSSE } from "./api/client";
import type { AgentEvent, Profile } from "./types";
import ProfileChat from "./components/ProfileChat";
import ProfileCard from "./components/ProfileCard";
import AgentFeed from "./components/AgentFeed";
import ResourcePanel from "./components/ResourcePanel";

type View = "profile" | "workbench";

export default function App() {
  const [view, setView] = useState<View>("profile");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [kpId, setKpId] = useState("array");

  useEffect(() => {
    getJSON<Profile>("/profile").then(setProfile).catch(console.error);
  }, []);

  async function learn() {
    setEvents([]);
    await streamSSE("/learn", { kp_id: kpId }, (ev) =>
      setEvents((prev) => [...prev, ev]));
  }

  const explanation = events.findLast?.(
    (e) => e.agent === "tutor" && e.type === "agent_done");
  const viz = events.findLast?.(
    (e) => e.agent === "visualizer" && e.type === "agent_done");
  const quiz = events.findLast?.(
    (e) => e.agent === "quizzer" && e.type === "agent_done");

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-4 flex items-center gap-4">
        <h1 className="text-2xl font-bold">个性化学习多智能体系统</h1>
        <nav className="ml-auto flex gap-2">
          <button onClick={() => setView("profile")}
            className={`rounded px-3 py-1 text-sm ${view === "profile" ? "bg-blue-500 text-white" : "bg-gray-100"}`}>
            画像
          </button>
          <button onClick={() => setView("workbench")}
            className={`rounded px-3 py-1 text-sm ${view === "workbench" ? "bg-blue-500 text-white" : "bg-gray-100"}`}>
            学习工作台
          </button>
        </nav>
      </div>

      {view === "profile" && (
        <div className="grid h-[70vh] grid-cols-3 gap-4">
          <div className="col-span-2"><ProfileChat onProfile={setProfile} /></div>
          <ProfileCard profile={profile} />
        </div>
      )}

      {view === "workbench" && (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <select value={kpId} onChange={(e) => setKpId(e.target.value)}
              className="rounded border px-2 py-1 text-sm">
              <option value="array">数组</option>
              <option value="sorting">排序</option>
              <option value="binary_tree">二叉树</option>
            </select>
            <button onClick={learn}
              className="rounded bg-blue-500 px-3 py-1 text-sm text-white">
              开始学习（触发多 Agent 协同）
            </button>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <AgentFeed events={events} />
            <div className="col-span-2">
              <ResourcePanel
                explanationMd={explanation?.data?.explanation_md ?? ""}
                viz={viz?.data?.viz ?? null}
                questions={quiz?.data?.questions ?? []}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

> 注：`Array.prototype.findLast` 需 ES2023；tsconfig 已设 `target ES2020` 但 Vite/现代浏览器运行时支持。若 `tsc` 报错，将 tsconfig `lib` 加 `"ES2023"`。

- [ ] **Step 4: 构建 + 冒烟验证**

Run: `cd frontend && npm run build`（确认无类型错误；如报 findLast，按上注修 lib）
后端运行中，`npm run dev`，切到「学习工作台」，点「开始学习」。
Expected：左栏三个 Agent 卡片状态灯依次亮起（思考中→生成中→完成）；右栏「讲解」Tab 显示 Markdown，「练习」Tab 显示题目。

- [ ] **Step 5: Commit**

```bash
git add frontend/src/
git commit -m "feat: 学习工作台 (AgentFeed 协同可见化 + ResourcePanel)"
```

---

## Task 15 [P0→P1]: 多模态动画组件

**Files:**
- Create: `frontend/src/components/animations/SortingAnim.tsx`, `TreeAnim.tsx`（P0）
- Create: `frontend/src/components/animations/GraphAnim.tsx`, `LinearAnim.tsx`（P1）
- Modify: `frontend/src/components/ResourcePanel.tsx`（动画 Tab 按 `viz.type` 分发）

**Interfaces:**
- Consumes: `viz: {type, params}`
- Produces: 四个动画组件，props 均为 `{ params: Record<string, any> }`；ResourcePanel 动画 Tab 按 type 选择渲染。

- [ ] **Step 1: 写 SortingAnim.tsx（冒泡，逐帧）**

`frontend/src/components/animations/SortingAnim.tsx`:
```tsx
import { useEffect, useMemo, useState } from "react";

export default function SortingAnim({ params }: { params: Record<string, any> }) {
  const initial: number[] = params.values ?? [5, 2, 8, 1, 9, 3];
  const frames = useMemo(() => {
    const a = [...initial];
    const out: number[][] = [[...a]];
    for (let i = 0; i < a.length; i++)
      for (let j = 0; j < a.length - 1 - i; j++)
        if (a[j] > a[j + 1]) { [a[j], a[j + 1]] = [a[j + 1], a[j]]; out.push([...a]); }
    return out;
  }, [initial]);
  const [f, setF] = useState(0);
  const [playing, setPlaying] = useState(true);
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setF((x) => (x + 1 < frames.length ? x + 1 : x)), 400);
    return () => clearInterval(t);
  }, [playing, frames.length]);
  const max = Math.max(...initial);
  return (
    <div>
      <div className="flex h-48 items-end gap-1">
        {frames[f].map((v, i) => (
          <div key={i} className="flex-1 rounded-t bg-blue-500 text-center text-xs text-white"
            style={{ height: `${(v / max) * 100}%` }}>{v}</div>
        ))}
      </div>
      <div className="mt-2 flex gap-2 text-sm">
        <button onClick={() => setPlaying((p) => !p)} className="rounded bg-gray-100 px-2 py-1">
          {playing ? "暂停" : "播放"}
        </button>
        <button onClick={() => { setF(0); setPlaying(true); }} className="rounded bg-gray-100 px-2 py-1">
          重播
        </button>
        <span className="ml-auto text-gray-400">第 {f + 1}/{frames.length} 帧（冒泡排序）</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 写 TreeAnim.tsx（BST 构建 + 中序高亮）**

`frontend/src/components/animations/TreeAnim.tsx`:
```tsx
import { useEffect, useMemo, useState } from "react";

interface N { v: number; x: number; y: number; }

export default function TreeAnim({ params }: { params: Record<string, any> }) {
  const values: number[] = params.nodes ?? [8, 3, 10, 1, 6, 14];
  // 简单 BST 布局：按插入构建，按中序计算 x 序，深度计算 y
  const { nodes, links, order } = useMemo(() => {
    type T = { v: number; l?: T; r?: T };
    let root: T | undefined;
    const insert = (t: T | undefined, v: number): T => {
      if (!t) return { v };
      if (v < t.v) t.l = insert(t.l, v); else t.r = insert(t.r, v);
      return t;
    };
    values.forEach((v) => { root = insert(root, v); });
    const ns: N[] = []; const ls: [N, N][] = []; const ord: number[] = [];
    let col = 0;
    const walk = (t: T | undefined, depth: number, parent?: N) => {
      if (!t) return;
      walk(t.l, depth + 1, undefined);
      const node: N = { v: t.v, x: col++ * 60 + 30, y: depth * 70 + 30 };
      ns.push(node); ord.push(t.v);
      if (parent) ls.push([parent, node]);
      // 重新挂左右连线：用回溯方式
      const here = node;
      if (t.l) { const lc = ns.find((n) => n.v === t.l!.v); if (lc) ls.push([here, lc]); }
      walk(t.r, depth + 1, here);
    };
    walk(root, 0);
    return { nodes: ns, links: ls, order: ord };
  }, [values]);

  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep((s) => (s + 1 <= order.length ? s + 1 : s)), 600);
    return () => clearInterval(t);
  }, [order.length]);
  const highlighted = new Set(order.slice(0, step));

  return (
    <div>
      <svg width="100%" height="240" viewBox="0 0 420 240">
        {links.map(([a, b], i) => (
          <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#cbd5e1" />
        ))}
        {nodes.map((n) => (
          <g key={n.v}>
            <circle cx={n.x} cy={n.y} r="16"
              fill={highlighted.has(n.v) ? "#3b82f6" : "#e2e8f0"} />
            <text x={n.x} y={n.y + 4} textAnchor="middle" fontSize="12"
              fill={highlighted.has(n.v) ? "white" : "#334155"}>{n.v}</text>
          </g>
        ))}
      </svg>
      <div className="mt-1 text-sm text-gray-500">
        中序遍历高亮顺序（升序）：{order.slice(0, step).join(" → ")}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 写 LinearAnim.tsx 与 GraphAnim.tsx（P1）**

`frontend/src/components/animations/LinearAnim.tsx`:
```tsx
export default function LinearAnim({ params }: { params: Record<string, any> }) {
  const values: number[] = params.values ?? [5, 2, 8, 1, 9];
  const hi: number = params.index ?? -1;
  return (
    <div>
      <div className="flex gap-1">
        {values.map((v, i) => (
          <div key={i}
            className={`flex h-12 w-12 items-center justify-center rounded border text-sm ${
              i === hi ? "border-blue-500 bg-blue-100 font-bold" : "bg-white"}`}>
            {v}
          </div>
        ))}
      </div>
      <div className="mt-1 text-xs text-gray-500">
        下标访问 arr[{hi}] = {values[hi] ?? "—"}（O(1)）
      </div>
    </div>
  );
}
```

`frontend/src/components/animations/GraphAnim.tsx`:
```tsx
import { useEffect, useMemo, useState } from "react";

export default function GraphAnim({ params }: { params: Record<string, any> }) {
  // params: { nodes: ["A",...], edges: [["A","B"],...], start: "A", mode: "bfs" }
  const nodes: string[] = params.nodes ?? ["A", "B", "C", "D", "E"];
  const edges: [string, string][] = params.edges ??
    [["A", "B"], ["A", "C"], ["B", "D"], ["C", "E"]];
  const start: string = params.start ?? nodes[0];

  const order = useMemo(() => {
    const adj: Record<string, string[]> = {};
    nodes.forEach((n) => (adj[n] = []));
    edges.forEach(([a, b]) => { adj[a].push(b); adj[b].push(a); });
    const seen = new Set([start]); const q = [start]; const out: string[] = [];
    while (q.length) { const x = q.shift()!; out.push(x);
      for (const y of adj[x]) if (!seen.has(y)) { seen.add(y); q.push(y); } }
    return out;
  }, [nodes, edges, start]);

  const pos = useMemo(() => {
    const p: Record<string, { x: number; y: number }> = {};
    nodes.forEach((n, i) => {
      const ang = (i / nodes.length) * Math.PI * 2;
      p[n] = { x: 150 + 100 * Math.cos(ang), y: 120 + 90 * Math.sin(ang) };
    });
    return p;
  }, [nodes]);

  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep((s) => (s + 1 <= order.length ? s + 1 : s)), 600);
    return () => clearInterval(t);
  }, [order.length]);
  const visited = new Set(order.slice(0, step));

  return (
    <div>
      <svg width="100%" height="240" viewBox="0 0 300 240">
        {edges.map(([a, b], i) => (
          <line key={i} x1={pos[a].x} y1={pos[a].y} x2={pos[b].x} y2={pos[b].y} stroke="#cbd5e1" />
        ))}
        {nodes.map((n) => (
          <g key={n}>
            <circle cx={pos[n].x} cy={pos[n].y} r="16"
              fill={visited.has(n) ? "#3b82f6" : "#e2e8f0"} />
            <text x={pos[n].x} y={pos[n].y + 4} textAnchor="middle" fontSize="12"
              fill={visited.has(n) ? "white" : "#334155"}>{n}</text>
          </g>
        ))}
      </svg>
      <div className="mt-1 text-sm text-gray-500">BFS 顺序：{order.slice(0, step).join(" → ")}</div>
    </div>
  );
}
```

- [ ] **Step 4: ResourcePanel 动画 Tab 按 type 分发**

替换 `ResourcePanel.tsx` 中 `{tab === "anim" && (...)}` 块：
```tsx
        {tab === "anim" && (
          <div>
            {viz?.type === "sorting" && <SortingAnim params={viz.params} />}
            {viz?.type === "tree" && <TreeAnim params={viz.params} />}
            {viz?.type === "graph" && <GraphAnim params={viz.params} />}
            {(!viz || viz.type === "linear") && <LinearAnim params={viz?.params ?? {}} />}
          </div>
        )}
```
并在文件顶部加导入：
```tsx
import SortingAnim from "./animations/SortingAnim";
import TreeAnim from "./animations/TreeAnim";
import GraphAnim from "./animations/GraphAnim";
import LinearAnim from "./animations/LinearAnim";
```

- [ ] **Step 5: 构建 + 冒烟验证**

Run: `cd frontend && npm run build`
`npm run dev`，工作台选「排序」点开始学习 → 动画 Tab 看到条形冒泡动画；选「二叉树」→ 看到 BST 节点按中序高亮；选「数组」→ 线性格子高亮。
Expected：三类动画正常播放。

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/
git commit -m "feat: 多模态动画组件 (排序/树/图/线性) 并接入资源面板"
```

---

## Task 16 [P1]: 知识图谱 D3 视图 + 路径规划接线

**Files:**
- Create: `frontend/src/components/KnowledgeGraph.tsx`
- Modify: `frontend/src/App.tsx`（加「知识图谱」视图 + 调用 `/plan`）

**Interfaces:**
- Consumes: `getJSON<Graph>("/knowledge-graph")`、`streamSSE("/plan", {}, onEvent)`
- Produces: `KnowledgeGraph({graph, path, onSelect})`：D3 力导向图，高亮 `path` 节点与连线，点击节点回调 `onSelect(id)`

- [ ] **Step 1: 写 KnowledgeGraph.tsx**

`frontend/src/components/KnowledgeGraph.tsx`:
```tsx
import { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { Graph } from "../types";

interface Props { graph: Graph; path: string[]; onSelect: (id: string) => void; }

export default function KnowledgeGraph({ graph, path, onSelect }: Props) {
  const ref = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const W = 640, H = 420;
    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();
    const pathSet = new Set(path);

    const nodes = graph.points.map((p) => ({ ...p }));
    const links = graph.edges.map(([s, t]) => ({ source: s, target: t }));

    const sim = d3.forceSimulation(nodes as any)
      .force("link", d3.forceLink(links as any).id((d: any) => d.id).distance(90))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(W / 2, H / 2));

    const link = svg.append("g").attr("stroke", "#cbd5e1")
      .selectAll("line").data(links).join("line")
      .attr("stroke-width", (d: any) =>
        pathSet.has(d.source.id ?? d.source) && pathSet.has(d.target.id ?? d.target) ? 3 : 1)
      .attr("stroke", (d: any) =>
        pathSet.has(d.source.id ?? d.source) && pathSet.has(d.target.id ?? d.target) ? "#3b82f6" : "#cbd5e1");

    const node = svg.append("g").selectAll("g").data(nodes).join("g")
      .style("cursor", "pointer")
      .on("click", (_e, d: any) => onSelect(d.id));

    node.append("circle").attr("r", 22)
      .attr("fill", (d: any) => pathSet.has(d.id) ? "#3b82f6" : "#e2e8f0")
      .attr("stroke", "#94a3b8");
    node.append("text").text((d: any) => d.name)
      .attr("text-anchor", "middle").attr("dy", 4).attr("font-size", 11)
      .attr("fill", (d: any) => pathSet.has(d.id) ? "white" : "#334155");

    sim.on("tick", () => {
      link.attr("x1", (d: any) => d.source.x).attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x).attr("y2", (d: any) => d.target.y);
      node.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });
    return () => { sim.stop(); };
  }, [graph, path, onSelect]);

  return <svg ref={ref} width="100%" height="420" viewBox="0 0 640 420" />;
}
```

- [ ] **Step 2: App.tsx 加知识图谱视图 + /plan 调用**

在 `App.tsx`：`type View` 加 `"graph"`；加状态 `const [graph, setGraph] = useState<Graph|null>(null)`、`const [path, setPath] = useState<string[]>([])`、`const [rationale, setRationale] = useState("")`；`useEffect` 里 `getJSON<Graph>("/knowledge-graph").then(setGraph)`；加：
```tsx
async function plan() {
  await streamSSE("/plan", {}, (ev) => {
    if (ev.type === "token") setRationale((r) => r + ev.content);
    if (ev.type === "agent_done" && ev.data?.path) setPath(ev.data.path);
  });
}
```
导航加按钮 `graph`；视图块：
```tsx
{view === "graph" && graph && (
  <div>
    <div className="mb-2 flex items-center gap-2">
      <button onClick={plan} className="rounded bg-blue-500 px-3 py-1 text-sm text-white">
        生成个性化学习路径
      </button>
      <span className="text-sm text-gray-500">{rationale}</span>
    </div>
    <KnowledgeGraph graph={graph} path={path}
      onSelect={(id) => { setKpId(id); setView("workbench"); }} />
  </div>
)}
```
顶部导入 `import KnowledgeGraph from "./components/KnowledgeGraph";` 与 `Graph` 类型；`<select>` 选项在 Task 18 扩展后同步。

- [ ] **Step 3: 构建 + 冒烟验证**

Run: `cd frontend && npm run build`
`npm run dev`，切「知识图谱」→ 看到力导向图；点「生成个性化学习路径」→ 推荐路径节点/连线变蓝、旁边出现规划理由；点节点跳到工作台并自动选中该知识点。

- [ ] **Step 4: Commit**

```bash
git add frontend/src/
git commit -m "feat: 知识图谱 D3 视图与个性化路径规划接线"
```

---

## Task 17 [P1]: 扩展知识图谱与资源到 ~12 个知识点

**Files:**
- Modify: `backend/app/data/knowledge_graph.json`
- Create: `backend/app/data/resources/{linked_list,stack,queue,bst,heap,graph,search_hash,recursion,dynamic_programming}.json`
- Modify: `frontend/src/App.tsx`（工作台 `<select>` 选项由 `/knowledge-graph` 动态生成）

**Interfaces:**
- Consumes/Produces: 不变接口，仅扩充数据。新增知识点须有合法 `viz.type ∈ {linear,sorting,tree,graph}`。

- [ ] **Step 1: 扩展 knowledge_graph.json**

将 `points` 扩充为 12 项（在已有 4 项基础上新增）：
```json
{
  "points": [
    {"id": "array", "name": "数组", "difficulty": 1, "prerequisites": [], "est_minutes": 30, "resource_ref": "resources/array.json"},
    {"id": "linked_list", "name": "链表", "difficulty": 2, "prerequisites": ["array"], "est_minutes": 35, "resource_ref": "resources/linked_list.json"},
    {"id": "stack", "name": "栈", "difficulty": 2, "prerequisites": ["array"], "est_minutes": 25, "resource_ref": "resources/stack.json"},
    {"id": "queue", "name": "队列", "difficulty": 2, "prerequisites": ["array"], "est_minutes": 25, "resource_ref": "resources/queue.json"},
    {"id": "recursion", "name": "递归与分治", "difficulty": 3, "prerequisites": ["array"], "est_minutes": 40, "resource_ref": "resources/recursion.json"},
    {"id": "sorting", "name": "排序", "difficulty": 2, "prerequisites": ["array"], "est_minutes": 45, "resource_ref": "resources/sorting.json"},
    {"id": "binary_tree", "name": "二叉树", "difficulty": 3, "prerequisites": ["linked_list", "recursion"], "est_minutes": 40, "resource_ref": "resources/binary_tree.json"},
    {"id": "bst", "name": "二叉搜索树", "difficulty": 3, "prerequisites": ["binary_tree"], "est_minutes": 40, "resource_ref": "resources/bst.json"},
    {"id": "heap", "name": "堆", "difficulty": 4, "prerequisites": ["binary_tree"], "est_minutes": 45, "resource_ref": "resources/heap.json"},
    {"id": "graph", "name": "图", "difficulty": 4, "prerequisites": ["linked_list", "queue"], "est_minutes": 50, "resource_ref": "resources/graph.json"},
    {"id": "search_hash", "name": "查找与哈希", "difficulty": 3, "prerequisites": ["array"], "est_minutes": 35, "resource_ref": "resources/search_hash.json"},
    {"id": "dynamic_programming", "name": "动态规划", "difficulty": 5, "prerequisites": ["recursion"], "est_minutes": 60, "resource_ref": "resources/dynamic_programming.json"}
  ]
}
```

- [ ] **Step 2: 为 9 个新知识点各写一个资源 bundle**

按 Task 4 的 ResourceBundle 结构，为 `linked_list, stack, queue, recursion, bst, heap, graph, search_hash, dynamic_programming` 各建一个 JSON。每个须含：`explanation_md`（含 LaTeX）、`viz`（选合适 type）、`code`、≥1 道 `question_templates`。viz.type 建议：
- linked_list/stack/queue/search_hash → `linear`
- recursion/dynamic_programming → `linear`（用数组演示状态）
- bst/heap → `tree`
- graph → `graph`（params 含 nodes/edges/start）

示例 `stack.json`:
```json
{
  "id": "stack",
  "explanation_md": "## 栈\n后进先出（LIFO）。仅在栈顶进行 push/pop，均为 $O(1)$。常用于括号匹配、函数调用、DFS。",
  "viz": {"type": "linear", "params": {"structure": "stack", "values": [3, 7, 1], "op": "push", "index": 2}},
  "code": {"language": "python", "source": "s = []\ns.append(1)  # push\ns.append(2)\ns.pop()       # -> 2 (LIFO)"},
  "question_templates": [
    {"stem": "栈的 push 和 pop 时间复杂度？", "answer": "均为 O(1)", "difficulty": 1},
    {"stem": "用栈判断括号是否匹配的思路？", "answer": "左括号入栈，右括号出栈匹配，最终栈空则匹配", "difficulty": 2}
  ]
}
```
示例 `graph.json`（viz 用 graph type）:
```json
{
  "id": "graph",
  "explanation_md": "## 图\n由顶点和边组成。遍历有 BFS（队列）与 DFS（栈/递归）。邻接表空间 $O(V+E)$。",
  "viz": {"type": "graph", "params": {"nodes": ["A","B","C","D","E"], "edges": [["A","B"],["A","C"],["B","D"],["C","E"]], "start": "A", "mode": "bfs"}},
  "code": {"language": "python", "source": "from collections import deque\ndef bfs(adj, s):\n    seen, q, out = {s}, deque([s]), []\n    while q:\n        x = q.popleft(); out.append(x)\n        for y in adj[x]:\n            if y not in seen: seen.add(y); q.append(y)\n    return out"},
  "question_templates": [
    {"stem": "BFS 用什么数据结构？", "answer": "队列", "difficulty": 1},
    {"stem": "邻接表存储图的空间复杂度？", "answer": "O(V+E)", "difficulty": 2}
  ]
}
```
（其余 7 个同理补全，不留空字段。）

- [ ] **Step 3: 后端回归测试**

Run: `cd backend && python -m pytest -v`
Expected: 全 PASS（`test_all_graph_points_with_resource_ref_loadable` 现校验全部 12 个可加载）。

- [ ] **Step 4: 前端工作台下拉改为动态**

`App.tsx`：把工作台里写死的 `<select>` 选项改为基于 `graph?.points` 渲染：
```tsx
<select value={kpId} onChange={(e) => setKpId(e.target.value)}
  className="rounded border px-2 py-1 text-sm">
  {graph?.points.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
</select>
```

- [ ] **Step 5: 构建 + 冒烟验证**

Run: `cd frontend && npm run build`，`npm run dev`。知识图谱视图显示 12 节点；逐一抽查 3 个新知识点能生成讲解/动画/练习。

- [ ] **Step 6: Commit**

```bash
git add backend/app/data/ frontend/src/App.tsx
git commit -m "feat: 扩展至 12 个知识点与配套资源"
```

---

## Task 18 [P2]: SQLite 画像持久化

**Files:**
- Modify: `backend/app/data/repository.py`（加 `SQLiteProfileRepo`，按 `DB_PATH` 选择实现）
- Test: 追加到 `backend/tests/test_repository.py`

**Interfaces:**
- Consumes: `Profile`、`settings.db_path`
- Produces: `SQLiteProfileRepo(db_path)`，方法签名与 `InMemoryProfileRepo` 完全一致；`profile_repo` 改为按 `settings` 选择（无 db_path 或测试时仍可用内存）。

- [ ] **Step 1: 写失败测试（追加）**

追加到 `backend/tests/test_repository.py`:
```python
from app.data.repository import SQLiteProfileRepo
from app.models import Profile


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
```

- [ ] **Step 2: 运行确认失败**

Run: `cd backend && python -m pytest tests/test_repository.py -v`
Expected: FAIL（`SQLiteProfileRepo` 不存在）

- [ ] **Step 3: 实现 SQLiteProfileRepo**

在 `repository.py` 追加（放在 `InMemoryProfileRepo` 之后、`profile_repo` 定义之前）：
```python
import sqlite3


class SQLiteProfileRepo:
    def __init__(self, db_path: str):
        self.db_path = db_path
        with sqlite3.connect(self.db_path) as con:
            con.execute("CREATE TABLE IF NOT EXISTS profiles "
                        "(learner_id TEXT PRIMARY KEY, json TEXT)")

    def get_profile(self, learner_id: str = "demo") -> Profile:
        with sqlite3.connect(self.db_path) as con:
            row = con.execute("SELECT json FROM profiles WHERE learner_id=?",
                              (learner_id,)).fetchone()
        if not row:
            return Profile(learner_id=learner_id)
        return Profile.model_validate_json(row[0])

    def save_profile(self, profile: Profile) -> None:
        with sqlite3.connect(self.db_path) as con:
            con.execute("INSERT INTO profiles(learner_id, json) VALUES(?,?) "
                        "ON CONFLICT(learner_id) DO UPDATE SET json=excluded.json",
                        (profile.learner_id, profile.model_dump_json()))

    def append_history(self, learner_id: str, entry: dict) -> Profile:
        p = self.get_profile(learner_id)
        p.history.append(entry)
        self.save_profile(p)
        return p
```
并把模块底部的 `profile_repo` 定义替换为按配置选择：
```python
def _make_repo():
    try:
        from app.config import settings
        if settings.db_path:
            return SQLiteProfileRepo(settings.db_path)
    except Exception:  # noqa: BLE001  回退内存
        pass
    return InMemoryProfileRepo()


profile_repo = _make_repo()
```

- [ ] **Step 4: 运行确认通过（含全后端回归）**

Run: `cd backend && python -m pytest -v`
Expected: 全 PASS。

- [ ] **Step 5: Commit**

```bash
git add backend/app/data/repository.py backend/tests/test_repository.py
git commit -m "feat: SQLite 画像持久化 (统一仓储接口)"
```

---

## Task 19 [P2]: 练习闭环（标记掌握 → 回写画像 → 重规划）

**Files:**
- Modify: `backend/app/main.py`（加 `POST /api/complete {kp_id}`）
- Test: 追加到 `backend/tests/test_api.py`
- Modify: `frontend/src/components/ResourcePanel.tsx`（练习 Tab 加「标记已掌握」按钮）+ `App.tsx`（完成后刷新画像并重规划）

**Interfaces:**
- Produces: `POST /api/complete {kp_id}` → 把 `kp_id` 加入 profile.mastered、追加 history，返回更新后的 Profile JSON。
- ResourcePanel 新增 prop `onComplete?: (kpId) => void`，由 App 传入。

- [ ] **Step 1: 写失败测试（追加）**

追加到 `backend/tests/test_api.py`:
```python
def test_complete_marks_mastered():
    r = client.post("/api/complete", json={"kp_id": "array"})
    assert r.status_code == 200
    assert "array" in r.json()["mastered"]
```

- [ ] **Step 2: 运行确认失败**

Run: `cd backend && python -m pytest tests/test_api.py::test_complete_marks_mastered -v`
Expected: FAIL

- [ ] **Step 3: 后端加 /api/complete**

在 `main.py` 加：
```python
class CompleteBody(BaseModel):
    kp_id: str


@app.post("/api/complete")
def complete(body: CompleteBody):
    p = profile_repo.get_profile()
    if body.kp_id not in p.mastered:
        p.mastered.append(body.kp_id)
    profile_repo.save_profile(p)
    profile_repo.append_history("demo", {"knowledge_id": body.kp_id, "status": "completed"})
    return profile_repo.get_profile().model_dump()
```

- [ ] **Step 4: 运行确认通过**

Run: `cd backend && python -m pytest tests/test_api.py -v`
Expected: PASS

- [ ] **Step 5: 前端接线**

`ResourcePanel.tsx`：props 加 `onComplete?: (id: string) => void` 与 `kpId: string`；练习 Tab 底部加按钮：
```tsx
{onComplete && (
  <button onClick={() => onComplete(kpId)}
    className="mt-3 rounded bg-green-500 px-3 py-1 text-sm text-white">
    标记已掌握
  </button>
)}
```
`App.tsx`：传入 `kpId={kpId}` 与
```tsx
onComplete={async (id) => {
  const updated = await fetch("/api/complete", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kp_id: id }),
  }).then((r) => r.json());
  setProfile(updated);
  await plan();  // 重新规划路径
}}
```

- [ ] **Step 6: 构建 + 冒烟验证**

`npm run build`；工作台学完一个知识点点「标记已掌握」→ 切到知识图谱看该节点从推荐路径移除、路径重算。

- [ ] **Step 7: Commit**

```bash
git add backend/ frontend/src/
git commit -m "feat: 练习闭环 (标记掌握->回写画像->重规划)"
```

---

## Task 20 [P0]: README 与运行说明

**Files:**
- Create: `README.md`

**Interfaces:** 无代码接口。

- [ ] **Step 1: 写 README.md**

`README.md`（根目录）：
```markdown
# 基于大模型的个性化资源生成与学习多智能体系统

数据结构与算法课程的个性化学习 Web 系统：对话式画像、多 Agent 协同资源生成、个性化路径规划。

## 架构
FastAPI（5 Agent 自写 async 调度 + SSE）+ React/Vite/Tailwind/D3。详见 `docs/superpowers/specs/`。

## 运行

### 后端
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env   # 填入 LLM_BASE_URL / LLM_API_KEY；或设 LLM_PROVIDER=fake 离线演示
uvicorn app.main:app --reload --port 8000
```

### 前端
```bash
cd frontend
npm install
npm run dev   # http://localhost:5173
```

## 测试
```bash
cd backend && python -m pytest -v
```

## LLM 配置
`.env` 中 `LLM_PROVIDER`：
- `openai_compat`：OpenAI 兼容接口（当前用 Claude 中转）
- `spark`：讯飞星火（接入位，见 `app/llm/spark.py`）
- `fake`：离线演示，无需网络

## AI Coding 工具说明
本项目使用 Claude Code（Anthropic）辅助开发：需求澄清、架构设计、代码生成与测试编写。
```

- [ ] **Step 2: 验证文档命令可用**

按 README 跑一遍后端测试与前端构建，确认命令无误。

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: README 与运行说明"
```

---

## 自查（Self-Review）

**Spec 覆盖**：
- §1 三大核心需求 → 画像(Task 8/13)、协同生成(Task 9/10/14)、路径规划(Task 8/16) ✓
- §2 架构/技术栈 → Task 1/11/12 ✓
- §3 五 Agent + 自写调度 → Task 7/8/9/10 ✓
- §4 知识图谱/预烘资源/画像存储 → Task 3/4/5/17/18 ✓
- §5 数据流 → 端到端贯穿 Task 11–16 ✓
- §6 LLM 适配层 → Task 6 ✓
- §7 错误处理（回退预烘/404/容错 JSON）→ Task 4/8/9/11 ✓
- §8 测试策略 → 后端 pytest 全覆盖；前端冒烟 ✓
- §9 项目结构 → Task 文件路径一致 ✓
- §11 优先级分层 → 任务标 P0/P1/P2 ✓
- §12 讯飞合规 → SparkClient 占位(Task 6) + README AI 说明(Task 20) ✓

**占位符扫描**：无 TBD/TODO；动画/组件均给完整代码。`ResourcePanel` 动画占位在 Task 14 明确标注「Task 15 接入」并在 Task 15 替换为真实分发——非遗留占位。

**类型一致性核对**：
- `AgentEvent` 字段 `{agent,type,content,data}` 前后端一致 ✓
- `agent_done.data` 键：profiler→`profile/increment`、planner→`path/rationale`、tutor→`explanation_md`、visualizer→`viz`、quizzer→`questions`，前端 `App.tsx` 取值与之匹配 ✓
- 仓储三方法 `get_profile/save_profile/append_history` 在 InMemory 与 SQLite 实现签名一致 ✓
- API 路径与共享契约表一致 ✓

无遗留问题。
