import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { IconPause, IconPlay, IconReplay } from "../icons";

export default function SortingAnim({ params }: { params: Record<string, any> }) {
  const initial: number[] = params.values ?? [5, 2, 8, 1, 9, 3];
  const frames = useMemo(() => {
    const a = [...initial];
    const out: number[][] = [[...a]];
    for (let i = 0; i < a.length; i++)
      for (let j = 0; j < a.length - 1 - i; j++)
        if (a[j] > a[j + 1]) {
          [a[j], a[j + 1]] = [a[j + 1], a[j]];
          out.push([...a]);
        }
    return out;
  }, [initial]);
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
      420,
    );
    return () => clearInterval(t);
  }, [playing, frames.length]);
  const max = Math.max(...initial, 1);

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
      <div className="flex h-52 items-end gap-1.5 rounded-xl bg-slate-50 p-3">
        {frames[f].map((v, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-md bg-gradient-to-t from-violet-600 to-cyan-400 text-center text-xs font-medium text-white transition-all duration-300"
            style={{ height: `${(v / max) * 100}%` }}
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
          第 {f + 1}/{frames.length} 帧 · 冒泡排序
        </span>
      </div>
    </div>
  );
}
