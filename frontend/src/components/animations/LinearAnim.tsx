import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { IconPause, IconPlay, IconReplay } from "../icons";

type CellState = "normal" | "visited" | "active" | "dim" | "found";
interface Frame {
  states: CellState[];
  note: string;
}

const CELL: Record<CellState, string> = {
  normal: "border-slate-200 bg-white text-slate-600",
  visited: "border-violet-200 bg-violet-50 text-violet-700",
  active:
    "border-violet-500 bg-gradient-to-br from-violet-500 to-cyan-400 text-white shadow-md scale-110",
  dim: "border-slate-100 bg-slate-50 text-slate-300 opacity-60",
  found:
    "border-emerald-400 bg-emerald-50 font-bold text-emerald-700 shadow-sm scale-105",
};

export default function LinearAnim({ params }: { params: Record<string, any> }) {
  const values: number[] = params.values ?? [5, 2, 8, 1, 9];
  const op: string = params.op ?? "scan";
  const structure: string = params.structure ?? "array";
  const target: number =
    params.index >= 0 && params.index < values.length
      ? params.index
      : values.length - 1;

  const frames: Frame[] = useMemo(() => {
    const n = values.length;
    const out: Frame[] = [];

    if (op === "binary_search") {
      const t = values[target];
      let lo = 0;
      let hi = n - 1;
      let guard = 0;
      while (lo <= hi && guard++ < 20) {
        const mid = (lo + hi) >> 1;
        out.push({
          states: values.map((_, i) =>
            i < lo || i > hi ? "dim" : i === mid ? "active" : "normal",
          ),
          note: `lo=${lo}　hi=${hi}　mid=${mid}：比较 ${values[mid]} 与目标 ${t}`,
        });
        if (values[mid] === t) {
          out.push({
            states: values.map((_, i) => (i === mid ? "found" : "dim")),
            note: `命中！目标 ${t} 在下标 ${mid}`,
          });
          break;
        }
        if (values[mid] < t) lo = mid + 1;
        else hi = mid - 1;
      }
    } else if (op === "push" || op === "enqueue") {
      const verb = op === "push" ? "入栈" : "入队";
      for (let i = 0; i < n; i++) {
        out.push({
          states: values.map((_, j) =>
            j < i ? "visited" : j === i ? "active" : "normal",
          ),
          note: `${verb} ${values[i]}`,
        });
      }
      out.push({
        states: values.map(() => "visited"),
        note:
          op === "push"
            ? "栈顶在右端，后进先出 (LIFO)"
            : "队尾入、队头出，先进先出 (FIFO)",
      });
    } else {
      // scan / access / traverse：指针从 0 移动到目标下标
      const verb = op === "traverse" ? "遍历到下标" : "访问下标";
      for (let i = 0; i <= target && i < n; i++) {
        out.push({
          states: values.map((_, j) =>
            j < i ? "visited" : j === i ? "active" : "normal",
          ),
          note: `${verb} ${i}`,
        });
      }
      out.push({
        states: values.map((_, j) =>
          j === target ? "found" : j < target ? "visited" : "normal",
        ),
        note: `到达下标 ${target}，值 = ${values[target]}`,
      });
    }

    if (!out.length) out.push({ states: values.map(() => "normal"), note: "" });
    return out;
  }, [values, op, target]);

  const [f, setF] = useState(0);
  const [playing, setPlaying] = useState(true);
  useEffect(() => {
    setF(0);
    setPlaying(true);
  }, [frames]);
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(
      () => setF((x) => (x + 1 < frames.length ? x + 1 : x)),
      750,
    );
    return () => clearInterval(t);
  }, [playing, frames.length]);

  const cur = frames[Math.min(f, frames.length - 1)];

  const Btn = ({ onClick, children }: { onClick: () => void; children: ReactNode }) => (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-lg bg-violet-50 px-2.5 py-1.5 text-xs font-medium text-violet-700 transition hover:bg-violet-100"
    >
      {children}
    </button>
  );

  return (
    <div>
      <div className="flex min-h-[150px] flex-wrap items-center gap-2.5 rounded-xl bg-slate-50 p-6">
        {values.map((v, i) => (
          <div
            key={i}
            className={`flex h-16 w-16 items-center justify-center rounded-xl border text-base font-medium transition-all duration-300 ${CELL[cur.states[i]]}`}
          >
            {v}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Btn onClick={() => setPlaying((p) => !p)}>
          {playing ? <IconPause className="h-3.5 w-3.5" /> : <IconPlay className="h-3.5 w-3.5" />}
          {playing ? "暂停" : "播放"}
        </Btn>
        <Btn
          onClick={() => {
            setF(0);
            setPlaying(true);
          }}
        >
          <IconReplay className="h-3.5 w-3.5" />
          重播
        </Btn>
        <span className="ml-auto text-xs text-slate-400">
          {structure} · 第 {Math.min(f, frames.length - 1) + 1}/{frames.length} 步
        </span>
      </div>
      <div className="mt-1.5 text-sm text-violet-700">{cur.note}</div>
    </div>
  );
}
