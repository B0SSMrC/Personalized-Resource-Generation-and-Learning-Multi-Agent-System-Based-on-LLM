# 基于大模型的个性化资源生成与学习多智能体系统

面向高校《数据结构与算法》课程的个性化学习 Web 系统：**对话式画像构建**、**多 Agent 协同资源生成**、**个性化学习路径规划**。

> 科大讯飞 A3 赛题作品。创新主线：**多智能体协同可见化** —— 讲解 / 可视化 / 出题三个 Agent 并行协同，前端通过 SSE 实时呈现每个 Agent 的工作过程。

## 架构

```
前端 React/Vite/Tailwind/D3
  ① 对话画像   ② 知识图谱+路径   ③ 学习工作台(协同可见化)
        │  REST + SSE
后端 FastAPI
  Coordinator(自写 async 调度) ──► 画像/规划/讲解/出题/可视化 5 Agent
  LLM 适配层(openai_compat / spark 占位 / fake)
  知识图谱 JSON · 12 知识点预烘资源 · 画像仓储(内存/SQLite)
```

设计文档见 `docs/superpowers/specs/`，实现计划见 `docs/superpowers/plans/`。

## 运行

### 后端

```bash
cd backend
python -m venv .venv
.venv/Scripts/activate        # Windows；macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # 填 LLM_BASE_URL / LLM_API_KEY；或设 LLM_PROVIDER=fake 离线演示
uvicorn app.main:app --reload --port 8000
```

### 前端

```bash
cd frontend
npm install
npm run dev                   # http://localhost:5173
```

前端通过 Vite 代理把 `/api` 转发到 `http://localhost:8000`，两个服务同时启动即可。

## 测试

```bash
cd backend
.venv/Scripts/python -m pytest -v     # 38 项后端测试
```

## LLM 配置

`.env` 中 `LLM_PROVIDER`：

| 取值 | 说明 |
|---|---|
| `openai_compat` | OpenAI 兼容接口（当前用 Claude 中转站，填 `LLM_BASE_URL`/`LLM_API_KEY`/`LLM_MODEL`） |
| `spark` | 讯飞星火（接入位，见 `app/llm/spark.py`，上台前实现协议即可切换） |
| `fake` | 离线演示模式，无需网络，返回内置内容 |

`DB_PATH` 留空使用内存画像仓储；填文件名（如 `profiles.db`）启用 SQLite 持久化。

> 演示可靠性：任何 LLM 调用失败都会回退到预烘资源，保证不白屏。

## 讯飞生态与 AI Coding 说明

- **讯飞工具**：LLM 适配层预留 `SparkClient` 星火接入位；后续可叠加讯飞语音合成做讲解语音播报。
- **AI Coding**：本项目使用 **Claude Code（Anthropic）** 辅助开发，覆盖需求澄清、架构设计、代码与测试生成。

## 目录

```
backend/   FastAPI + 5 Agent + 知识图谱 + 预烘资源 + 测试
frontend/  React 三视图 + 多模态动画 + D3 知识图谱
docs/      设计文档 (specs) 与实现计划 (plans)
```
