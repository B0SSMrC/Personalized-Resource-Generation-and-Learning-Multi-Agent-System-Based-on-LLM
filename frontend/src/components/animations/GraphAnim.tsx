import { useEffect, useMemo, useState } from "react";

export default function GraphAnim({ params }: { params: Record<string, any> }) {
  const nodes: string[] = params.nodes ?? ["A", "B", "C", "D", "E"];
  const edges: [string, string][] =
    params.edges ?? [
      ["A", "B"],
      ["A", "C"],
      ["B", "D"],
      ["C", "E"],
    ];
  const start: string = params.start ?? nodes[0];

  const order = useMemo(() => {
    const adj: Record<string, string[]> = {};
    nodes.forEach((n) => (adj[n] = []));
    edges.forEach(([a, b]) => {
      adj[a]?.push(b);
      adj[b]?.push(a);
    });
    const seen = new Set([start]);
    const q = [start];
    const out: string[] = [];
    while (q.length) {
      const x = q.shift()!;
      out.push(x);
      for (const y of adj[x] ?? [])
        if (!seen.has(y)) {
          seen.add(y);
          q.push(y);
        }
    }
    return out;
  }, [nodes, edges, start]);

  const pos = useMemo(() => {
    const p: Record<string, { x: number; y: number }> = {};
    nodes.forEach((n, i) => {
      const ang = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
      p[n] = { x: 150 + 100 * Math.cos(ang), y: 120 + 90 * Math.sin(ang) };
    });
    return p;
  }, [nodes]);

  const [step, setStep] = useState(0);
  useEffect(() => {
    setStep(0);
    const t = setInterval(
      () => setStep((s) => (s + 1 <= order.length ? s + 1 : s)),
      650,
    );
    return () => clearInterval(t);
  }, [order.length]);
  const visited = new Set(order.slice(0, step));

  return (
    <div>
      <div className="rounded-xl bg-slate-50 p-3">
        <svg width="100%" height="240" viewBox="0 0 300 240">
          {edges.map(([a, b], i) => (
            <line
              key={i}
              x1={pos[a].x}
              y1={pos[a].y}
              x2={pos[b].x}
              y2={pos[b].y}
              stroke="#ddd6fe"
              strokeWidth={2}
            />
          ))}
          {nodes.map((n) => (
            <g key={n}>
              <circle
                cx={pos[n].x}
                cy={pos[n].y}
                r="16"
                fill={visited.has(n) ? "#7c3aed" : "#f5f3ff"}
                stroke={visited.has(n) ? "#7c3aed" : "#ddd6fe"}
                strokeWidth={1.5}
              />
              <text
                x={pos[n].x}
                y={pos[n].y + 4}
                textAnchor="middle"
                fontSize="12"
                fontWeight={visited.has(n) ? 600 : 400}
                fill={visited.has(n) ? "white" : "#64748b"}
              >
                {n}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <div className="mt-2 text-xs text-slate-500">
        BFS 遍历顺序：
        <span className="font-medium text-violet-700">
          {order.slice(0, step).join(" → ")}
        </span>
      </div>
    </div>
  );
}
