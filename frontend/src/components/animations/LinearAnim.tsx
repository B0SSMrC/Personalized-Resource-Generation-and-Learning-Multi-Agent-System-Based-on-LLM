export default function LinearAnim({ params }: { params: Record<string, any> }) {
  const values: number[] = params.values ?? [5, 2, 8, 1, 9];
  const hi: number = params.index ?? -1;
  const structure: string = params.structure ?? "array";
  return (
    <div>
      <div className="flex flex-wrap gap-1.5 rounded-xl bg-slate-50 p-4">
        {values.map((v, i) => (
          <div
            key={i}
            className={`flex h-14 w-14 items-center justify-center rounded-lg border text-sm font-medium transition ${
              i === hi
                ? "border-violet-400 bg-gradient-to-br from-violet-100 to-cyan-50 font-bold text-violet-700 shadow-sm"
                : "border-slate-200 bg-white text-slate-600"
            }`}
          >
            {v}
          </div>
        ))}
      </div>
      <div className="mt-2 text-xs text-slate-500">
        结构：<span className="font-medium text-violet-700">{structure}</span>
        {hi >= 0 && hi < values.length
          ? ` · 高亮下标 [${hi}] = ${values[hi]}`
          : ""}
      </div>
    </div>
  );
}
