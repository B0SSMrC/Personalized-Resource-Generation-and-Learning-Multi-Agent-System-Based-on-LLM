# 练习题收藏夹 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让出题 Agent 用 LLM 生成可重复刷新的新题，并支持把练习题收藏到按知识点分组、可管理的收藏夹（侧边栏新视图）。

**Architecture:** 后端加 `FavoriteQuestion` 模型 + `FavoritesRepo`（内存/SQLite，仿 ProfileRepo）+ 4 个收藏 API；出题 Agent 改为 LLM 生成 + 坏 JSON 回退预烘。前端加 favorites 状态、练习题 ⭐ 收藏按钮、收藏夹视图与侧边栏入口。

**Tech Stack:** Python/FastAPI/pydantic/sqlite3/pytest + React18/TS/Vite/Tailwind。

## Global Constraints

- 后端业务逻辑用 pytest + TDD（注入 `FakeLLMClient`，免网络）；前端用 `cd frontend && npm run build` + 手动冒烟（给观察步骤）。项目无前端单测框架，不引入。
- 演示可靠性铁律：出题 LLM 失败/非法/空 → 回退预烘 `question_templates`。
- 不引入新依赖；跟随既有代码风格与既有自定义类/图标。
- 单一 demo 学习者 `learner_id="demo"`；收藏与画像分开存储、互不影响。
- 提交：conventional commits 前缀；消息末尾加 `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`。
- 数据契约：`FavoriteQuestion{id,kp_id,stem,answer,difficulty}`，`id = sha1("{kp_id}|{stem}")[:12]`，由后端计算、幂等去重。

## 文件结构

```
backend/app/models.py            # +FavoriteQuestion
backend/app/data/repository.py   # +fav_id() +InMemoryFavoritesRepo +SQLiteFavoritesRepo +favorites_repo
backend/app/agents/quizzer.py    # 改为 LLM 生成 + _safe_questions 兜底
backend/app/main.py              # +4 个收藏 API
backend/tests/test_favorites.py  # 新增：仓储测试
backend/tests/{test_agents,test_api}.py  # 追加
frontend/src/types.ts            # +FavoriteQuestion
frontend/src/components/icons.tsx        # +IconStar
frontend/src/components/ResourcePanel.tsx # 练习题 ⭐ 按钮
frontend/src/components/FavoritesView.tsx # 新增：收藏夹视图
frontend/src/components/Sidebar.tsx      # +收藏夹菜单项
frontend/src/App.tsx             # favorites 状态/处理 + favorites 视图接线
```

---

## Task 1: 数据模型 + 收藏仓储 `FavoritesRepo`

**Files:**
- Modify: `backend/app/models.py`
- Modify: `backend/app/data/repository.py`
- Test: `backend/tests/test_favorites.py`

**Interfaces:**
- Produces: `FavoriteQuestion(id,kp_id,stem,answer,difficulty)`；`repository.fav_id(kp_id,stem)->str`；`repository.InMemoryFavoritesRepo`/`SQLiteFavoritesRepo`，方法 `list(learner_id="demo")`、`add(learner_id,fav)->FavoriteQuestion`、`remove(learner_id,qid)`、`clear(learner_id,kp_id=None)`；模块单例 `favorites_repo`。

- [ ] **Step 1: 加 `FavoriteQuestion` 模型**

在 `backend/app/models.py` 末尾追加：
```python
class FavoriteQuestion(BaseModel):
    id: str = ""
    kp_id: str
    stem: str
    answer: str = ""
    difficulty: int = 1
```

- [ ] **Step 2: 写失败测试**

`backend/tests/test_favorites.py`:
```python
from app.data.repository import InMemoryFavoritesRepo, fav_id
from app.models import FavoriteQuestion


def test_add_returns_fav_with_derived_id_and_lists():
    repo = InMemoryFavoritesRepo()
    fav = repo.add("demo", FavoriteQuestion(kp_id="array", stem="数组访问复杂度?", answer="O(1)"))
    assert fav.id == fav_id("array", "数组访问复杂度?")
    items = repo.list("demo")
    assert len(items) == 1 and items[0].stem == "数组访问复杂度?"


def test_add_is_idempotent_by_kp_and_stem():
    repo = InMemoryFavoritesRepo()
    repo.add("demo", FavoriteQuestion(kp_id="array", stem="同题", answer="A"))
    repo.add("demo", FavoriteQuestion(kp_id="array", stem="同题", answer="A2"))
    assert len(repo.list("demo")) == 1


def test_remove_one():
    repo = InMemoryFavoritesRepo()
    f = repo.add("demo", FavoriteQuestion(kp_id="array", stem="题1"))
    repo.remove("demo", f.id)
    assert repo.list("demo") == []


def test_clear_by_kp_then_all():
    repo = InMemoryFavoritesRepo()
    repo.add("demo", FavoriteQuestion(kp_id="array", stem="a"))
    repo.add("demo", FavoriteQuestion(kp_id="queue", stem="q"))
    repo.clear("demo", "array")
    assert {f.kp_id for f in repo.list("demo")} == {"queue"}
    repo.clear("demo")
    assert repo.list("demo") == []
```

- [ ] **Step 3: 运行确认失败**

Run: `cd backend && .venv/Scripts/python.exe -m pytest tests/test_favorites.py -v`
Expected: FAIL（`ImportError`：`fav_id` / `InMemoryFavoritesRepo` 不存在）。

- [ ] **Step 4: 实现仓储**

在 `backend/app/data/repository.py` 末尾追加（文件已 `import sqlite3`、已从 `app.models` 导入；补充导入与代码）：
```python
import hashlib

from app.models import FavoriteQuestion


def fav_id(kp_id: str, stem: str) -> str:
    return hashlib.sha1(f"{kp_id}|{stem}".encode("utf-8")).hexdigest()[:12]


class InMemoryFavoritesRepo:
    def __init__(self):
        self._store: dict[str, dict[str, FavoriteQuestion]] = {}

    def list(self, learner_id: str = "demo") -> list[FavoriteQuestion]:
        return list(self._store.get(learner_id, {}).values())

    def add(self, learner_id: str, fav: FavoriteQuestion) -> FavoriteQuestion:
        fav = fav.model_copy(update={"id": fav_id(fav.kp_id, fav.stem)})
        self._store.setdefault(learner_id, {})[fav.id] = fav
        return fav

    def remove(self, learner_id: str, qid: str) -> None:
        self._store.get(learner_id, {}).pop(qid, None)

    def clear(self, learner_id: str, kp_id: str | None = None) -> None:
        store = self._store.get(learner_id)
        if store is None:
            return
        if kp_id is None:
            store.clear()
        else:
            for i in [i for i, f in store.items() if f.kp_id == kp_id]:
                store.pop(i, None)


class SQLiteFavoritesRepo:
    def __init__(self, db_path: str):
        self.db_path = db_path
        with sqlite3.connect(self.db_path) as con:
            con.execute(
                "CREATE TABLE IF NOT EXISTS favorites "
                "(learner_id TEXT, id TEXT, kp_id TEXT, stem TEXT, answer TEXT, "
                "difficulty INTEGER, PRIMARY KEY (learner_id, id))"
            )

    def list(self, learner_id: str = "demo") -> list[FavoriteQuestion]:
        with sqlite3.connect(self.db_path) as con:
            rows = con.execute(
                "SELECT id, kp_id, stem, answer, difficulty FROM favorites WHERE learner_id=?",
                (learner_id,),
            ).fetchall()
        return [FavoriteQuestion(id=r[0], kp_id=r[1], stem=r[2], answer=r[3], difficulty=r[4])
                for r in rows]

    def add(self, learner_id: str, fav: FavoriteQuestion) -> FavoriteQuestion:
        fav = fav.model_copy(update={"id": fav_id(fav.kp_id, fav.stem)})
        with sqlite3.connect(self.db_path) as con:
            con.execute(
                "INSERT OR REPLACE INTO favorites"
                "(learner_id, id, kp_id, stem, answer, difficulty) VALUES(?,?,?,?,?,?)",
                (learner_id, fav.id, fav.kp_id, fav.stem, fav.answer, fav.difficulty),
            )
        return fav

    def remove(self, learner_id: str, qid: str) -> None:
        with sqlite3.connect(self.db_path) as con:
            con.execute("DELETE FROM favorites WHERE learner_id=? AND id=?", (learner_id, qid))

    def clear(self, learner_id: str, kp_id: str | None = None) -> None:
        with sqlite3.connect(self.db_path) as con:
            if kp_id is None:
                con.execute("DELETE FROM favorites WHERE learner_id=?", (learner_id,))
            else:
                con.execute("DELETE FROM favorites WHERE learner_id=? AND kp_id=?",
                            (learner_id, kp_id))


def _make_favorites_repo():
    try:
        from app.config import settings
        if settings.db_path:
            return SQLiteFavoritesRepo(settings.db_path)
    except Exception:  # noqa: BLE001  回退内存
        pass
    return InMemoryFavoritesRepo()


favorites_repo = _make_favorites_repo()
```
（注：`import hashlib` 与 `from app.models import FavoriteQuestion` 放文件顶部已有 import 区也可；放末尾追加块内同样可运行。）

- [ ] **Step 5: 运行确认通过**

Run: `cd backend && .venv/Scripts/python.exe -m pytest tests/test_favorites.py -v`
Expected: PASS（4 个）。

- [ ] **Step 6: Commit**

```bash
git add backend/app/models.py backend/app/data/repository.py backend/tests/test_favorites.py
git commit -m "feat: 收藏题模型与收藏仓储(内存/SQLite)" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: 收藏 API（4 端点）

**Files:**
- Modify: `backend/app/main.py`
- Test: 追加到 `backend/tests/test_api.py`

**Interfaces:**
- Consumes: `favorites_repo`、`FavoriteQuestion`（Task 1）
- Produces: `GET /api/favorites`、`POST /api/favorites`、`POST /api/favorites/delete`、`POST /api/favorites/clear`

- [ ] **Step 1: 写失败测试（追加）**

追加到 `backend/tests/test_api.py`:
```python
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
```

- [ ] **Step 2: 运行确认失败**

Run: `cd backend && .venv/Scripts/python.exe -m pytest tests/test_api.py::test_favorites_add_list_idempotent_delete_clear -v`
Expected: FAIL（404）。

- [ ] **Step 3: 加路由**

在 `backend/app/main.py`：把顶部 `from app.data.repository import profile_repo` 改为
```python
from app.data.repository import profile_repo, favorites_repo
```
并把 `from app.models import Profile` 改为
```python
from app.models import FavoriteQuestion, Profile
```
在 `CompleteBody` 等请求体类附近追加：
```python
class FavoriteBody(BaseModel):
    kp_id: str
    stem: str
    answer: str = ""
    difficulty: int = 1


class FavDeleteBody(BaseModel):
    id: str


class FavClearBody(BaseModel):
    kp_id: str | None = None
```
在 `reset_profile` 端点之后追加：
```python
@app.get("/api/favorites")
def list_favorites():
    return {"favorites": [f.model_dump() for f in favorites_repo.list()]}


@app.post("/api/favorites")
def add_favorite(body: FavoriteBody):
    fav = favorites_repo.add("demo", FavoriteQuestion(
        kp_id=body.kp_id, stem=body.stem, answer=body.answer, difficulty=body.difficulty))
    return fav.model_dump()


@app.post("/api/favorites/delete")
def delete_favorite(body: FavDeleteBody):
    favorites_repo.remove("demo", body.id)
    return {"favorites": [f.model_dump() for f in favorites_repo.list()]}


@app.post("/api/favorites/clear")
def clear_favorites(body: FavClearBody):
    favorites_repo.clear("demo", body.kp_id)
    return {"favorites": [f.model_dump() for f in favorites_repo.list()]}
```

- [ ] **Step 4: 运行确认通过**

Run: `cd backend && .venv/Scripts/python.exe -m pytest tests/test_api.py -v`
Expected: PASS（含新用例与原有用例）。

- [ ] **Step 5: Commit**

```bash
git add backend/app/main.py backend/tests/test_api.py
git commit -m "feat: 收藏夹 API(增/查/删/清)" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: 出题 Agent 改为 LLM 生成 + 预烘兜底

**Files:**
- Modify: `backend/app/agents/quizzer.py`
- Test: 追加到 `backend/tests/test_agents.py`

**Interfaces:**
- Consumes: `self.llm.chat`、`repository.get_resource`
- Produces: `QuizzerAgent.run(kp_id, profile)` 末事件 `agent_done.data = {"questions": [{"stem","answer","difficulty"}...]}`（LLM 生成或回退预烘）

- [ ] **Step 1: 写失败测试（追加）**

追加到 `backend/tests/test_agents.py`:
```python
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
```

- [ ] **Step 2: 运行确认失败**

Run: `cd backend && .venv/Scripts/python.exe -m pytest tests/test_agents.py::test_quizzer_uses_llm_generated_questions -v`
Expected: FAIL（当前 quizzer 不调 LLM，返回预烘的固定题，`len(qs)!=2` 或题干不符）。

- [ ] **Step 3: 重写 quizzer.py**

整体替换 `backend/app/agents/quizzer.py`:
```python
import json
from typing import AsyncIterator

from app.agents.base import BaseAgent
from app.data import repository
from app.models import AgentEvent, Profile

_SYSTEM = (
    "你是出题 Agent。根据给定知识点素材，生成 3 道练习题，紧扣该知识点、难度适中。"
    "仅输出一个 JSON 数组，每个元素形如 "
    '{"stem": "题干", "answer": "答案", "difficulty": 1到5的整数}。'
    "不要输出 JSON 以外的任何内容。"
)


def _safe_questions(text: str):
    """从 LLM 文本中解析题目 JSON 数组；非法/空/缺 stem 则返回 None。"""
    try:
        start, end = text.find("["), text.rfind("]")
        if start < 0 or end <= start:
            return None
        data = json.loads(text[start:end + 1])
    except (json.JSONDecodeError, ValueError):
        return None
    if not isinstance(data, list):
        return None
    out = []
    for item in data:
        if not isinstance(item, dict) or not str(item.get("stem", "")).strip():
            continue
        try:
            diff = int(item.get("difficulty", 1))
        except (TypeError, ValueError):
            diff = 1
        out.append({
            "stem": str(item["stem"]).strip(),
            "answer": str(item.get("answer", "")).strip(),
            "difficulty": diff,
        })
    return out or None


class QuizzerAgent(BaseAgent):
    name = "quizzer"

    async def run(self, kp_id: str, profile: Profile) -> AsyncIterator[AgentEvent]:
        yield self.start()
        bundle = repository.get_resource(kp_id)
        if bundle is None:
            yield self.error(f"无知识点资源：{kp_id}")
            yield self.done({"questions": []})
            return
        prebaked = [q.model_dump() for q in bundle.question_templates]
        questions = None
        try:
            raw = await self.llm.chat([
                {"role": "system", "content": _SYSTEM},
                {"role": "user", "content": f"知识点素材：\n{bundle.explanation_md}"},
            ])
            questions = _safe_questions(raw)
        except Exception:  # noqa: BLE001  回退预烘
            questions = None
        questions = questions or prebaked
        yield self.token(f"已为你出 {len(questions)} 道练习题。")
        yield self.done({"questions": questions})
```

- [ ] **Step 4: 运行确认通过**

Run: `cd backend && .venv/Scripts/python.exe -m pytest tests/test_agents.py -v`
Expected: PASS（含新用例与原有 quizzer 用例；原 `test_quizzer_returns_questions` 因 FakeLLM 默认返回非 JSON 而回退预烘，仍通过）。

- [ ] **Step 5: Commit**

```bash
git add backend/app/agents/quizzer.py backend/tests/test_agents.py
git commit -m "feat: 出题 Agent 改为 LLM 生成新题+预烘兜底" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: 前端 favorites 状态 + 练习题 ⭐ 收藏按钮

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/components/icons.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/ResourcePanel.tsx`

**Interfaces:**
- Produces: `FavoriteQuestion` 类型；App 的 `favorites` 状态与 `toggleFavorite(kpId, q)`；`ResourcePanel` 新 props `favorites`、`onToggleFavorite`。

- [ ] **Step 1: 加类型**

在 `frontend/src/types.ts` 末尾追加：
```ts
export interface FavoriteQuestion {
  id: string;
  kp_id: string;
  stem: string;
  answer: string;
  difficulty: number;
}
```

- [ ] **Step 2: 加 `IconStar`（实心星，颜色表状态）**

在 `frontend/src/components/icons.tsx` 末尾追加：
```tsx
export const IconStar = ({ className = "h-5 w-5" }: IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path d="M12 3.5l2.6 5.27 5.82.85-4.21 4.1.99 5.79L12 16.77l-5.2 2.73.99-5.79-4.21-4.1 5.82-.85z" />
  </svg>
);
```

- [ ] **Step 3: App 加 favorites 状态、加载、toggle，并传给 ResourcePanel**

在 `frontend/src/App.tsx`：
1. 顶部 import 增加类型：把 `import type { AgentEvent, Graph, Profile } from "./types";` 改为
```tsx
import type { AgentEvent, FavoriteQuestion, Graph, Profile } from "./types";
```
2. 在 `const [rationale, setRationale] = useState("");` 之后加状态：
```tsx
  const [favorites, setFavorites] = useState<FavoriteQuestion[]>([]);
```
3. 在初始化 `useEffect`（`getJSON<Profile>("/profile")...`）里追加一行加载收藏：
```tsx
    getJSON<{ favorites: FavoriteQuestion[] }>("/favorites")
      .then((d) => setFavorites(d.favorites))
      .catch(console.error);
```
4. 在 `resetProfile` 函数之后追加 toggle 处理：
```tsx
  async function toggleFavorite(
    kpId: string,
    q: { stem: string; answer: string; difficulty: number },
  ) {
    const existing = favorites.find((f) => f.kp_id === kpId && f.stem === q.stem);
    if (existing) {
      const d = await postJSON<{ favorites: FavoriteQuestion[] }>("/favorites/delete", {
        id: existing.id,
      });
      setFavorites(d.favorites);
    } else {
      const added = await postJSON<FavoriteQuestion>("/favorites", { kp_id: kpId, ...q });
      setFavorites((prev) => (prev.some((f) => f.id === added.id) ? prev : [...prev, added]));
    }
  }
```
5. 找到工作台里渲染 `<ResourcePanel ... />` 的地方，给它增加两个 props：
```tsx
                    favorites={favorites}
                    onToggleFavorite={toggleFavorite}
```
（加在 `onComplete={complete}` 同级。）

- [ ] **Step 4: ResourcePanel 练习题加 ⭐ 按钮**

在 `frontend/src/components/ResourcePanel.tsx`：
1. import 增加：
```tsx
import { IconCheck, IconReplay, IconSparkles, IconStar } from "./icons";
import type { FavoriteQuestion } from "../types";
```
（保留原有从 `./icons` 的导入，合并即可。）
2. `Props` 接口增加：
```tsx
  favorites: FavoriteQuestion[];
  onToggleFavorite: (kpId: string, q: { stem: string; answer: string; difficulty: number }) => void;
```
3. 组件参数解构里加上 `favorites`、`onToggleFavorite`。
4. 在练习题 `questions.map((q, i) => (...))` 的题目头部行里加收藏按钮。把：
```tsx
                    <div className="flex gap-2 text-sm font-medium text-slate-800">
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-violet-100 text-xs text-violet-700">
                        {i + 1}
                      </span>
                      <span>{q.stem}</span>
                    </div>
```
改为：
```tsx
                    <div className="flex items-start gap-2 text-sm font-medium text-slate-800">
                      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md bg-violet-100 text-xs text-violet-700">
                        {i + 1}
                      </span>
                      <span className="flex-1">{q.stem}</span>
                      {(() => {
                        const fav = favorites.some(
                          (f) => f.kp_id === kpId && f.stem === q.stem,
                        );
                        return (
                          <button
                            onClick={() =>
                              onToggleFavorite(kpId, {
                                stem: q.stem,
                                answer: q.answer,
                                difficulty: q.difficulty,
                              })
                            }
                            title={fav ? "取消收藏" : "收藏"}
                            className="shrink-0"
                          >
                            <IconStar
                              className={`h-4 w-4 transition ${
                                fav ? "text-amber-500" : "text-slate-300 hover:text-amber-400"
                              }`}
                            />
                          </button>
                        );
                      })()}
                    </div>
```

- [ ] **Step 5: 构建校验**

Run: `cd frontend && npm run build`
Expected: 构建通过（无类型错误）。

- [ ] **Step 6: 手动冒烟**

Run: `cd frontend && npm run dev`（后端需运行）。进学习工作台「练习」Tab：
Expected: 每道题右侧有星标；点击变实心金色（已收藏），再点变灰（取消）；刷新页面后收藏状态保留（已落库）。

- [ ] **Step 7: Commit**

```bash
git add frontend/src/types.ts frontend/src/components/icons.tsx frontend/src/App.tsx frontend/src/components/ResourcePanel.tsx
git commit -m "feat: 练习题收藏按钮(前端状态+持久化)" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: 收藏夹视图 + 侧边栏入口

**Files:**
- Create: `frontend/src/components/FavoritesView.tsx`
- Modify: `frontend/src/components/Sidebar.tsx`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: `favorites`（Task 4）、`Graph`、`FavoriteQuestion`、`IconStar`
- Produces: `FavoritesView` 组件；App 的 `removeFavorite(id)`、`clearFavorites(kpId?)` 与 `"favorites"` 视图。

- [ ] **Step 1: 新建 `FavoritesView.tsx`**

`frontend/src/components/FavoritesView.tsx`:
```tsx
import type { FavoriteQuestion, Graph } from "../types";
import { IconStar } from "./icons";

interface Props {
  favorites: FavoriteQuestion[];
  graph: Graph | null;
  onRemove: (id: string) => void;
  onClear: (kpId?: string) => void;
}

export default function FavoritesView({ favorites, graph, onRemove, onClear }: Props) {
  const nameOf = (id: string) => graph?.points.find((p) => p.id === id)?.name ?? id;
  const groups: Record<string, FavoriteQuestion[]> = {};
  for (const f of favorites) {
    if (!groups[f.kp_id]) groups[f.kp_id] = [];
    groups[f.kp_id].push(f);
  }
  const kpIds = Object.keys(groups);

  if (favorites.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-violet-200 bg-white/60 p-10 text-center text-slate-400">
        还没有收藏的练习题，去「学习工作台 → 练习」里点 ⭐ 收藏吧。
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button
          onClick={() => {
            if (window.confirm("确定清空全部收藏吗？")) onClear();
          }}
          className="rounded-full border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-500 transition hover:bg-rose-50"
        >
          全部清空
        </button>
      </div>
      <div className="space-y-5">
        {kpIds.map((kid) => (
          <section key={kid} className="rounded-2xl border border-violet-100 bg-white p-4 shadow-soft">
            <header className="mb-3 flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-amber-100 text-amber-600">
                <IconStar className="h-4 w-4" />
              </span>
              <h3 className="font-heading text-base font-semibold text-indigo-950">{nameOf(kid)}</h3>
              <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs text-violet-600">
                {groups[kid].length} 题
              </span>
              <button
                onClick={() => onClear(kid)}
                className="ml-auto text-xs text-slate-400 transition hover:text-rose-500"
              >
                清空本知识点
              </button>
            </header>
            <ul className="space-y-2.5">
              {groups[kid].map((f) => (
                <li key={f.id} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5">
                  <div className="flex items-start gap-2 text-sm font-medium text-slate-800">
                    <span className="flex-1">{f.stem}</span>
                    <button
                      onClick={() => onRemove(f.id)}
                      className="shrink-0 text-xs text-slate-400 transition hover:text-rose-500"
                    >
                      移除
                    </button>
                  </div>
                  <details className="mt-2 text-sm text-slate-600">
                    <summary className="cursor-pointer text-violet-600 hover:text-violet-700">
                      查看答案
                    </summary>
                    <div className="mt-1">{f.answer || "（无）"}</div>
                  </details>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Sidebar 加「收藏夹」菜单项**

在 `frontend/src/components/Sidebar.tsx`：
1. `type View = "profile" | "graph" | "workbench";` 改为
```tsx
type View = "profile" | "graph" | "workbench" | "favorites";
```
2. import 增加 `IconStar`（合并到既有 `./icons` 导入）。
3. `META` 数组末尾追加：
```tsx
  { id: "favorites", label: "收藏夹", icon: IconStar },
```
4. 在 `bodyFor` 函数里，`return (...)`（最后那个 workbench 分支）之前，加一个 favorites 分支：
```tsx
    if (id === "favorites")
      return (
        <div className="text-xs leading-relaxed text-violet-200/80">
          你收藏的练习题在右侧按知识点分组展示，可移除或清空。
        </div>
      );
```

- [ ] **Step 3: App 加 favorites 视图与处理函数**

在 `frontend/src/App.tsx`：
1. `type View = "profile" | "graph" | "workbench";` 改为
```tsx
type View = "profile" | "graph" | "workbench" | "favorites";
```
2. import 增加收藏夹组件：
```tsx
import FavoritesView from "./components/FavoritesView";
```
3. 在 `toggleFavorite` 之后追加：
```tsx
  async function removeFavorite(id: string) {
    const d = await postJSON<{ favorites: FavoriteQuestion[] }>("/favorites/delete", { id });
    setFavorites(d.favorites);
  }

  async function clearFavorites(kpId?: string) {
    const d = await postJSON<{ favorites: FavoriteQuestion[] }>("/favorites/clear", {
      kp_id: kpId ?? null,
    });
    setFavorites(d.favorites);
  }
```
4. 在工作台视图 `{view === "workbench" && (...)}` 之后，追加收藏夹视图：
```tsx
          {view === "favorites" && (
            <section>
              <header className="mb-5">
                <div className="text-xs font-semibold uppercase tracking-widest text-violet-500">
                  模块 04
                </div>
                <h1 className="mt-1 font-heading text-3xl font-bold">
                  练习题<span className="text-gradient">收藏夹</span>
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  收藏的练习题按知识点分组，可移除或清空。
                </p>
              </header>
              <FavoritesView
                favorites={favorites}
                graph={graph}
                onRemove={removeFavorite}
                onClear={clearFavorites}
              />
            </section>
          )}
```

- [ ] **Step 4: 构建校验**

Run: `cd frontend && npm run build`
Expected: 构建通过。

- [ ] **Step 5: 手动冒烟**

Run: `cd frontend && npm run dev`（后端运行）。
Expected:
- 左侧菜单出现「收藏夹」；在工作台练习里收藏几道题后，点「收藏夹」→ 题目按知识点分组显示，每题可「查看答案」「移除」；每组「清空本知识点」、顶部「全部清空」生效；无收藏时显示空状态。
- 工作台练习点「重新生成」→ 出现新题（LLM 生成），仍可继续收藏。

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/FavoritesView.tsx frontend/src/components/Sidebar.tsx frontend/src/App.tsx
git commit -m "feat: 收藏夹视图与侧边栏入口(按知识点分组+管理)" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## 自检（spec 覆盖 / 占位 / 类型一致性）

- **spec §3 数据模型** → Task 1 Step 1 ✅
- **spec §4 FavoritesRepo** → Task 1 Step 4（内存/SQLite/单例/list/add/remove/clear）✅
- **spec §5 API（4 端点）** → Task 2 ✅
- **spec §6 出题 Agent LLM 生成 + 兜底** → Task 3（`_safe_questions` + `questions or prebaked`）✅
- **spec §7.1 类型/状态** → Task 4 Step 1/3 ✅
- **spec §7.2 收藏按钮** → Task 4 Step 4 ✅
- **spec §7.3 收藏夹视图 + 侧边栏** → Task 5 ✅
- **spec §8 边界**（LLM 兜底/幂等/删不存在静默/空状态/与画像独立）→ Task 1（幂等）、Task 3（兜底）、Task 5（空状态）✅
- **类型一致性**：`FavoriteQuestion{id,kp_id,stem,answer,difficulty}` 后端（models）与前端（types）字段一致；`favorites_repo.add/remove/clear/list`、`fav_id` 名称在 Task 1 定义、Task 2 消费一致；前端 `favorites`/`toggleFavorite`/`removeFavorite`/`clearFavorites`、`/api/favorites(/delete|/clear)` 路径在各任务间一致；`onToggleFavorite(kpId,q)` 签名 Task 4 定义并使用。
- **占位扫描**：无 TBD/TODO；每个代码步骤含完整代码、精确路径、命令与预期。
