export default function LinearAnim({ params }: { params: Record<string, any> }) {
  const values: number[] = params.values ?? [5, 2, 8, 1, 9];
  const hi: number = params.index ?? -1;
  const structure: string = params.structure ?? "array";
  return (
    <div>
      <div className="flex gap-1">
        {values.map((v, i) => (
          <div
            key={i}
            className={`flex h-12 w-12 items-center justify-center rounded border text-sm ${
              i === hi ? "border-blue-500 bg-blue-100 font-bold" : "bg-white"
            }`}
          >
            {v}
          </div>
        ))}
      </div>
      <div className="mt-1 text-xs text-gray-500">
        结构：{structure}
        {hi >= 0 && hi < values.length
          ? ` · 高亮下标 [${hi}] = ${values[hi]}`
          : ""}
      </div>
    </div>
  );
}
