import type { KnowledgePoint } from "../types";

// 节点卡尺寸与间距（组件定位连线锚点时复用 NODE_W/NODE_H）
export const NODE_W = 124;
export const NODE_H = 54;
const H_GAP = 24;
const V_GAP = 66;
const PAD = 28;

export interface LaidOutNode {
  point: KnowledgePoint;
  x: number; // 左上角
  y: number;
  tier: number;
}

export interface TierLayout {
  nodes: LaidOutNode[];
  posById: Record<string, { x: number; y: number }>;
  width: number;
  height: number;
}

/** 按先修关系分层：层号 = 最长先修链深度，保证节点排在其全部先修下方。 */
export function computeTiers(points: KnowledgePoint[]): TierLayout {
  const byId = new Map(points.map((p) => [p.id, p]));
  const memo = new Map<string, number>();

  function depth(id: string, stack: Set<string>): number {
    const cached = memo.get(id);
    if (cached !== undefined) return cached;
    const p = byId.get(id);
    if (!p || p.prerequisites.length === 0) {
      memo.set(id, 0);
      return 0;
    }
    if (stack.has(id)) return 0; // 防御：先修出现环时退化为 0
    stack.add(id);
    let d = 0;
    for (const pre of p.prerequisites) {
      if (byId.has(pre)) d = Math.max(d, depth(pre, stack) + 1);
    }
    stack.delete(id);
    memo.set(id, d);
    return d;
  }

  const tiers: KnowledgePoint[][] = [];
  for (const p of points) {
    const d = depth(p.id, new Set());
    if (!tiers[d]) tiers[d] = [];
    tiers[d].push(p); // 层内保持输入顺序
  }

  const rowWidths = tiers.map(
    (row) => row.length * NODE_W + (row.length - 1) * H_GAP,
  );
  const width = Math.max(...rowWidths) + PAD * 2;
  const height = PAD * 2 + tiers.length * NODE_H + (tiers.length - 1) * V_GAP;

  const nodes: LaidOutNode[] = [];
  const posById: Record<string, { x: number; y: number }> = {};
  tiers.forEach((row, t) => {
    const startX = (width - rowWidths[t]) / 2;
    const y = PAD + t * (NODE_H + V_GAP);
    row.forEach((p, i) => {
      const x = startX + i * (NODE_W + H_GAP);
      nodes.push({ point: p, x, y, tier: t });
      posById[p.id] = { x, y };
    });
  });

  return { nodes, posById, width, height };
}

export type NodeStatus = "mastered" | "ready" | "locked";

export function unmetPrereqs(
  point: KnowledgePoint,
  mastered: Set<string>,
): string[] {
  return point.prerequisites.filter((pre) => !mastered.has(pre));
}

export function nodeStatus(
  point: KnowledgePoint,
  mastered: Set<string>,
): NodeStatus {
  if (mastered.has(point.id)) return "mastered";
  return unmetPrereqs(point, mastered).length === 0 ? "ready" : "locked";
}
