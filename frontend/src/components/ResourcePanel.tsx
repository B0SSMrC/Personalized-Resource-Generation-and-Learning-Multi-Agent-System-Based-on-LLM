import { useEffect, useState } from "react";
import Markdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { getJSON } from "../api/client";
import type { ResourceBundle } from "../types";
import SortingAnim from "./animations/SortingAnim";
import TreeAnim from "./animations/TreeAnim";
import GraphAnim from "./animations/GraphAnim";
import LinearAnim from "./animations/LinearAnim";
import { IconCheck } from "./icons";

interface Props {
  explanationMd: string;
  viz: { type: string; params: Record<string, any> } | null;
  questions: { stem: string; answer: string; difficulty: number }[];
  kpId: string;
  onComplete?: (kpId: string) => void;
}

type Tab = "explain" | "anim" | "code" | "quiz";

const TABS: { id: Tab; label: string }[] = [
  { id: "explain", label: "讲解" },
  { id: "anim", label: "动画" },
  { id: "code", label: "代码" },
  { id: "quiz", label: "练习" },
];

export default function ResourcePanel({
  explanationMd,
  viz,
  questions,
  kpId,
  onComplete,
}: Props) {
  const [tab, setTab] = useState<Tab>("explain");
  const [code, setCode] = useState<{ language: string; source: string } | null>(null);
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
              tab === t.id
                ? "text-violet-700"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            {t.label}
            {tab === t.id && (
              <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-gradient-to-r from-violet-600 to-cyan-500" />
            )}
          </button>
        ))}
      </div>

      <div className="max-h-[60vh] min-h-[320px] overflow-y-auto p-5">
        {tab === "explain" && (
          <div className="md">
            {explanationMd ? (
              <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                {explanationMd}
              </Markdown>
            ) : (
              <p className="text-sm text-slate-400">
                点击「开始学习」后，讲解 Agent 将在此输出个性化讲解。
              </p>
            )}
          </div>
        )}

        {tab === "anim" && (
          <div>
            {viz?.type === "sorting" && <SortingAnim params={viz.params} />}
            {viz?.type === "tree" && <TreeAnim params={viz.params} />}
            {viz?.type === "graph" && <GraphAnim params={viz.params} />}
            {(!viz || viz.type === "linear") && (
              <LinearAnim params={viz?.params ?? {}} />
            )}
          </div>
        )}

        {tab === "code" && (
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
        )}

        {tab === "quiz" && (
          <div>
            <ul className="space-y-3">
              {questions.map((q, i) => (
                <li
                  key={i}
                  className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5"
                >
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
              {questions.length === 0 && (
                <li className="text-sm text-slate-400">（点击「开始学习」生成练习）</li>
              )}
            </ul>
            {onComplete && questions.length > 0 && (
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
        )}
      </div>
    </div>
  );
}
