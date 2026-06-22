import { useEffect, useMemo, useState } from "react";

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
      400,
    );
    return () => clearInterval(t);
  }, [playing, frames.length]);
  const max = Math.max(...initial, 1);
  return (
    <div>
      <div className="flex h-48 items-end gap-1">
        {frames[f].map((v, i) => (
          <div
            key={i}
            className="flex-1 rounded-t bg-blue-500 text-center text-xs text-white"
            style={{ height: `${(v / max) * 100}%` }}
          >
            {v}
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2 text-sm">
        <button
          onClick={() => setPlaying((p) => !p)}
          className="rounded bg-gray-100 px-2 py-1"
        >
          {playing ? "暂停" : "播放"}
        </button>
        <button
          onClick={() => {
            setF(0);
            setPlaying(true);
          }}
          className="rounded bg-gray-100 px-2 py-1"
        >
          重播
        </button>
        <span className="ml-auto text-gray-400">
          第 {f + 1}/{frames.length} 帧（冒泡排序）
        </span>
      </div>
    </div>
  );
}
