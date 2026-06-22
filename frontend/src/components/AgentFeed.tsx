import type { ReactNode } from "react";
import type { AgentEvent } from "../types";
import {
  IconActivity,
  IconBook,
  IconHelp,
  IconRoute,
  IconSparkles,
  IconUser,
} from "./icons";

interface Meta {
  label: string;
  icon: (p: { className?: string }) => ReactNode;
  avatar: string; // bg + text classes
}

const META: Record<string, Meta> = {
  tutor: { label: "讲解 Agent", icon: IconBook, avatar: "bg-violet-100 text-violet-600" },
  visualizer: { label: "可视化 Agent", icon: IconActivity, avatar: "bg-cyan-100 text-cyan-600" },
  quizzer: { label: "出题 Agent", icon: IconHelp, avatar: "bg-amber-100 text-amber-600" },
  profiler: { label: "画像 Agent", icon: IconUser, avatar: "bg-indigo-100 text-indigo-600" },
  planner: { label: "规划 Agent", icon: IconRoute, avatar: "bg-emerald-100 text-emerald-600" },
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

function bodyText(agent: string, st: AgentState): string {
  if (st.status === "降级") return st.text;
  if (agent === "tutor") {
    const n = st.text.length;
    if (st.status === "生成中") return `正在生成个性化讲解…（已 ${n} 字）`;
    if (st.status === "完成") return `已生成讲解 ${n} 字，见右侧「讲解」`;
    return "";
  }
  return st.text;
}

const PILL: Record<string, string> = {
  等待: "bg-slate-100 text-slate-400",
  思考中: "bg-amber-50 text-amber-600",
  生成中: "bg-violet-50 text-violet-600",
  完成: "bg-emerald-50 text-emerald-600",
  降级: "bg-orange-50 text-orange-600",
};
const DOT: Record<string, string> = {
  等待: "bg-slate-300",
  思考中: "bg-amber-400 animate-pulse",
  生成中: "bg-violet-500 animate-pulse",
  完成: "bg-emerald-500",
  降级: "bg-orange-400",
};

export default function AgentFeed({ events }: { events: AgentEvent[] }) {
  const states = reduce(events);
  const order = ["tutor", "visualizer", "quizzer", "profiler", "planner"].filter(
    (a) => a in states,
  );
  const activeCount = order.filter(
    (a) => states[a].status === "思考中" || states[a].status === "生成中",
  ).length;

  return (
    <div className="rounded-2xl border border-violet-100 bg-white p-4 shadow-soft">
      <div className="mb-3 flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-cyan-500 text-white">
          <IconSparkles className="h-4 w-4" />
        </span>
        <h3 className="font-heading text-sm font-semibold text-indigo-950">
          多智能体协同
        </h3>
        {activeCount > 0 && (
          <span className="ml-auto rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-600">
            {activeCount} 个协同中
          </span>
        )}
      </div>

      {order.length === 0 ? (
        <div className="rounded-xl border border-dashed border-violet-200 bg-violet-50/40 p-5 text-center text-sm text-slate-400">
          点击「开始学习」，讲解 / 可视化 / 出题三个 Agent 将并行协同生成资源。
        </div>
      ) : (
        <div className="space-y-2.5">
          {order.map((a) => {
            const m = META[a] ?? {
              label: a,
              icon: IconSparkles,
              avatar: "bg-slate-100 text-slate-500",
            };
            const st = states[a];
            const body = bodyText(a, st);
            const Icon = m.icon;
            const generating = st.status === "生成中";
            return (
              <div
                key={a}
                className="animate-rise rounded-xl border border-slate-100 bg-white p-3 transition hover:border-violet-200"
              >
                <div className="flex items-center gap-2.5">
                  <span className={`grid h-9 w-9 place-items-center rounded-lg ${m.avatar}`}>
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  <span className="font-medium text-slate-800">{m.label}</span>
                  <span
                    className={`ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${PILL[st.status]}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${DOT[st.status]}`} />
                    {st.status}
                  </span>
                </div>
                {(body || generating) && (
                  <p className="mt-2 flex items-center gap-1.5 pl-0.5 text-xs leading-relaxed text-slate-500">
                    {generating && (
                      <span className="flex items-center gap-0.5">
                        {[0, 1, 2].map((d) => (
                          <span
                            key={d}
                            className="typing-dot h-1 w-1 rounded-full bg-violet-400"
                            style={{ animationDelay: `${d * 0.15}s` }}
                          />
                        ))}
                      </span>
                    )}
                    <span className="line-clamp-2">{body}</span>
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
