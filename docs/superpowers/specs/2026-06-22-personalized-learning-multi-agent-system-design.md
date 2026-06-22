# 基于大模型的个性化资源生成与学习多智能体系统 — 设计文档

- **赛题**：A3 基于大模型的个性化资源生成与学习多智能体系统开发（科大讯飞）
- **日期**：2026-06-22
- **演示课程**：数据结构与算法
- **交付形态**：Web 应用
- **创新主线**：多 Agent 协同可见化
- **今日交付阈值**：可运行的代码 + 主线场景走通（PPT/视频/文档后续另排）

---

## 1. 背景与目标

赛题要求构建高等教育个性化学习资源体系与智能学习多智能体系统，满足学生个性化、多模态学习需求。本设计聚焦三个**必做核心需求**，放弃两个可选加分项（智能辅导、学习效果评估），把资源集中在能打动评委的主线上：

1. **对话式学习画像自主构建**
2. **多智能体协同的资源生成**
3. **个性化学习路径规划与资源推送**

评分权重（创新价值 35% + 功能实现 45%）决定了重点是**前端可见的多 Agent 协同过程**与**功能完整跑通**，而非后端编排框架的选型。

### 非目标（明确不做）

- 智能辅导（多模态答疑）——可选加分项，本期不做。
- 学习效果评估与动态调整——可选加分项，本期不做。
- 用户登录/多租户/权限系统——演示单一学习者即可。
- 真·RAG 向量检索——资源走预烘 + LLM 增强，不引入向量库。

---

## 2. 总体架构

```
┌─────────────── 前端 (React + Vite + TailwindCSS) ───────────────┐
│  ① 对话式画像构建   ② 知识图谱 + 学习路径   ③ 学习工作台(协同可见化) │
└──────────────────────────┬──────────────────────────────────────┘
                           │  REST + SSE（流式 Agent 事件）
┌──────────────────────────┴──────────────────────────────────────┐
│                      后端 FastAPI (Python)                         │
│  Coordinator(调度器) ──► 画像 / 规划 / 讲解 / 出题 / 可视化 5 Agent  │
│  LLM 适配层(OpenAI 兼容 → Claude 中转 / 星火占位 / Fake)            │
│  数据层: 知识图谱 JSON · 预烘资源库 · SQLite 画像存储               │
└────────────────────────────────────────────────────────────────────┘
```

**核心设计原则**：预烘资源保证演示稳定 + LLM 现场增强体现"个性化生成" + SSE 把每个 Agent 的工作过程实时铺到前端 = 评委一眼可见的"多智能体协同"。

### 技术栈

- 后端：Python 3.11+ / FastAPI / uvicorn / pydantic / 标准库 sqlite3 / httpx（调 LLM）
- 前端：React 18 / Vite / TypeScript / TailwindCSS / D3（知识图谱）/ 自写 SVG 动画
- LLM：今天接 Claude 中转站（OpenAI 兼容接口）；预留星火 SparkClient 接入位
- 不引入 LangGraph / 向量库：5 Agent 自写编排，调试更快、故障半径更小

---

## 3. 五个 Agent 与调度

| Agent | 职责 | 触发时机 | 输入 | 输出 |
|---|---|---|---|---|
| **画像 Agent** (Profiler) | 从对话抽取学习者画像：已掌握/薄弱点/目标/偏好/节奏 | 对话式 onboarding 每轮 | 对话历史 | 结构化画像增量(JSON) |
| **规划 Agent** (Planner) | 在知识图谱上按先修关系 + 画像计算推荐学习路径并给出解释 | 画像更新后 | 画像 + 知识图谱 | 有序知识点列表 + 理由 |
| **讲解 Agent** (Tutor) | 生成知识点讲解(Markdown + LaTeX)，在预烘脚本上做个性化增强 | 选中知识点 | 知识点 + 画像 + 预烘脚本 | 讲解文本(md) |
| **可视化 Agent** (Visualizer) | 选定该知识点的动画类型与参数 | 选中知识点（与讲解并行） | 知识点 + 预烘 viz spec | 可视化 spec(JSON) |
| **出题 Agent** (Quizzer) | 按画像难度实例化/生成练习题 | 选中知识点（并行） | 知识点 + 画像难度 + 题模板 | 题目列表(JSON) |

### 调度器 (Coordinator)

- 自写 async 编排器（约 90 行），混合顺序 + 并行调度。
- 资源生成场景：选中知识点后，**讲解 / 可视化 / 出题三个 Agent 并行执行**，构成"多智能体协同资源生成"。
- 每个 Agent 执行期间发出事件：`agent_start` / `token`（流式片段）/ `agent_done` / `agent_error`，经 SSE 推到前端。
- 不引入 LangGraph：5 个 Agent 以内自写编排调试更快；PPT 架构图描述逻辑层，不受是否用某库影响。

### 需求映射

- 需求①对话式画像 → 画像 Agent
- 需求②多智能体协同资源生成 → 讲解 + 可视化 + 出题 三 Agent 并行协同
- 需求③个性化路径规划与推送 → 规划 Agent

---

## 4. 数据层

### 4.1 知识图谱

精选约 12 个核心知识点：数组、链表、栈、队列、二叉树、二叉搜索树、堆、图、排序、查找/哈希、递归与分治、动态规划。

手写 JSON，节点结构：

```json
{
  "id": "binary_tree",
  "name": "二叉树",
  "difficulty": 3,
  "prerequisites": ["linked_list", "recursion"],
  "est_minutes": 40,
  "resource_ref": "resources/binary_tree.json"
}
```

边 = 先修关系（有向）。前端用 D3 力导向图渲染，难度配色，推荐路径高亮连线。

### 4.2 预烘资源库

每个知识点一个 JSON bundle：

```json
{
  "id": "sorting",
  "explanation_md": "## 排序…(含 $O(n\\log n)$ LaTeX)",
  "viz": { "type": "sorting", "params": { "algorithm": "quick", "array": [5,2,8,1,9,3] } },
  "code": { "language": "python", "source": "def quick_sort(arr): …" },
  "question_templates": [
    { "stem": "对数组 {array} 用快排，第一趟 partition 后…", "answer": "…", "difficulty": 2 }
  ]
}
```

LLM 在预烘内容基础上做个性化润色/调难度。**LLM 失败时直接回退预烘内容**——演示永不翻车。

### 4.3 画像存储

SQLite（Python 标准库 `sqlite3`，零配置单文件），薄仓储层封装便于替换。

画像数据结构：

```json
{
  "learner_id": "demo",
  "mastered": ["array", "linked_list"],
  "weak_points": ["dynamic_programming"],
  "goal": "准备数据结构期末考",
  "preference": "喜欢看动画、偏好循序渐进",
  "pace": "medium",
  "history": [ { "knowledge_id": "stack", "status": "completed", "score": 0.8 } ]
}
```

---

## 5. 前端三视图

### 视图① 对话式画像构建

聊天界面；右侧实时更新"画像卡片"：掌握度雷达 / 薄弱点标签 / 学习目标。每轮对话后画像 Agent 抽取属性并刷新卡片。

### 视图② 知识图谱 + 学习路径

D3 力导向图；推荐路径高亮连线；节点配色表难度；点击节点进入工作台。

### 视图③ 学习工作台（核心，协同可见化）

- **左栏：Agent 协同活动流** — 每个 Agent 一张卡片/头像，状态灯（思考中 → 生成中 → 完成）+ 流式输出文字。这是创新主线的核心呈现。
- **中栏：资源 Tab** — 讲解(md+公式) / 动画 / 代码 / 练习，随 SSE 实时拼装。

### 多模态动画组件（约 4 类，覆盖演示知识点）

1. 排序条形动画（排序）
2. 二叉树构建 + 遍历（树/BST）
3. 图 BFS/DFS 遍历（图）
4. 线性结构操作：栈/队列/链表入出（线性结构）

实现：SVG + requestAnimationFrame，受 step 控制可暂停/单步。

---

## 6. 数据流

```
对话 → 画像 Agent 抽取属性 → 存 SQLite → 画像卡片更新
     → 规划 Agent 读画像+图谱 → 拓扑排序出路径 → 前端高亮路径
     → 用户点知识点 → 调度器并行派 讲解+可视化+出题 → 各自 SSE 流式
     → 工作台实时拼装资源 → 用户完成练习/标记掌握 → 画像更新 → 路径重规划
```

---

## 7. LLM 适配层

```
LLMClient (ABC)
  async chat(messages, **kw) -> str
  async stream(messages, **kw) -> AsyncIterator[str]

OpenAICompatClient(LLMClient)   # 今天用：Claude 中转，OpenAI 兼容 /v1/chat/completions
SparkClient(LLMClient)          # 星火占位，上台前补 WS 协议
FakeLLMClient(LLMClient)        # 固定响应，供测试 + 无网 mock 演示
```

配置走 `.env`：`LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL` / `LLM_PROVIDER`（openai_compat | spark | fake）。

---

## 8. 错误处理

- LLM 调用失败 → 重试 1 次 → 回退预烘资源（演示可靠性关键）。
- SSE 断连 → 前端自动重连。
- 知识点缺失 → 404 + 友好提示。
- 画像抽取返回非法 JSON → 容错解析，保留上一版画像。

---

## 9. 测试策略

- **后端**：pytest 测调度器（用 FakeLLMClient，免网络）、路径算法（拓扑排序正确性）、资源仓储加载、画像存取。FakeLLMClient 同时充当无网演示模式。
- **前端**：以手动验证为主（时间所限），保 1 个冒烟测试（应用能起、能进三视图）。

---

## 10. 项目结构

```
backend/
  app/
    main.py              # FastAPI app、路由、SSE
    config.py            # 环境配置
    models.py            # pydantic schemas
    llm/
      base.py            # LLMClient ABC
      openai_compat.py   # Claude 中转
      spark.py           # 星火占位
      fake.py            # FakeLLMClient
    agents/
      base.py            # Agent 基类 + 事件类型
      profiler.py
      planner.py
      tutor.py
      quizzer.py
      visualizer.py
      coordinator.py     # 编排 + SSE 事件
    data/
      knowledge_graph.json
      resources/         # 各知识点预烘 bundle
      repository.py      # SQLite 画像存储 + 资源加载
  tests/
  requirements.txt
  .env.example
frontend/
  src/
    components/
      AgentFeed.tsx          # 多 Agent 协同活动流
      KnowledgeGraph.tsx     # D3 力导向图
      animations/            # sorting / tree / graph / linear
      ResourcePanel.tsx
      ProfileChat.tsx
      ProfileCard.tsx
    pages/
    api/                     # SSE + fetch 客户端
    App.tsx
  package.json
  vite.config.ts
README.md
docs/
```

---

## 11. 一天交付的优先级分层

1 天 1-2 人完成"全部代码"是激进目标。按优先级实现，保证每层先跑通再加深：

### P0（必须跑通，演示主线）
- 后端 Agent 调度 + SSE 事件流
- LLM 适配层（OpenAICompat + Fake）
- 对话式画像（画像 Agent + 画像卡片）
- 3 个知识点的预烘资源
- 学习工作台协同可见化 UI
- 1-2 个动画（排序 + 树）

### P1（撑场面）
- 知识图谱 D3 视图 + 规划 Agent 路径推荐
- 补齐到约 12 个知识点
- 补齐 4 类动画

### P2（锦上添花）
- SQLite 画像持久化
- 练习闭环（完成练习回写画像 → 重规划）
- 画像雷达图

---

## 12. 讯飞生态合规

- 题目要求"需选用科大讯飞相关工具"。LLM 适配层预留 `SparkClient`，上台前切换到星火 API；后续可加讯飞语音合成做讲解语音播报。
- 作品说明中需注明使用了 AI Coding 工具（Claude Code）。
