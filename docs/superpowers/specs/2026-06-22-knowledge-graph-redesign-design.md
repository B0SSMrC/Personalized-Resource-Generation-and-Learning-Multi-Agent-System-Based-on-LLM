# 知识图谱模块重设计 — 设计文档

- **日期**：2026-06-22
- **范围**：前端视图② 知识图谱（`frontend/src/components/KnowledgeGraph.tsx` 及相关接线）
- **替换对象**：现有 D3 力导向网络图
- **后端改动**：无（复用现有 `/api/knowledge-graph`、`/api/plan`、画像数据）

## 1. 背景与目标

现有知识图谱用 D3 力导向布局，节点位置每次随机收敛，先修逻辑看不出来、画像与推荐也没在图上体现，评委与用户"一看不懂"。

本次重设计目标：

1. 换成**逻辑结构清晰、一看就懂**的结构 —— 按先修关系分层的"技能树"。
2. 图谱**由画像驱动**：用 profiler 抽出的已掌握/薄弱点实时给节点着色。
3. 据画像**直接给出个性化推荐**：高亮规划 Agent 的推荐顺序与"下一步该学什么"。

### 非目标

- 不改后端数据结构与接口。
- 不引入新的图布局库（不上 d3-dag 等）；分层用自写纯函数。
- 不做拖拽编辑、缩放平移等重交互。

## 2. 数据输入（均已存在）

- `graph.points`：12 个知识点，每个含 `{id, name, difficulty(1-5), prerequisites[], est_minutes, resource_ref}`。
- `graph.edges`：先修对 `[from, to]`（由 prerequisites 推导）。
- `profile`：`{mastered[], weak_points[], goal, preference, pace}`，其中 `mastered`/`weak_points` 已是 canonical id。
- `path`：规划 Agent 输出的有序推荐 id 列表（已排除已掌握、就绪节点中薄弱优先+难度优先，满足拓扑序）。
- `rationale`：规划 Agent 的文字理由。

## 3. 结构与布局

### 3.1 分层算法 `computeTiers(points)`（纯函数）

- 每个节点的**层号 = 最长先修链深度**：`depth(p) = 0` 若无先修，否则 `max(depth(pre) for pre in prerequisites) + 1`。
  - 这样保证节点一定排在其**全部**先修的下方，连线始终向下，不出现回连。
  - 用记忆化递归计算；先修引用图中不存在的 id 时忽略该先修（防御）。
- **层内顺序**：保持 `graph.points` 原始顺序（确定性）。12 节点规模下交叉很少，后续如需再做重心排序优化。
- 按真实数据，分层结果为 **1-6-3-2**：
  - Lv0：`array`
  - Lv1：`linked_list, stack, queue, recursion, sorting, search_hash`
  - Lv2：`binary_tree, graph, dynamic_programming`
  - Lv3：`bst, heap`
- 输出：每个节点的 `{tier, col, x, y}` 坐标（层号→y，层内序→x，居中分布）。

### 3.2 渲染

- **节点 = 绝对定位的 HTML 卡片**（便于 Tailwind 着色、徽标、hover 浮层）。
- **连线 = 背景 SVG 层**：每条先修边画一条从父节点底部到子节点顶部的平滑曲线（cubic）。
- 容器响应式：固定逻辑宽高 + 等比缩放适配，窄屏可横向滚动。
- **彻底移除 D3**：力导向相关代码删除；`d3` 仅此组件引用，连同 `package.json` 依赖一并移除（减重）。

## 4. 画像驱动的节点状态

每个节点按当前画像实时判定状态（纯前端计算，规则确定）：

| 状态 | 判定 | 样式 |
|---|---|---|
| ✅ 已掌握 | `id ∈ mastered` | 绿色 + 对勾，淡化但仍显示（保持地图完整） |
| 🔓 就绪可学 | 未掌握 且 所有先修 ∈ mastered | 正常紫色、可点、轻边框 |
| 🔒 未解锁 | 未掌握 且 ∃ 先修 ∉ mastered | 灰色 + 锁图标、低透明度 |
| 🔴 薄弱点 | `id ∈ weak_points` | 右上角红色角标，**叠加**在上述状态之上 |

## 5. 个性化推荐呈现（核心）

- **推荐顺序徽标**：`path` 中的节点按其在 path 中的次序打 `①②③…` 序号徽标。徽标对 path 中**所有**节点都标（含当前还锁定的）——序号表示"计划学习次序"，锁定样式表示"先修未满足"，二者叠加正好表达"这是第 3 步、但要先完成前置"。
- **下一步高亮**：`path[0]`（当前最该学，必为就绪态）额外加 ⭐ 光晕描边。
- **顶部推荐卡**：图谱上方一张卡片「📍 下一步推荐：<path[0] 名称>」+ 一行理由（复用 `rationale` 截断）+「去学习」按钮（点击 = `openKp(path[0])` 进工作台）。
- **保留**现有规划理由文字框。
- **自动规划**：进入知识图谱视图时，若已有非空画像且 `path` 为空，自动触发一次 `plan()`，让推荐自动呈现（无需多点一次）；保留手动「重新规划」按钮。

## 6. 交互

- 点击 **就绪/已掌握** 节点 → `openKp(id)` 进入学习工作台（沿用现状）。
- 点击 **未解锁** 节点 → 同样可进入，但 hover 时浮层提示「建议先学：<未满足的先修名>」。
- hover 任意节点 → 小浮层显示：难度、预计时长、先修列表、当前状态。

## 7. 组件架构

- `frontend/src/lib/tiers.ts`（新增）：`computeTiers(points, opts?)` 纯函数 + 状态判定辅助 `nodeState(id, profile)` / `isLocked(point, masteredSet)`。单一职责、可独立测试。
- `frontend/src/components/KnowledgeGraph.tsx`（重写）：消费 `graph / path / profile`，调用 `computeTiers`，渲染 SVG 连线层 + HTML 节点卡 + 顶部推荐卡。新增 `profile` prop。
- `frontend/src/App.tsx`（小改）：给 `<KnowledgeGraph>` 传 `profile`；在 `graph` 视图挂载时按条件自动 `plan()`。
- 可选：节点卡、推荐卡、hover 浮层拆为同文件内小组件，保持单文件聚焦。

### Props 契约

```ts
interface KnowledgeGraphProps {
  graph: Graph;
  path: string[];
  profile: Profile | null;
  onSelect: (id: string) => void;
}
```

## 8. 错误与边界

- `path` 为空（全部已掌握 / 尚未规划）：不显示序号徽标与推荐卡，仅按 mastered 着色；给出「点击生成个性化学习路径」提示。
- `profile` 为 null：全部按"未掌握"渲染，Lv0 就绪、其余按先修锁定。
- 先修 id 不存在于图中：忽略该先修（不影响分层与锁定判定）。
- 数据假定无环（先修构成 DAG）；`computeTiers` 记忆化时对意外环做访问保护，避免无限递归。

## 9. 测试

沿用项目前端约定（构建 + 手动冒烟），并把可测逻辑下沉为纯函数：

- **纯函数**：`computeTiers` / `nodeState` 逻辑清晰，便于将来补单测（本期至少保证类型与构建通过）。
- **手动冒烟步骤**：
  1. `npm run dev` 进入「知识图谱」视图 → 见 1-6-3-2 四层、连线向下、布局稳定不乱跳。
  2. 通过对话画像标记若干已掌握/薄弱点后回到图谱 → 已掌握节点打勾淡化、先修未满足的置灰带锁、薄弱点红角标。
  3. 顶部出现「下一步推荐：X」卡片，`path[0]` 节点有 ⭐ 高亮、推荐节点带 ①②③ 序号。
  4. 点「去学习」/点就绪节点 → 跳转学习工作台对应知识点；hover 锁定节点 → 显示先修提示。
- 构建校验：`npm run build`（tsc + vite）通过。

## 10. 文件改动清单

- 新增：`frontend/src/lib/tiers.ts`
- 重写：`frontend/src/components/KnowledgeGraph.tsx`
- 小改：`frontend/src/App.tsx`（传 profile + 自动规划）
- 移除：`package.json` 中 `d3` 与 `@types/d3` 依赖（及组件内 d3 引用）
