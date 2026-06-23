# 练习题收藏夹 — 设计文档

- **日期**：2026-06-22
- **分支**：`feature/favorites`
- **范围**：后端（出题 Agent 改造 + 收藏仓储 + API）+ 前端（收藏按钮 + 收藏夹视图 + 侧边栏入口）

## 1. 背景与目标

当前出题 Agent 只返回每个知识点固定的 1–2 道预烘题，每次「重新生成」结果相同，练习价值有限。本功能：

1. **出题 Agent 用 LLM（星火）真生成新题**——每次「重新生成」产出不同题目；LLM 失败/非法时回退预烘题（演示铁律）。
2. **练习题收藏夹**——用户可收藏任意练习题；收藏夹按知识点分类展示；可删除管理；作为侧边栏第 4 个主视图。

## 2. 非目标

- 不做收藏题的「文本编辑」与「手动新增自定义题」（编辑 = 删除/管理）。
- 不做多用户/登录（沿用单一 demo 学习者 `learner_id="demo"`）。
- 不引入新依赖。

## 3. 数据模型

`FavoriteQuestion`（pydantic，`models.py`）：
```python
class FavoriteQuestion(BaseModel):
    id: str        # = sha1(f"{kp_id}|{stem}")[:12]，收藏同题幂等去重
    kp_id: str
    stem: str
    answer: str = ""
    difficulty: int = 1
```
`id` 由 `kp_id + stem` 派生，保证同一道题重复收藏不产生副本。

## 4. 存储：`FavoritesRepo`

仿照现有 `ProfileRepo`，在 `repository.py` 内提供内存 + SQLite 双实现 + 模块单例 `favorites_repo`（依 `settings.db_path` 选择，与画像同库）。

SQLite 表：
```sql
CREATE TABLE IF NOT EXISTS favorites (
  learner_id TEXT, id TEXT, kp_id TEXT, stem TEXT, answer TEXT, difficulty INTEGER,
  PRIMARY KEY (learner_id, id)
);
```
接口：
- `list(learner_id="demo") -> list[FavoriteQuestion]`
- `add(learner_id, fav: FavoriteQuestion) -> None`（`INSERT OR REPLACE`，幂等）
- `remove(learner_id, fav_id: str) -> None`
- `clear(learner_id, kp_id: str | None = None) -> None`（kp_id 为空清空全部，否则只清该知识点）

## 5. 后端 API（全用 GET/POST，匹配现有 client）

| 方法 | 路径 | 请求体 | 返回 |
|---|---|---|---|
| GET | `/api/favorites` | — | `{"favorites": [FavoriteQuestion...]}`（平铺，前端按 kp 分组） |
| POST | `/api/favorites` | `{kp_id, stem, answer, difficulty}` | 新增后的 `FavoriteQuestion`（含 id） |
| POST | `/api/favorites/delete` | `{id}` | `{"favorites": [...]}`（删后全量） |
| POST | `/api/favorites/clear` | `{kp_id?: str\|null}` | `{"favorites": [...]}`（清后全量） |

新增收藏时后端用 `kp_id+stem` 计算 `id`，无需前端传。

## 6. 出题 Agent 改造（LLM 生成 + 兜底）

`QuizzerAgent.run(kp_id, profile)`：
1. `bundle = get_resource(kp_id)`；`bundle is None` → 沿用现状（error + 空）。
2. `prebaked = [q.model_dump() for q in bundle.question_templates]`（兜底集）。
3. 调 `self.llm.chat`：系统提示「你是出题 Agent，根据知识点素材生成 3 道练习题，仅输出 JSON 数组 `[{stem, answer, difficulty}]`，紧扣知识点、难度适中、只输出 JSON」；user 传入 `bundle.explanation_md`（让模型知道知识点内容）。
4. `_safe_questions(text)`：截取首个 `[` 到末个 `]`、`json.loads`，校验为「含非空 stem 的对象列表」；任一步失败 → 返回 None。
5. `questions = parsed or prebaked`（LLM 失败/非法/空 → 回退预烘）。
6. `yield self.token(...)`；`yield self.done({"questions": questions})`。

> 现有工作台「练习」Tab 的「重新生成」按钮（`onGenerate("quizzer")`）无需改动，改造后它每次即产出新题。
> lite 出题质量有限，兜底保证不白屏；更佳质量同样建议 Pro/Max。

## 7. 前端

### 7.1 类型与状态
- `types.ts` 增 `FavoriteQuestion`。
- `App.tsx` 持有 `favorites: FavoriteQuestion[]`；挂载时 `getJSON("/favorites")`；提供 `toggleFavorite(kpId, q)`、`removeFavorite(id)`、`clearFavorites(kpId?)`，均调用对应 API 后用返回的全量列表 `setFavorites`。`view` 类型增加 `"favorites"`。

### 7.2 收藏按钮（学习工作台「练习」Tab）
`ResourcePanel` 练习区每道题加一个 ⭐ 收藏/取消按钮：
- 是否已收藏 = `favorites` 中存在 `kp_id===当前kp && stem===该题stem`；
- 点击调 `onToggleFavorite(kpId, q)`（已收藏则取消、未收藏则收藏）；
- 已收藏高亮（实心星 + 紫色）。
- 新增 props：`favorites`、`onToggleFavorite`。

### 7.3 收藏夹视图（侧边栏新入口）
- `Sidebar` 的 `META` 增加 `{ id: "favorites", label: "收藏夹", icon: IconStar }`（新增 `IconStar`）。
- 新组件 `components/FavoritesView.tsx`：props `{ favorites, graph, onRemove, onClear }`。
  - 按 `kp_id` 分组（组标题用 `graph` 里的知识点名，可折叠）；
  - 每题卡片：题干 + `<details>查看答案` + 「移除」按钮（`onRemove(id)`）；
  - 每组右上「清空本知识点」(`onClear(kpId)`)；视图顶部「全部清空」(`onClear()`)（带 `confirm`）；
  - 空状态：「还没有收藏的练习题，去学习工作台的『练习』里点 ⭐ 收藏吧」。
- `App.tsx` 在 `view==="favorites"` 时渲染 `FavoritesView`。

## 8. 错误处理与边界

- 出题 LLM 失败/非法 JSON/空 → 回退预烘题。
- 收藏幂等（同 `kp_id+stem` 不重复）。
- 删除不存在的 id → 静默无操作。
- 收藏夹为空 → 友好空状态。
- 「重置画像」不影响收藏夹（二者独立存储）。

## 9. 测试

- **后端 TDD（pytest，注入 FakeLLM）**：
  - `tests/test_favorites.py`：`FavoritesRepo` 增/查/删/按 kp 清/全清/同题去重。
  - `tests/test_agents.py`（追加）：quizzer——FakeLLM 返回合法 JSON → 用生成题；返回坏 JSON/空 → 回退预烘题；`get_resource` 为 None → 空且不抛。
  - `tests/test_api.py`（追加）：`GET/POST /api/favorites`、`/delete`、`/clear` 行为正确。
- **前端**：`npm run build` + 手动冒烟（练习里点 ⭐ 收藏 → 进收藏夹见按知识点分组 → 移除/清空生效 → 重新生成出新题且可继续收藏）。

## 10. 文件改动清单

**后端**
- 修改：`backend/app/models.py`（+`FavoriteQuestion`）
- 修改：`backend/app/data/repository.py`（+`FavoritesRepo`/`InMemory`+`SQLite`/单例）
- 修改：`backend/app/agents/quizzer.py`（LLM 生成 + `_safe_questions` 兜底）
- 修改：`backend/app/main.py`（+4 个收藏 API）
- 新增：`backend/tests/test_favorites.py`；追加 `test_agents.py` / `test_api.py`

**前端**
- 修改：`frontend/src/types.ts`（+`FavoriteQuestion`）
- 修改：`frontend/src/App.tsx`（favorites 状态/处理函数 + `favorites` 视图 + 接线）
- 修改：`frontend/src/components/ResourcePanel.tsx`（练习题 ⭐ 收藏按钮）
- 修改：`frontend/src/components/Sidebar.tsx`（收藏夹菜单项）
- 修改：`frontend/src/components/icons.tsx`（+`IconStar`）
- 新增：`frontend/src/components/FavoritesView.tsx`
