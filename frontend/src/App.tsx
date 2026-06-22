import { useEffect, useState } from "react";
import { getJSON, postJSON, streamSSE } from "./api/client";
import type { AgentEvent, Graph, Profile } from "./types";
import Sidebar from "./components/Sidebar";
import ProfileChat from "./components/ProfileChat";
import AgentFeed from "./components/AgentFeed";
import ResourcePanel from "./components/ResourcePanel";
import KnowledgeGraph from "./components/KnowledgeGraph";
import { IconReplay, IconRoute } from "./components/icons";

type View = "profile" | "graph" | "workbench";

function lastDone(events: AgentEvent[], agent: string): AgentEvent | undefined {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.agent === agent && e.type === "agent_done") return e;
  }
  return undefined;
}

export default function App() {
  const [view, setView] = useState<View>("profile");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [graph, setGraph] = useState<Graph | null>(null);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [kpId, setKpId] = useState("array");
  const [path, setPath] = useState<string[]>([]);
  const [rationale, setRationale] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getJSON<Profile>("/profile").then(setProfile).catch(console.error);
    getJSON<Graph>("/knowledge-graph").then(setGraph).catch(console.error);
  }, []);

  async function learn(id: string = kpId) {
    setKpId(id);
    setView("workbench");
    setEvents([]);
    setBusy(true);
    await streamSSE("/learn", { kp_id: id }, (ev) =>
      setEvents((prev) => [...prev, ev]),
    ).catch(console.error);
    setBusy(false);
  }

  async function plan() {
    setRationale("");
    await streamSSE("/plan", {}, (ev) => {
      if (ev.type === "token") setRationale((r) => r + ev.content);
      if (ev.type === "agent_done" && ev.data?.path) setPath(ev.data.path);
    }).catch(console.error);
  }

  async function complete(id: string) {
    const updated = await postJSON<Profile>("/complete", { kp_id: id });
    setProfile(updated);
    await plan();
    setView("graph");
  }

  const explanation = lastDone(events, "tutor");
  const viz = lastDone(events, "visualizer");
  const quiz = lastDone(events, "quizzer");
  const currentName = graph?.points.find((p) => p.id === kpId)?.name ?? kpId;

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="w-64 shrink-0">
        <Sidebar
          active={view}
          onSelect={setView}
          profile={profile}
          graph={graph}
          path={path}
          kpId={kpId}
          onPlan={plan}
          onPickKp={(id) => learn(id)}
        />
      </aside>

      <main className="app-bg flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-8 py-7">
          {view === "profile" && (
            <section>
              <header className="mb-5">
                <div className="text-xs font-semibold uppercase tracking-widest text-violet-500">
                  模块 01
                </div>
                <h1 className="mt-1 font-heading text-3xl font-bold">
                  <span className="text-gradient">对话式</span>学习画像构建
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  与画像 Agent 自然对话，系统实时构建你的个性化学习画像。
                </p>
              </header>
              <div className="h-[76vh]">
                <ProfileChat onProfile={setProfile} />
              </div>
            </section>
          )}

          {view === "graph" && graph && (
            <section>
              <header className="mb-5">
                <div className="text-xs font-semibold uppercase tracking-widest text-violet-500">
                  模块 02
                </div>
                <h1 className="mt-1 font-heading text-3xl font-bold">
                  知识图谱与<span className="text-gradient">个性化路径</span>
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  规划 Agent 依据先修关系与你的画像，推荐最优学习顺序。
                </p>
              </header>
              {rationale && (
                <div className="mb-4 flex gap-3 rounded-2xl border border-violet-100 bg-white/70 p-4 shadow-soft backdrop-blur">
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-violet-50 text-violet-600">
                    <IconRoute className="h-5 w-5" />
                  </span>
                  <p className="text-sm leading-relaxed text-slate-600">{rationale}</p>
                </div>
              )}
              <div className="rounded-2xl border border-violet-100 bg-white p-2 shadow-soft">
                <KnowledgeGraph
                  graph={graph}
                  path={path}
                  onSelect={(id) => learn(id)}
                />
              </div>
            </section>
          )}

          {view === "workbench" && (
            <section>
              <header className="mb-5 flex flex-wrap items-center gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-widest text-violet-500">
                    模块 03
                  </div>
                  <h1 className="mt-1 font-heading text-3xl font-bold">
                    学习<span className="text-gradient">工作台</span>
                  </h1>
                </div>
                <span className="ml-auto rounded-full border border-violet-100 bg-white px-3 py-1 text-sm text-slate-500 shadow-soft">
                  当前知识点 ·{" "}
                  <span className="font-semibold text-indigo-950">{currentName}</span>
                </span>
                <button
                  onClick={() => learn(kpId)}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-600 to-violet-500 px-4 py-2 text-sm font-semibold text-white shadow-glow transition hover:brightness-110 disabled:opacity-60"
                >
                  <IconReplay className="h-4 w-4" />
                  {busy ? "生成中…" : events.length ? "重新生成" : "开始学习"}
                </button>
              </header>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="min-w-0 lg:col-span-1">
                  <AgentFeed events={events} />
                </div>
                <div className="min-w-0 lg:col-span-2">
                  <ResourcePanel
                    explanationMd={explanation?.data?.explanation_md ?? ""}
                    viz={viz?.data?.viz ?? null}
                    questions={quiz?.data?.questions ?? []}
                    kpId={kpId}
                    onComplete={complete}
                  />
                </div>
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
