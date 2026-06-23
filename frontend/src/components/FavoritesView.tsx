import type { FavoriteQuestion, Graph } from "../types";
import { IconStar } from "./icons";

interface Props {
  favorites: FavoriteQuestion[];
  graph: Graph | null;
  onRemove: (id: string) => void;
  onClear: (kpId?: string) => void;
}

export default function FavoritesView({ favorites, graph, onRemove, onClear }: Props) {
  const nameOf = (id: string) => graph?.points.find((p) => p.id === id)?.name ?? id;
  const groups: Record<string, FavoriteQuestion[]> = {};
  for (const f of favorites) {
    if (!groups[f.kp_id]) groups[f.kp_id] = [];
    groups[f.kp_id].push(f);
  }
  const kpIds = Object.keys(groups);

  if (favorites.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-violet-200 bg-white/60 p-10 text-center text-slate-400">
        还没有收藏的练习题，去「学习工作台 → 练习」里点 ⭐ 收藏吧。
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button
          onClick={() => {
            if (window.confirm("确定清空全部收藏吗？")) onClear();
          }}
          className="rounded-full border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-500 transition hover:bg-rose-50"
        >
          全部清空
        </button>
      </div>
      <div className="space-y-5">
        {kpIds.map((kid) => (
          <section key={kid} className="rounded-2xl border border-violet-100 bg-white p-4 shadow-soft">
            <header className="mb-3 flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-amber-100 text-amber-600">
                <IconStar className="h-4 w-4" />
              </span>
              <h3 className="font-heading text-base font-semibold text-indigo-950">{nameOf(kid)}</h3>
              <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs text-violet-600">
                {groups[kid].length} 题
              </span>
              <button
                onClick={() => onClear(kid)}
                className="ml-auto text-xs text-slate-400 transition hover:text-rose-500"
              >
                清空本知识点
              </button>
            </header>
            <ul className="space-y-2.5">
              {groups[kid].map((f) => (
                <li key={f.id} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5">
                  <div className="flex items-start gap-2 text-sm font-medium text-slate-800">
                    <span className="flex-1">{f.stem}</span>
                    <button
                      onClick={() => onRemove(f.id)}
                      className="shrink-0 text-xs text-slate-400 transition hover:text-rose-500"
                    >
                      移除
                    </button>
                  </div>
                  <details className="mt-2 text-sm text-slate-600">
                    <summary className="cursor-pointer text-violet-600 hover:text-violet-700">
                      查看答案
                    </summary>
                    <div className="mt-1">{f.answer || "（无）"}</div>
                  </details>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
