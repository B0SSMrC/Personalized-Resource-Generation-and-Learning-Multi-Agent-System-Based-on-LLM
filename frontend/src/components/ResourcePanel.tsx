import { useEffect, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { getJSON } from "../api/client";
import type { ResourceBundle } from "../types";
import SortingAnim from "./animations/SortingAnim";
import TreeAnim from "./animations/TreeAnim";
import GraphAnim from "./animations/GraphAnim";
import LinearAnim from "./animations/LinearAnim";
import { IconCheck, IconReplay, IconSparkles } from "./icons";

type AgentName = "tutor" | "visualizer" | "quizzer";

interface Props {
  explanationMd: string;
  viz: { type: string; params: Record<string, any> } | null;
  questions: { stem: string; answer: string; difficulty: number }[];
  kpId: string;
  generating: { tutor: boolean; visualizer: boolean; quizzer: boolean };
  onGenerate: (agent: AgentName) => void;
  onComplete?: (kpId: string) => void;
}

type Tab = "explain" | "anim" | "code" | "quiz";

const TABS: { id: Tab; label: string }[] = [
  { id: "explain", label: "讲解" },
  { id: "anim", label: "动画" },
  { id: "code", label: "代码" },
  { id: "quiz", label: "练习" },
];

function TypingDots() {
  return (
    <span className="flex items-center gap-1">
      {[0, 1, 2].map((d) => (
        <span
          key={d}
          className="typing-dot h-2 w-2 rounded-full bg-violet-400"
          style={{ animationDelay: `${d * 0.15}s` }}
        />
      ))}
    </span>
  );
}

function Empty({
  label,
  agentLabel,
  busy,
  onGen,
}: {
  label: string;
  agentLabel: string;
  busy: boolean;
  onGen: () => void;
}) {
  if (busy)
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <TypingDots />
        <p className="text-sm text-slate-500">{agentLabel} 正在生成{label}…</p>
      </div>
    );
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-50 text-violet-500">
        <IconSparkles className="h-6 w-6" />
      </div>
      <p className="text-sm text-slate-400">尚未生成{label}，由你决定何时生成</p>
      <button
        onClick={onGen}
        className="rounded-full bg-gradient-to-r from-violet-600 to-violet-500 px-4 py-2 text-sm font-semibold text-white shadow-glow transition hover:brightness-110"
      >
        生成{label}
      </button>
    </div>
  );
}

function RegenBar({ onGen, busy }: { onGen: () => void; busy: boolean }) {
  return (
    <div className="mb-3 flex justify-end">
      <button
        onClick={onGen}
        disabled={busy}
        className="inline-flex items-center gap-1 rounded-full border border-violet-200 px-2.5 py-1 text-xs font-medium text-violet-600 transition hover:bg-violet-50 disabled:opacity-50"
      >
        <IconReplay className="h-3.5 w-3.5" />
        {busy ? "生成中…" : "重新生成"}
      </button>
    </div>
  );
}

export default function ResourcePanel({
  explanationMd,
  viz,
  questions,
  kpId,
  generating,
  onGenerate,
  onComplete,
}: Props) {
  const [tab, setTab] = useState<Tab>("explain");
  const [code, setCode] = useState<{ language: string; source: string; output: string } | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    getJSON<ResourceBundle>(`/resource/${kpId}`)
      .then((b) => setCode(b.code))
      .catch(() => setCode(null));
    setDone(false);
  }, [kpId]);

  return (
    <div className="overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-soft">
      <div className="flex gap-1 border-b border-slate-100 px-3 pt-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`relative px-4 py-2.5 text-sm font-medium transition ${
              tab === t.id ? "text-violet-700" : "text-slate-400 hover:text-slate-600"
            }`}
          >
            {t.label}
            {tab === t.id && (
              <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-gradient-to-r from-violet-600 to-cyan-500" />
            )}
          </button>
        ))}
      </div>

      <div className="max-h-[60vh] min-h-[340px] overflow-y-auto p-5">
        {/* 讲解 */}
        {tab === "explain" &&
          (explanationMd ? (
            <div>
              <RegenBar busy={generating.tutor} onGen={() => onGenerate("tutor")} />
              <div className="md">
                <Markdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                  {explanationMd}
                </Markdown>
              </div>
            </div>
          ) : (
            <Empty label="讲解" agentLabel="讲解 Agent" busy={generating.tutor} onGen={() => onGenerate("tutor")} />
          ))}

        {/* 动画 */}
        {tab === "anim" &&
          (viz ? (
            <div>
              <RegenBar busy={generating.visualizer} onGen={() => onGenerate("visualizer")} />
              {viz.type === "sorting" && <SortingAnim params={viz.params} />}
              {viz.type === "tree" && <TreeAnim params={viz.params} />}
              {viz.type === "graph" && <GraphAnim params={viz.params} />}
              {viz.type === "linear" && <LinearAnim params={viz.params} />}
            </div>
          ) : (
            <Empty
              label="动画"
              agentLabel="可视化 Agent"
              busy={generating.visualizer}
              onGen={() => onGenerate("visualizer")}
            />
          ))}

        {/* 代码 + 运行结果 */}
        {tab === "code" && (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-xl bg-slate-900">
              <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-2">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
                <span className="ml-2 font-mono text-xs text-slate-400">
                  {code?.language || "python"}
                </span>
              </div>
              <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-6 text-slate-100">
                <code>{code?.source || "（暂无代码）"}</code>
              </pre>
            </div>
            <div>
              <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                <span className="grid h-4 w-4 place-items-center rounded bg-emerald-100 text-emerald-600">
                  ▸
                </span>
                运行结果
              </div>
              <pre className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-[13px] leading-6 text-emerald-300">
                <code>{code?.output || "（该示例无标准输出）"}</code>
              </pre>
            </div>
          </div>
        )}

        {/* 练习 */}
        {tab === "quiz" &&
          (questions.length > 0 ? (
            <div>
              <RegenBar busy={generating.quizzer} onGen={() => onGenerate("quizzer")} />
              <ul className="space-y-3">
                {questions.map((q, i) => (
                  <li key={i} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5">
                    <div className="flex gap-2 text-sm font-medium text-slate-800">
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-violet-100 text-xs text-violet-700">
                        {i + 1}
                      </span>
                      <span>{q.stem}</span>
                    </div>
                    <details className="mt-2 pl-7 text-sm text-slate-600">
                      <summary className="cursor-pointer text-violet-600 hover:text-violet-700">
                        查看答案
                      </summary>
                      <div className="mt-1">{q.answer}</div>
                    </details>
                  </li>
                ))}
              </ul>
              {onComplete && (
                <button
                  onClick={() => {
                    setDone(true);
                    onComplete(kpId);
                  }}
                  disabled={done}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-60"
                >
                  <IconCheck className="h-4 w-4" />
                  {done ? "已掌握" : "标记已掌握"}
                </button>
              )}
            </div>
          ) : (
            <Empty label="练习" agentLabel="出题 Agent" busy={generating.quizzer} onGen={() => onGenerate("quizzer")} />
          ))}
      </div>
    </div>
  );
}
