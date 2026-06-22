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
