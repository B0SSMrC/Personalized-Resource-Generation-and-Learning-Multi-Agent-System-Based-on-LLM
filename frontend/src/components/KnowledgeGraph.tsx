import { useMemo } from "react";
import type { Graph, Profile } from "../types";
import {
  computeTiers,
  nodeStatus,
  unmetPrereqs,
  NODE_W,
  NODE_H,
} from "../lib/tiers";
import type { NodeStatus } from "../lib/tiers";
import { IconCheck, IconLock, IconRoute, IconSparkles } from "./icons";

interface Props {
  graph: Graph;
  path: string[];
  profile: Profile | null;
  onSelect: (id: string) => void;
}

const STATUS_CARD: Record<NodeStatus, string> = {
  mastered: "border-emerald-200 bg-emerald-50/70 text-emerald-900",
  ready:
    "border-violet-300 bg-white text-indigo-950 hover:border-violet-400 hover:shadow-glow",
  locked: "border-slate-200 bg-slate-50 text-slate-400",
};

export default function KnowledgeGraph({ graph, path, profile, onSelect }: Props) {
  const { nodes, posById, width, height } = useMemo(
    () => computeTiers(graph.points),
    [graph.points],
  );
  const mastered = useMemo(
    () => new Set(profile?.mastered ?? []),
    [profile],
  );
  const weak = useMemo(() => new Set(profile?.weak_points ?? []), [profile]);
  const orderById = useMemo(() => {
    const m: Record<string, number> = {};
    path.forEach((id, i) => (m[id] = i + 1));
    return m;
  }, [path]);
  const nextId = path[0];
  const nextNode = graph.points.find((p) => p.id === nextId);

  return (
    <div>
      {nextNode && (
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-50 to-cyan-50 p-4 shadow-soft">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 text-white">
            <IconRoute className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold uppercase tracking-wider text-violet-500">
              下一步推荐
            </div>
            <div className="font-heading text-lg font-bold text-indigo-950">
              {nextNode.name}
              <span className="ml-2 text-xs font-normal text-slate-500">
                难度 {nextNode.difficulty} · 约 {nextNode.est_minutes} 分钟
              </span>
            </div>
          </div>
          <button
            onClick={() => onSelect(nextId)}
            className="shrink-0 rounded-full bg-gradient-to-r from-violet-600 to-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-glow transition hover:brightness-110"
          >
            去学习
          </button>
        </div>
      )}
      <div className="w-full overflow-x-auto">
      <div className="relative mx-auto" style={{ width, height }}>
        {/* 先修连线层 */}
        <svg
          className="pointer-events-none absolute inset-0"
          width={width}
          height={height}
        >
          {graph.edges.map(([from, to]) => {
            const a = posById[from];
            const b = posById[to];
            if (!a || !b) return null;
            const x1 = a.x + NODE_W / 2;
            const y1 = a.y + NODE_H;
            const x2 = b.x + NODE_W / 2;
            const y2 = b.y;
            const dy = (y2 - y1) / 2;
            const onPath = Boolean(orderById[from] && orderById[to]);
            return (
              <path
                key={`${from}-${to}`}
                d={`M ${x1} ${y1} C ${x1} ${y1 + dy}, ${x2} ${y2 - dy}, ${x2} ${y2}`}
                fill="none"
                stroke={onPath ? "#7c3aed" : "#e2e8f0"}
                strokeWidth={onPath ? 2.5 : 1.5}
              />
            );
          })}
        </svg>

        {/* 节点卡 */}
        {nodes.map(({ point, x, y }) => {
          const status = nodeStatus(point, mastered);
          const isWeak = weak.has(point.id);
          const order = orderById[point.id];
          const isNext = point.id === nextId;
          const unmet = unmetPrereqs(point, mastered)
            .map((id) => graph.points.find((p) => p.id === id)?.name ?? id)
            .join("、");
          return (
            <div
              key={point.id}
              className="group absolute"
              style={{ left: x, top: y, width: NODE_W, height: NODE_H }}
            >
              <button
                onClick={() => onSelect(point.id)}
                className={`relative flex h-full w-full items-center justify-center rounded-xl border px-2 text-center text-sm font-medium shadow-soft transition ${STATUS_CARD[status]} ${
                  isNext ? "ring-2 ring-violet-500 ring-offset-2" : ""
                }`}
              >
                {status === "mastered" && (
                  <IconCheck className="mr-1 h-4 w-4 text-emerald-500" />
                )}
                {status === "locked" && (
                  <IconLock className="mr-1 h-3.5 w-3.5 text-slate-400" />
                )}
                <span className="truncate">{point.name}</span>
                {order && (
                  <span className="absolute -left-2 -top-2 grid h-5 w-5 place-items-center rounded-full bg-violet-600 text-[11px] font-bold text-white shadow">
                    {order}
                  </span>
                )}
                {isNext && (
                  <span className="absolute -right-2 -top-2 grid h-5 w-5 place-items-center rounded-full bg-amber-400 text-white shadow">
                    <IconSparkles className="h-3 w-3" />
                  </span>
                )}
                {isWeak && (
                  <span className="absolute -bottom-1.5 -right-1.5 h-3 w-3 rounded-full border-2 border-white bg-rose-500" />
                )}
              </button>

              {/* hover 浮层 */}
              <div className="pointer-events-none absolute left-1/2 top-full z-10 mt-1 hidden w-44 -translate-x-1/2 rounded-lg bg-indigo-950 px-3 py-2 text-xs text-violet-50 shadow-lg group-hover:block">
                <div className="font-semibold">{point.name}</div>
                <div className="mt-0.5 text-violet-200/80">
                  难度 {point.difficulty} · 约 {point.est_minutes} 分钟
                </div>
                <div className="mt-0.5 text-violet-200/80">
                  {status === "mastered"
                    ? "✅ 已掌握"
                    : status === "ready"
                      ? "🔓 可以开始学"
                      : `🔒 建议先学：${unmet}`}
                </div>
                {isWeak && <div className="mt-0.5 text-rose-300">🔴 薄弱点</div>}
              </div>
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
}
