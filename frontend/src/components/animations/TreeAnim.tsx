import { useEffect, useMemo, useState } from "react";

interface N {
  v: number;
  x: number;
  y: number;
}

export default function TreeAnim({ params }: { params: Record<string, any> }) {
  const values: number[] = params.nodes ?? [8, 3, 10, 1, 6, 14];

  const { nodes, links, order, W, H } = useMemo(() => {
    type T = { v: number; l?: T; r?: T };
    let root: T | undefined;
    const insert = (t: T | undefined, v: number): T => {
      if (!t) return { v };
      if (v < t.v) t.l = insert(t.l, v);
      else t.r = insert(t.r, v);
      return t;
    };
    values.forEach((v) => {
      root = insert(root, v);
    });

    const GAP_X = 62;
    const GAP_Y = 84;
    const PAD = 40;
    const ns: N[] = [];
    const ls: [N, N][] = [];
    const ord: number[] = [];
    let col = 0;
    const place = (t: T | undefined, depth: number): N | undefined => {
      if (!t) return undefined;
      const left = place(t.l, depth + 1);
      const node: N = { v: t.v, x: col++ * GAP_X + PAD, y: depth * GAP_Y + PAD };
      ns.push(node);
      ord.push(t.v);
      if (left) ls.push([node, left]);
      const right = place(t.r, depth + 1);
      if (right) ls.push([node, right]);
      return node;
    };
    place(root, 0);
    const w = Math.max(...ns.map((n) => n.x), 0) + PAD;
    const h = Math.max(...ns.map((n) => n.y), 0) + PAD;
    return { nodes: ns, links: ls, order: ord, W: w, H: h };
  }, [values]);

  const [step, setStep] = useState(0);
  useEffect(() => {
    setStep(0);
    const t = setInterval(
      () => setStep((s) => (s + 1 <= order.length ? s + 1 : s)),
      650,
    );
    return () => clearInterval(t);
  }, [order.length]);
  const highlighted = new Set(order.slice(0, step));

  return (
    <div>
      <div className="rounded-xl bg-slate-50 p-4">
        <svg
          width="100%"
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ display: "block", aspectRatio: `${W} / ${H}`, maxHeight: "60vh" }}
        >
          {links.map(([a, b], i) => (
            <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#ddd6fe" strokeWidth={2} />
          ))}
          {nodes.map((n) => (
            <g key={n.v}>
              <circle
                cx={n.x}
                cy={n.y}
                r="18"
                fill={highlighted.has(n.v) ? "#7c3aed" : "#f5f3ff"}
                stroke={highlighted.has(n.v) ? "#7c3aed" : "#ddd6fe"}
                strokeWidth={1.5}
              />
              <text
                x={n.x}
                y={n.y + 5}
                textAnchor="middle"
                fontSize="14"
                fontWeight={highlighted.has(n.v) ? 600 : 400}
                fill={highlighted.has(n.v) ? "white" : "#64748b"}
              >
                {n.v}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <div className="mt-2 text-sm text-slate-500">
        中序遍历高亮顺序（升序）：
        <span className="font-medium text-violet-700">
          {order.slice(0, step).join(" → ")}
        </span>
      </div>
    </div>
  );
}
