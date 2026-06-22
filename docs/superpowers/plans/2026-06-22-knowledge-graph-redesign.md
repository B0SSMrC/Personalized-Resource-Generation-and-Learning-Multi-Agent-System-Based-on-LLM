# 知识图谱重设计 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把知识图谱视图从 D3 力导向网络图换成"按先修分层、由画像驱动、带个性化推荐"的技能树。

**Architecture:** 纯前端改造。新增纯函数 `lib/tiers.ts` 算分层布局与节点状态；`KnowledgeGraph.tsx` 重写为「HTML 节点卡 + 背景 SVG 连线」；`App.tsx` 传入画像并在进入视图时自动规划；移除 D3 依赖。后端零改动。

**Tech Stack:** React 18 / TypeScript / Vite / TailwindCSS（不再用 D3）。

## Global Constraints

- 前端验证方式：`cd frontend && npm run build`（tsc + vite，类型与构建必须通过）+ 手动冒烟（给出观察步骤）。项目无前端单测框架，不引入。
- 跟随既有代码风格：函数组件 + Tailwind 原子类；复用既有自定义类 `app-bg / sidebar-bg / text-gradient / shadow-soft / shadow-glow / animate-rise / font-heading`、既有图标组件（`./icons`）。
- Node 18+。
- 提交：conventional commits 前缀（feat/refactor/chore）；消息末尾加 `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`。（实际 git 提交时机听用户指令。）
- 数据契约不变：`KnowledgePoint{id,name,difficulty,prerequisites,est_minutes,resource_ref}`、`Profile{mastered[],weak_points[],...}`（均为 canonical id）、`path` 为规划 Agent 的有序 id 列表。

## 文件结构

```
frontend/src/
  lib/tiers.ts            # 新增：分层布局 computeTiers + 状态判定（纯函数）
  components/
    KnowledgeGraph.tsx    # 重写：技能树渲染（节点卡 + SVG 连线 + 推荐覆盖层）
    icons.tsx             # 修改：新增 IconLock
  App.tsx                 # 修改：给 KnowledgeGraph 传 profile + 进入视图自动规划
frontend/package.json     # 修改：移除 d3 / @types/d3
```

---

## Task 1: 分层布局与状态纯函数 `lib/tiers.ts`

**Files:**
- Create: `frontend/src/lib/tiers.ts`

**Interfaces:**
- Consumes: `KnowledgePoint`（`../types`）
- Produces:
  - `NODE_W: number`、`NODE_H: number`（常量，供组件定位连线锚点复用）
  - `computeTiers(points: KnowledgePoint[]): TierLayout`，`TierLayout = { nodes: LaidOutNode[]; posById: Record<string,{x:number;y:number}>; width:number; height:number }`，`LaidOutNode = { point: KnowledgePoint; x:number; y:number; tier:number }`（x/y 为节点卡左上角坐标）
  - `type NodeStatus = "mastered" | "ready" | "locked"`
  - `unmetPrereqs(point: KnowledgePoint, mastered: Set<string>): string[]`（返回未掌握的先修 id）
  - `nodeStatus(point: KnowledgePoint, mastered: Set<string>): NodeStatus`

- [ ] **Step 1: 写 `lib/tiers.ts`**

`frontend/src/lib/tiers.ts`:
```ts
import type { KnowledgePoint } from "../types";

// 节点卡尺寸与间距（组件定位连线锚点时复用 NODE_W/NODE_H）
export const NODE_W = 124;
export const NODE_H = 54;
const H_GAP = 24;
const V_GAP = 66;
const PAD = 28;

export interface LaidOutNode {
  point: KnowledgePoint;
  x: number; // 左上角
  y: number;
  tier: number;
}

export interface TierLayout {
  nodes: LaidOutNode[];
  posById: Record<string, { x: number; y: number }>;
  width: number;
  height: number;
}

/** 按先修关系分层：层号 = 最长先修链深度，保证节点排在其全部先修下方。 */
export function computeTiers(points: KnowledgePoint[]): TierLayout {
  const byId = new Map(points.map((p) => [p.id, p]));
  const memo = new Map<string, number>();

  function depth(id: string, stack: Set<string>): number {
    const cached = memo.get(id);
    if (cached !== undefined) return cached;
    const p = byId.get(id);
    if (!p || p.prerequisites.length === 0) {
      memo.set(id, 0);
      return 0;
    }
    if (stack.has(id)) return 0; // 防御：先修出现环时退化为 0
    stack.add(id);
    let d = 0;
    for (const pre of p.prerequisites) {
      if (byId.has(pre)) d = Math.max(d, depth(pre, stack) + 1);
    }
    stack.delete(id);
    memo.set(id, d);
    return d;
  }

  const tiers: KnowledgePoint[][] = [];
  for (const p of points) {
    const d = depth(p.id, new Set());
    if (!tiers[d]) tiers[d] = [];
    tiers[d].push(p); // 层内保持输入顺序
  }

  const rowWidths = tiers.map(
    (row) => row.length * NODE_W + (row.length - 1) * H_GAP,
  );
  const width = Math.max(...rowWidths) + PAD * 2;
  const height = PAD * 2 + tiers.length * NODE_H + (tiers.length - 1) * V_GAP;

  const nodes: LaidOutNode[] = [];
  const posById: Record<string, { x: number; y: number }> = {};
  tiers.forEach((row, t) => {
    const startX = (width - rowWidths[t]) / 2;
    const y = PAD + t * (NODE_H + V_GAP);
    row.forEach((p, i) => {
      const x = startX + i * (NODE_W + H_GAP);
      nodes.push({ point: p, x, y, tier: t });
      posById[p.id] = { x, y };
    });
  });

  return { nodes, posById, width, height };
}

export type NodeStatus = "mastered" | "ready" | "locked";

export function unmetPrereqs(
  point: KnowledgePoint,
  mastered: Set<string>,
): string[] {
  return point.prerequisites.filter((pre) => !mastered.has(pre));
}

export function nodeStatus(
  point: KnowledgePoint,
  mastered: Set<string>,
): NodeStatus {
  if (mastered.has(point.id)) return "mastered";
  return unmetPrereqs(point, mastered).length === 0 ? "ready" : "locked";
}
```

- [ ] **Step 2: 类型/构建校验**

Run: `cd frontend && npm run build`
Expected: 构建通过（tsc 无类型错误）。该模块尚未被引用，本步仅保证类型正确；其行为将在 Task 2 的渲染中实测（应得 1-6-3-2 四层）。

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/tiers.ts
git commit -m "feat(graph): 知识点分层布局与状态判定纯函数"
```

---

## Task 2: 重写 `KnowledgeGraph.tsx`（分层树 + 连线 + 画像状态 + hover）

**Files:**
- Modify: `frontend/src/components/icons.tsx`（新增 `IconLock`）
- Modify: `frontend/src/components/KnowledgeGraph.tsx`（整体重写）
- Modify: `frontend/src/App.tsx`（给 `<KnowledgeGraph>` 传 `profile`）

**Interfaces:**
- Consumes: `computeTiers / nodeStatus / unmetPrereqs / NODE_W / NODE_H / NodeStatus`（Task 1）、`Graph / Profile`（`../types`）、`IconCheck / IconLock`（`./icons`）
- Produces: `KnowledgeGraph` 组件，props `{ graph: Graph; path: string[]; profile: Profile | null; onSelect: (id:string)=>void }`（本任务先不使用 `path`，Task 3 接入推荐覆盖层）

- [ ] **Step 1: 给 `icons.tsx` 新增 `IconLock`**

在 `frontend/src/components/icons.tsx` 末尾（`IconReplay` 之后）追加：
```tsx
export const IconLock = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4.5" y="11" width="15" height="9" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </Svg>
);
```

- [ ] **Step 2: 重写 `KnowledgeGraph.tsx`（不含推荐层）**

整体替换 `frontend/src/components/KnowledgeGraph.tsx`:
```tsx
import { useMemo } from "react";
import type { Graph, Profile } from "../types";
import {
  computeTiers,
  nodeStatus,
  unmetPrereqs,
  NODE_W,
  NODE_H,
} from "../lib/tiers";
import type { NodeStatus } from "../lib/tiers";
import { IconCheck, IconLock } from "./icons";

interface Props {
  graph: Graph;
  path: string[];
  profile: Profile | null;
  onSelect: (id: string) => void;
}

const STATUS_CARD: Record<NodeStatus, string> = {
  mastered: "border-emerald-200 bg-emerald-50/70 text-emerald-900",
  ready:
    "border-violet-300 bg-white text-indigo-950 hover:border-violet-400 hover:shadow-glow",
  locked: "border-slate-200 bg-slate-50 text-slate-400",
};

export default function KnowledgeGraph({ graph, profile, onSelect }: Props) {
  const { nodes, posById, width, height } = useMemo(
    () => computeTiers(graph.points),
    [graph.points],
  );
  const mastered = useMemo(
    () => new Set(profile?.mastered ?? []),
    [profile],
  );
  const weak = useMemo(() => new Set(profile?.weak_points ?? []), [profile]);

  return (
    <div className="w-full overflow-x-auto">
      <div className="relative mx-auto" style={{ width, height }}>
        {/* 先修连线层 */}
        <svg
          className="pointer-events-none absolute inset-0"
          width={width}
          height={height}
        >
          {graph.edges.map(([from, to]) => {
            const a = posById[from];
            const b = posById[to];
            if (!a || !b) return null;
            const x1 = a.x + NODE_W / 2;
            const y1 = a.y + NODE_H;
            const x2 = b.x + NODE_W / 2;
            const y2 = b.y;
            const dy = (y2 - y1) / 2;
            return (
              <path
                key={`${from}-${to}`}
                d={`M ${x1} ${y1} C ${x1} ${y1 + dy}, ${x2} ${y2 - dy}, ${x2} ${y2}`}
                fill="none"
                stroke="#e2e8f0"
                strokeWidth={1.5}
              />
            );
          })}
        </svg>

        {/* 节点卡 */}
        {nodes.map(({ point, x, y }) => {
          const status = nodeStatus(point, mastered);
          const isWeak = weak.has(point.id);
          const unmet = unmetPrereqs(point, mastered)
            .map((id) => graph.points.find((p) => p.id === id)?.name ?? id)
            .join("、");
          return (
            <div
              key={point.id}
              className="group absolute"
              style={{ left: x, top: y, width: NODE_W, height: NODE_H }}
            >
              <button
                onClick={() => onSelect(point.id)}
                className={`relative flex h-full w-full items-center justify-center rounded-xl border px-2 text-center text-sm font-medium shadow-soft transition ${STATUS_CARD[status]}`}
              >
                {status === "mastered" && (
                  <IconCheck className="mr-1 h-4 w-4 text-emerald-500" />
                )}
                {status === "locked" && (
                  <IconLock className="mr-1 h-3.5 w-3.5 text-slate-400" />
                )}
                <span className="truncate">{point.name}</span>
                {isWeak && (
                  <span className="absolute -bottom-1.5 -right-1.5 h-3 w-3 rounded-full border-2 border-white bg-rose-500" />
                )}
              </button>

              {/* hover 浮层 */}
              <div className="pointer-events-none absolute left-1/2 top-full z-10 mt-1 hidden w-44 -translate-x-1/2 rounded-lg bg-indigo-950 px-3 py-2 text-xs text-violet-50 shadow-lg group-hover:block">
                <div className="font-semibold">{point.name}</div>
                <div className="mt-0.5 text-violet-200/80">
                  难度 {point.difficulty} · 约 {point.est_minutes} 分钟
                </div>
                <div className="mt-0.5 text-violet-200/80">
                  {status === "mastered"
                    ? "✅ 已掌握"
                    : status === "ready"
                      ? "🔓 可以开始学"
                      : `🔒 建议先学：${unmet}`}
                </div>
                {isWeak && <div className="mt-0.5 text-rose-300">🔴 薄弱点</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 在 `App.tsx` 给 `<KnowledgeGraph>` 传 `profile`**

`frontend/src/App.tsx` 中找到（约第 155 行）：
```tsx
                <KnowledgeGraph graph={graph} path={path} onSelect={openKp} />
```
改为：
```tsx
                <KnowledgeGraph
                  graph={graph}
                  path={path}
                  profile={profile}
                  onSelect={openKp}
                />
```

- [ ] **Step 4: 构建校验**

Run: `cd frontend && npm run build`
Expected: 构建通过（无类型错误；`d3` 仍在依赖中，此任务不动它）。

- [ ] **Step 5: 手动冒烟**

Run: `cd frontend && npm run dev`，浏览器开 http://localhost:5173 ，进入「知识图谱」视图。
Expected:
- 节点按 **1-6-3-2 四层** 自上而下排列（Lv0 数组；Lv1 链表/栈/队列/递归/排序/查找与哈希；Lv2 二叉树/图/动态规划；Lv3 二叉搜索树/堆），先修连线自上而下、不乱跳。
- 先在「对话画像」里说一句（如"我学过数组和链表，动态规划比较弱"），回到图谱：`数组`/`链表` 显示绿色对勾，先修未满足的（如 `二叉树`）置灰带锁，`动态规划` 右下角有红色薄弱角标。
- hover 任一节点弹出浮层显示 难度/时长/状态（锁定的显示"建议先学：X"）。
- 点任一节点跳到学习工作台对应知识点。

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/KnowledgeGraph.tsx frontend/src/components/icons.tsx frontend/src/App.tsx
git commit -m "feat(graph): 分层技能树渲染 + 画像驱动状态着色"
```

---

## Task 3: 个性化推荐覆盖层（推荐卡 + 序号徽标 + 下一步高亮）

**Files:**
- Modify: `frontend/src/components/KnowledgeGraph.tsx`

**Interfaces:**
- Consumes: `path: string[]` prop（Task 2 已在 Props 中声明）、`IconRoute / IconSparkles`（`./icons`）
- Produces: 在既有组件上叠加推荐 UI；不改对外 props。

- [ ] **Step 1: 扩展 import 与组件签名**

`frontend/src/components/KnowledgeGraph.tsx` 顶部 import 行：
```tsx
import { IconCheck, IconLock } from "./icons";
```
改为：
```tsx
import { IconCheck, IconLock, IconRoute, IconSparkles } from "./icons";
```
组件签名加回 `path`：
```tsx
export default function KnowledgeGraph({ graph, profile, onSelect }: Props) {
```
改为：
```tsx
export default function KnowledgeGraph({ graph, path, profile, onSelect }: Props) {
```

- [ ] **Step 2: 计算推荐序号与下一步**

在 `const weak = useMemo(...)` 这一行之后追加：
```tsx
  const orderById = useMemo(() => {
    const m: Record<string, number> = {};
    path.forEach((id, i) => (m[id] = i + 1));
    return m;
  }, [path]);
  const nextId = path[0];
  const nextNode = graph.points.find((p) => p.id === nextId);
```

- [ ] **Step 3: 在最外层返回里加"下一步推荐"卡片**

把组件返回的最外层：
```tsx
  return (
    <div className="w-full overflow-x-auto">
```
改为（在画布外面再包一层，并在画布前插入推荐卡）：
```tsx
  return (
    <div>
      {nextNode && (
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-50 to-cyan-50 p-4 shadow-soft">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 text-white">
            <IconRoute className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold uppercase tracking-wider text-violet-500">
              下一步推荐
            </div>
            <div className="font-heading text-lg font-bold text-indigo-950">
              {nextNode.name}
              <span className="ml-2 text-xs font-normal text-slate-500">
                难度 {nextNode.difficulty} · 约 {nextNode.est_minutes} 分钟
              </span>
            </div>
          </div>
          <button
            onClick={() => onSelect(nextId)}
            className="shrink-0 rounded-full bg-gradient-to-r from-violet-600 to-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-glow transition hover:brightness-110"
          >
            去学习
          </button>
        </div>
      )}
      <div className="w-full overflow-x-auto">
```
并在组件返回的**结尾**，给最外层多补一个收尾 `</div>`。原结尾：
```tsx
        })}
      </div>
    </div>
  );
}
```
改为：
```tsx
        })}
        </div>
      </div>
    </div>
  );
}
```
（即：画布 `relative` 容器 `</div>`、`overflow-x-auto` 容器 `</div>`、最外层新包裹 `</div>`。注意相应调整缩进，确保 JSX 标签配平。）

- [ ] **Step 4: 连线高亮推荐路径**

把连线里的：
```tsx
            const dy = (y2 - y1) / 2;
            return (
              <path
                key={`${from}-${to}`}
                d={`M ${x1} ${y1} C ${x1} ${y1 + dy}, ${x2} ${y2 - dy}, ${x2} ${y2}`}
                fill="none"
                stroke="#e2e8f0"
                strokeWidth={1.5}
              />
            );
```
改为：
```tsx
            const dy = (y2 - y1) / 2;
            const onPath = Boolean(orderById[from] && orderById[to]);
            return (
              <path
                key={`${from}-${to}`}
                d={`M ${x1} ${y1} C ${x1} ${y1 + dy}, ${x2} ${y2 - dy}, ${x2} ${y2}`}
                fill="none"
                stroke={onPath ? "#7c3aed" : "#e2e8f0"}
                strokeWidth={onPath ? 2.5 : 1.5}
              />
            );
```

- [ ] **Step 5: 节点加序号徽标与下一步星标**

在节点 `map` 内，把：
```tsx
          const status = nodeStatus(point, mastered);
          const isWeak = weak.has(point.id);
```
改为：
```tsx
          const status = nodeStatus(point, mastered);
          const isWeak = weak.has(point.id);
          const order = orderById[point.id];
          const isNext = point.id === nextId;
```
把节点按钮的 className（含 `shadow-soft transition ${STATUS_CARD[status]}`）末尾加上下一步描边：
```tsx
                className={`relative flex h-full w-full items-center justify-center rounded-xl border px-2 text-center text-sm font-medium shadow-soft transition ${STATUS_CARD[status]}`}
```
改为：
```tsx
                className={`relative flex h-full w-full items-center justify-center rounded-xl border px-2 text-center text-sm font-medium shadow-soft transition ${STATUS_CARD[status]} ${
                  isNext ? "ring-2 ring-violet-500 ring-offset-2" : ""
                }`}
```
并在按钮内 `<span className="truncate">{point.name}</span>` 之后、`{isWeak && ...}` 之前插入序号与星标：
```tsx
                {order && (
                  <span className="absolute -left-2 -top-2 grid h-5 w-5 place-items-center rounded-full bg-violet-600 text-[11px] font-bold text-white shadow">
                    {order}
                  </span>
                )}
                {isNext && (
                  <span className="absolute -right-2 -top-2 grid h-5 w-5 place-items-center rounded-full bg-amber-400 text-white shadow">
                    <IconSparkles className="h-3 w-3" />
                  </span>
                )}
```

- [ ] **Step 6: 构建校验**

Run: `cd frontend && npm run build`
Expected: 构建通过，无类型错误。

- [ ] **Step 7: 手动冒烟**

Run: `cd frontend && npm run dev`，进入「知识图谱」，先在侧边栏点「生成个性化学习路径」。
Expected:
- 顶部出现「📍 下一步推荐：<名称>」卡片，点「去学习」跳到该知识点工作台。
- 推荐路径上的节点带 ①②③… 序号徽标；`path[0]` 节点有紫色描边 + 右上角 ⭐ 星标；推荐路径相关先修连线变紫加粗。
- 路径为空时（尚未规划/全部已掌握）不显示推荐卡与徽标，图谱仍正常着色。

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/KnowledgeGraph.tsx
git commit -m "feat(graph): 个性化推荐覆盖层(推荐卡/序号/下一步高亮)"
```

---

## Task 4: 进入视图自动规划 + 移除 D3 依赖

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/package.json`

**Interfaces:**
- Consumes: 既有 `plan()` / `view` / `path` / `profile`（App 内）
- Produces: 进入知识图谱视图且已有画像时自动出推荐；项目不再依赖 d3。

- [ ] **Step 1: 进入图谱视图自动规划**

`frontend/src/App.tsx` 中，在已有的初始化 `useEffect`（`getJSON<Profile>("/profile")...`）之后追加一个新 effect：
```tsx
  // 进入知识图谱视图且已有画像、尚未规划时，自动出个性化推荐
  useEffect(() => {
    if (
      view === "graph" &&
      path.length === 0 &&
      profile &&
      (profile.mastered.length > 0 || profile.weak_points.length > 0)
    ) {
      plan();
    }
    // 仅在视图/画像变化时触发；path 变非空后由上面的 guard 防止重复规划
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, profile]);
```

- [ ] **Step 2: 移除 `package.json` 的 d3 依赖**

`frontend/package.json` 删除以下两行：
- dependencies 中：`"d3": "^7.9.0",`
- devDependencies 中：`"@types/d3": "^7.4.3",`

- [ ] **Step 3: 刷新依赖并构建校验**

Run: `cd frontend && npm install && npm run build`
Expected: `npm install` 更新 lockfile 移除 d3；`npm run build` 通过（确认全项目已无 `import ... d3` 残留——仅原 `KnowledgeGraph.tsx` 用过，已在 Task 2 重写移除）。

- [ ] **Step 4: 手动冒烟**

Run: `cd frontend && npm run dev`
Expected:
- 先在「对话画像」建立画像 → 切到「知识图谱」视图，**无需手点按钮**即自动出现「下一步推荐」卡与序号徽标（自动规划生效）。
- 应用整体功能正常、无控制台报错（d3 移除后无破坏）。

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.tsx frontend/package.json frontend/package-lock.json
git commit -m "refactor(graph): 进入视图自动规划并移除 d3 依赖"
```

---

## 自检（spec 覆盖 / 占位 / 类型一致性）

- **spec §3 结构与布局** → Task 1（computeTiers 分层）+ Task 2（连线/节点渲染）✅
- **spec §4 画像状态** → Task 2（nodeStatus + 着色 + 薄弱角标 + hover）✅
- **spec §5 个性化推荐** → Task 3（推荐卡 + 序号 + 下一步 + 路径连线高亮）✅
- **spec §5 自动规划** → Task 4 Step 1 ✅
- **spec §6 交互** → Task 2（点击跳转 + hover 浮层 + 锁定先修提示）✅
- **spec §3.2 移除 D3** → Task 4 Step 2-3 ✅
- **spec §7 组件架构**（tiers.ts / 组件重写 / App 传 profile）→ Task 1/2/4 ✅
- **spec §8 边界**（path 空 / profile null / 先修缺失 / 环）→ computeTiers 环保护（Task 1）、推荐卡与徽标的 `nextNode &&` / `order &&` 守卫（Task 2/3）✅
- **类型一致性**：`NODE_W/NODE_H/computeTiers/nodeStatus/unmetPrereqs/NodeStatus/TierLayout/LaidOutNode` 在 Task 1 定义，Task 2/3 按同名同签名消费；props `{graph,path,profile,onSelect}` 在 Task 2 声明、Task 3 仅启用 `path`。无悬空引用。
- **占位扫描**：无 TBD/TODO，每个代码步骤含完整代码与精确路径、命令、预期。
