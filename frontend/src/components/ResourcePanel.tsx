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

interface Props {
  explanationMd: string;
  viz: { type: string; params: Record<string, any> } | null;
  questions: { stem: string; answer: string; difficulty: number }[];
  kpId: string;
  onComplete?: (kpId: string) => void;
}

type Tab = "explain" | "anim" | "code" | "quiz";

export default function ResourcePanel({
  explanationMd,
  viz,
  questions,
  kpId,
  onComplete,
}: Props) {
  const [tab, setTab] = useState<Tab>("explain");
  const [code, setCode] = useState<{ language: string; source: string } | null>(null);

  useEffect(() => {
    getJSON<ResourceBundle>(`/resource/${kpId}`)
      .then((b) => setCode(b.code))
      .catch(() => setCode(null));
  }, [kpId]);

  const TabBtn = ({ id, label }: { id: Tab; label: string }) => (
    <button
      onClick={() => setTab(id)}
      className={`px-3 py-1.5 text-sm ${
        tab === id ? "border-b-2 border-blue-500 font-medium" : "text-gray-500"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="rounded-lg border bg-white">
      <div className="flex border-b">
        <TabBtn id="explain" label="讲解" />
        <TabBtn id="anim" label="动画" />
        <TabBtn id="code" label="代码" />
        <TabBtn id="quiz" label="练习" />
      </div>
      <div className="max-h-[55vh] overflow-y-auto p-4">
        {tab === "explain" && (
          <div className="prose prose-sm max-w-none">
            <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
              {explanationMd || "（点击「开始学习」后，讲解 Agent 将在此输出）"}
            </Markdown>
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
          <pre className="overflow-x-auto rounded bg-gray-900 p-3 text-xs text-gray-100">
            <code>{code?.source || "（暂无代码）"}</code>
          </pre>
        )}
        {tab === "quiz" && (
          <div>
            <ul className="space-y-3">
              {questions.map((q, i) => (
                <li key={i} className="text-sm">
                  <div className="font-medium">
                    {i + 1}. {q.stem}
                  </div>
                  <details className="mt-1 text-gray-600">
                    <summary className="cursor-pointer text-blue-500">查看答案</summary>
                    {q.answer}
                  </details>
                </li>
              ))}
              {questions.length === 0 && (
                <li className="text-gray-400">（暂无练习）</li>
              )}
            </ul>
            {onComplete && (
              <button
                onClick={() => onComplete(kpId)}
                className="mt-3 rounded bg-green-500 px-3 py-1 text-sm text-white"
              >
                标记已掌握
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
