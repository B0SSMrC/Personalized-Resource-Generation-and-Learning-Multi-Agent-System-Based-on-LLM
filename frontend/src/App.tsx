import { useEffect, useState } from "react";
import { getJSON, postJSON, streamSSE } from "./api/client";
import type { AgentEvent, Graph, Profile } from "./types";
import Sidebar from "./components/Sidebar";
import ProfileChat from "./components/ProfileChat";
import AgentFeed from "./components/AgentFeed";
import ResourcePanel from "./components/ResourcePanel";
import KnowledgeGraph from "./components/KnowledgeGraph";

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
    setView("graph"); // 展示重规划后的路径
  }

  const explanation = lastDone(events, "tutor");
  const viz = lastDone(events, "visualizer");
  const quiz = lastDone(events, "quizzer");
  const currentName = graph?.points.find((p) => p.id === kpId)?.name ?? kpId;

  return (
    <div className="flex h-screen text-gray-800">
      <aside className="w-64 shrink-0 overflow-y-auto border-r bg-white">
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

      <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
        {view === "profile" && (
          <div>
            <h2 className="mb-3 text-xl font-bold">① 对话式学习画像构建</h2>
            <div className="h-[80vh]">
              <ProfileChat onProfile={setProfile} />
            </div>
          </div>
        )}

        {view === "graph" && graph && (
          <div>
            <h2 className="mb-3 text-xl font-bold">② 知识图谱与个性化路径</h2>
            {rationale && (
              <p className="mb-3 rounded-lg bg-blue-50 p-3 text-sm leading-relaxed text-gray-700">
                {rationale}
              </p>
            )}
            <div className="rounded-lg border bg-white">
              <KnowledgeGraph
                graph={graph}
                path={path}
                onSelect={(id) => learn(id)}
              />
            </div>
          </div>
        )}

        {view === "workbench" && (
          <div>
            <div className="mb-3 flex items-center gap-3">
              <h2 className="text-xl font-bold">③ 学习工作台</h2>
              <span className="rounded bg-white px-2 py-0.5 text-sm text-gray-500 shadow-sm">
                当前：{currentName}
              </span>
              <button
                onClick={() => learn(kpId)}
                disabled={busy}
                className="rounded bg-blue-500 px-3 py-1 text-sm text-white disabled:opacity-50"
              >
                {busy ? "生成中…" : events.length ? "重新生成" : "开始学习"}
              </button>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="min-w-0">
                <AgentFeed events={events} />
              </div>
              <div className="col-span-2 min-w-0">
                <ResourcePanel
                  explanationMd={explanation?.data?.explanation_md ?? ""}
                  viz={viz?.data?.viz ?? null}
                  questions={quiz?.data?.questions ?? []}
                  kpId={kpId}
                  onComplete={complete}
                />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
