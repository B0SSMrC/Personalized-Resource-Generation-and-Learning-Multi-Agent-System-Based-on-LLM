import type { ReactNode } from "react";
import type { Graph, Profile } from "../types";

type View = "profile" | "graph" | "workbench";

interface Props {
  active: View;
  onSelect: (v: View) => void;
  profile: Profile | null;
  graph: Graph | null;
  path: string[];
  kpId: string;
  onPlan: () => void;
  onPickKp: (id: string) => void;
}

export default function Sidebar({
  active,
  onSelect,
  profile,
  graph,
  path,
  kpId,
  onPlan,
  onPickKp,
}: Props) {
  const nameOf = (id: string) =>
    graph?.points.find((p) => p.id === id)?.name ?? id;

  const Section = ({
    id,
    label,
    children,
  }: {
    id: View;
    label: string;
    children: ReactNode;
  }) => {
    const open = active === id;
    return (
      <div className="border-b">
        <button
          onClick={() => onSelect(id)}
          className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium ${
            open ? "bg-blue-50 text-blue-700" : "hover:bg-gray-50"
          }`}
        >
          <span>{label}</span>
          <span className="text-xs text-gray-400">{open ? "▼" : "▶"}</span>
        </button>
        {open && <div className="px-4 pb-4">{children}</div>}
      </div>
    );
  };

  const Tag = ({ text, color }: { text: string; color: string }) => (
    <span className={`mb-1 mr-1 inline-block rounded px-1.5 py-0.5 text-xs ${color}`}>
      {text}
    </span>
  );

  return (
    <div>
      <div className="border-b px-4 py-4">
        <div className="text-lg font-bold">🎓 个性化学习</div>
        <div className="mt-0.5 text-xs text-gray-500">
          多智能体系统 · 数据结构与算法
        </div>
      </div>

      <Section id="profile" label="① 对话画像">
        <div className="text-xs text-gray-600">目标：{profile?.goal || "—"}</div>
        <div className="mt-2 text-xs text-gray-400">已掌握</div>
        <div>
          {profile?.mastered.length ? (
            profile.mastered.map((m) => (
              <Tag key={m} text={nameOf(m)} color="bg-green-100 text-green-700" />
            ))
          ) : (
            <span className="text-xs text-gray-300">—</span>
          )}
        </div>
        <div className="mt-1 text-xs text-gray-400">薄弱点</div>
        <div>
          {profile?.weak_points.length ? (
            profile.weak_points.map((m) => (
              <Tag key={m} text={nameOf(m)} color="bg-red-100 text-red-700" />
            ))
          ) : (
            <span className="text-xs text-gray-300">—</span>
          )}
        </div>
        <button
          onClick={() => onSelect("profile")}
          className="mt-3 w-full rounded bg-blue-500 px-2 py-1 text-xs text-white"
        >
          进入对话
        </button>
      </Section>

      <Section id="graph" label="② 知识图谱">
        <button
          onClick={onPlan}
          className="w-full rounded bg-blue-500 px-2 py-1 text-xs text-white"
        >
          生成个性化学习路径
        </button>
        {path.length > 0 ? (
          <ol className="mt-2 space-y-1">
            {path.map((id, i) => (
              <li key={id} className="text-xs text-gray-600">
                {i + 1}. {nameOf(id)}
              </li>
            ))}
          </ol>
        ) : (
          <div className="mt-2 text-xs text-gray-400">
            点击上方按钮生成推荐顺序
          </div>
        )}
      </Section>

      <Section id="workbench" label="③ 学习工作台">
        <div className="text-xs text-gray-400">点击知识点直接学习：</div>
        <ul className="mt-1 space-y-0.5">
          {graph?.points.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => onPickKp(p.id)}
                className={`w-full rounded px-2 py-1 text-left text-xs ${
                  kpId === p.id
                    ? "bg-blue-100 font-medium text-blue-700"
                    : "hover:bg-gray-100"
                }`}
              >
                {p.name}
              </button>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
