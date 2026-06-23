import type { ReactNode } from "react";
import type { Graph, Profile } from "../types";
import {
  IconChat,
  IconChevron,
  IconDashboard,
  IconGraph,
  IconSparkles,
  IconStar,
} from "./icons";

type View = "profile" | "graph" | "workbench" | "favorites";

interface Props {
  active: View;
  onSelect: (v: View) => void;
  profile: Profile | null;
  graph: Graph | null;
  path: string[];
  kpId: string;
  onPlan: () => void;
  onPickKp: (id: string) => void;
  onResetProfile: () => void;
}

const META: { id: View; label: string; icon: (p: { className?: string }) => ReactNode }[] = [
  { id: "profile", label: "对话画像", icon: IconChat },
  { id: "graph", label: "知识图谱", icon: IconGraph },
  { id: "workbench", label: "学习工作台", icon: IconDashboard },
  { id: "favorites", label: "收藏夹", icon: IconStar },
];

export default function Sidebar({
  active,
  onSelect,
  profile,
  graph,
  path,
  kpId,
  onPlan,
  onPickKp,
  onResetProfile,
}: Props) {
  const nameOf = (id: string) =>
    graph?.points.find((p) => p.id === id)?.name ?? id;

  const Tag = ({ text, tone }: { text: string; tone: "ok" | "weak" }) => (
    <span
      className={`mb-1 mr-1 inline-block rounded-md px-2 py-0.5 text-xs font-medium ${
        tone === "ok"
          ? "bg-emerald-400/15 text-emerald-200 ring-1 ring-emerald-300/20"
          : "bg-rose-400/15 text-rose-200 ring-1 ring-rose-300/20"
      }`}
    >
      {text}
    </span>
  );

  const bodyFor = (id: View): ReactNode => {
    if (id === "profile")
      return (
        <div>
          <div className="text-[11px] uppercase tracking-wider text-violet-300/70">
            学习目标
          </div>
          <div className="mt-1 text-sm text-violet-50">{profile?.goal || "—"}</div>
          <div className="mt-3 text-[11px] uppercase tracking-wider text-violet-300/70">
            已掌握
          </div>
          <div className="mt-1">
            {profile?.mastered.length ? (
              profile.mastered.map((m) => <Tag key={m} text={nameOf(m)} tone="ok" />)
            ) : (
              <span className="text-xs text-violet-300/50">尚无</span>
            )}
          </div>
          <div className="mt-2 text-[11px] uppercase tracking-wider text-violet-300/70">
            薄弱点
          </div>
          <div className="mt-1">
            {profile?.weak_points.length ? (
              profile.weak_points.map((m) => (
                <Tag key={m} text={nameOf(m)} tone="weak" />
              ))
            ) : (
              <span className="text-xs text-violet-300/50">尚无</span>
            )}
          </div>
          <button
            onClick={() => {
              if (window.confirm("确定清空当前学习画像吗？此操作不可撤销。")) {
                onResetProfile();
              }
            }}
            className="mt-4 w-full rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-200 transition hover:bg-rose-500/20"
          >
            重置画像
          </button>
        </div>
      );
    if (id === "graph")
      return (
        <div>
          <button
            onClick={onPlan}
            className="w-full rounded-lg bg-gradient-to-r from-violet-500 to-cyan-500 px-3 py-2 text-xs font-semibold text-white shadow-lg shadow-violet-900/40 transition hover:brightness-110"
          >
            生成个性化学习路径
          </button>
          {path.length > 0 ? (
            <ol className="mt-3 space-y-1">
              {path.map((id, i) => (
                <li key={id} className="flex items-center gap-2 text-xs text-violet-100">
                  <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-white/15 text-[10px] font-semibold">
                    {i + 1}
                  </span>
                  {nameOf(id)}
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-2 text-xs text-violet-300/60">
              点击上方按钮生成推荐顺序
            </p>
          )}
        </div>
      );
    if (id === "favorites")
      return (
        <div className="text-xs leading-relaxed text-violet-200/80">
          你收藏的练习题在右侧按知识点分组展示，可移除或清空。
        </div>
      );
    return (
      <div>
        <div className="mb-1.5 text-[11px] uppercase tracking-wider text-violet-300/70">
          点击知识点直接学习
        </div>
        <ul className="space-y-0.5">
          {graph?.points.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => onPickKp(p.id)}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition ${
                  kpId === p.id
                    ? "bg-white/15 font-semibold text-white"
                    : "text-violet-200 hover:bg-white/8"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    kpId === p.id ? "bg-cyan-300" : "bg-violet-400/50"
                  }`}
                />
                {p.name}
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <div className="sidebar-bg flex h-full flex-col text-violet-100">
      {/* brand */}
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-violet-400 to-cyan-400 text-indigo-950 shadow-lg shadow-violet-900/50">
          <IconSparkles className="h-5 w-5" />
        </div>
        <div className="leading-tight">
          <div className="font-heading text-[15px] font-bold text-white">
            个性化学习
          </div>
          <div className="text-[11px] text-violet-300/80">多智能体系统</div>
        </div>
      </div>

      <div className="mx-5 mb-2 h-px bg-white/10" />

      {/* accordion */}
      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {META.map(({ id, label, icon: Icon }) => {
          const open = active === id;
          return (
            <div key={id} className="mb-1">
              <button
                onClick={() => onSelect(id)}
                className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
                  open
                    ? "bg-white/12 text-white shadow-inner"
                    : "text-violet-200 hover:bg-white/5"
                }`}
              >
                <span
                  className={`grid h-8 w-8 place-items-center rounded-lg transition ${
                    open
                      ? "bg-gradient-to-br from-violet-400/90 to-cyan-400/90 text-indigo-950"
                      : "bg-white/5 text-violet-200 group-hover:text-white"
                  }`}
                >
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <span className="flex-1">{label}</span>
                <IconChevron
                  className={`h-4 w-4 text-violet-300/70 transition-transform duration-200 ${
                    open ? "rotate-90" : ""
                  }`}
                />
              </button>
              {open && (
                <div className="animate-rise mt-1 rounded-xl bg-black/15 px-3 py-3">
                  {bodyFor(id)}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="px-5 py-3 text-[11px] text-violet-300/50">
        数据结构与算法 · 讯飞星火驱动
      </div>
    </div>
  );
}
