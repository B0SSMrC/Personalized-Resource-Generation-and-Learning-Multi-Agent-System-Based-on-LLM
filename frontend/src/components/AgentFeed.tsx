import type { AgentEvent } from "../types";

const LABELS: Record<string, string> = {
  tutor: "讲解 Agent",
  visualizer: "可视化 Agent",
  quizzer: "出题 Agent",
  profiler: "画像 Agent",
  planner: "规划 Agent",
};

interface AgentState {
  status: string;
  text: string;
}

function reduce(events: AgentEvent[]): Record<string, AgentState> {
  const acc: Record<string, AgentState> = {};
  for (const ev of events) {
    const s = acc[ev.agent] ?? { status: "等待", text: "" };
    if (ev.type === "agent_start") s.status = "思考中";
    else if (ev.type === "token") {
      s.status = "生成中";
      s.text += ev.content;
    } else if (ev.type === "agent_done") s.status = "完成";
    else if (ev.type === "agent_error") {
      s.status = "降级";
      s.text += ev.content;
    }
    acc[ev.agent] = s;
  }
  return acc;
}

// 讲解 Agent 的流式文本就是整段 Markdown，右侧面板已渲染，
// 这里只显示生成状态与字数，不再堆原文。
function bodyText(agent: string, st: AgentState): string {
  if (st.status === "降级") return st.text;
  if (agent === "tutor") {
    const n = st.text.length;
    if (st.status === "生成中") return `正在生成个性化讲解…（已 ${n} 字）`;
    if (st.status === "完成") return `✓ 已生成讲解 ${n} 字，见右侧「讲解」`;
    return "";
  }
  return st.text; // 可视化 / 出题 的提示本就简短
}

const DOT: Record<string, string> = {
  等待: "bg-gray-300",
  思考中: "bg-yellow-400 animate-pulse",
  生成中: "bg-blue-500 animate-pulse",
  完成: "bg-green-500",
  降级: "bg-orange-400",
};

export default function AgentFeed({ events }: { events: AgentEvent[] }) {
  const states = reduce(events);
  const order = ["tutor", "visualizer", "quizzer", "profiler", "planner"].filter(
    (a) => a in states,
  );
  return (
    <div className="space-y-3">
      <h3 className="font-semibold">多智能体协同</h3>
      {order.length === 0 && (
        <div className="rounded-lg border border-dashed p-4 text-sm text-gray-400">
          点击「开始学习」，三个 Agent 将并行协同生成资源。
        </div>
      )}
      {order.map((a) => {
        const body = bodyText(a, states[a]);
        return (
          <div key={a} className="rounded-lg border bg-white p-3">
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${DOT[states[a].status]}`} />
              <span className="font-medium">{LABELS[a] ?? a}</span>
              <span className="ml-auto text-xs text-gray-400">{states[a].status}</span>
            </div>
            {body && (
              <p className="mt-2 max-h-16 overflow-y-auto break-words text-xs text-gray-600">
                {body}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
