import { useEffect, useState } from "react";
import { getJSON, postJSON, streamSSE } from "./api/client";
import type { AgentEvent, Graph, Profile } from "./types";
import ProfileChat from "./components/ProfileChat";
import ProfileCard from "./components/ProfileCard";
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

  async function learn() {
    setEvents([]);
    setBusy(true);
    await streamSSE("/learn", { kp_id: kpId }, (ev) =>
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
  }

  const explanation = lastDone(events, "tutor");
  const viz = lastDone(events, "visualizer");
  const quiz = lastDone(events, "quizzer");

  const NavBtn = ({ id, label }: { id: View; label: string }) => (
    <button
      onClick={() => setView(id)}
      className={`rounded px-3 py-1 text-sm ${
        view === id ? "bg-blue-500 text-white" : "bg-gray-100"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-4 flex items-center gap-4">
        <h1 className="text-2xl font-bold">个性化学习多智能体系统</h1>
        <span className="text-sm text-gray-400">数据结构与算法</span>
        <nav className="ml-auto flex gap-2">
          <NavBtn id="profile" label="① 对话画像" />
          <NavBtn id="graph" label="② 知识图谱" />
          <NavBtn id="workbench" label="③ 学习工作台" />
        </nav>
      </div>

      {view === "profile" && (
        <div className="grid h-[70vh] grid-cols-3 gap-4">
          <div className="col-span-2">
            <ProfileChat onProfile={setProfile} />
          </div>
          <ProfileCard profile={profile} />
        </div>
      )}

      {view === "graph" && graph && (
        <div>
          <div className="mb-2 flex items-center gap-3">
            <button
              onClick={plan}
              className="rounded bg-blue-500 px-3 py-1 text-sm text-white"
            >
              生成个性化学习路径
            </button>
            <span className="text-sm text-gray-500">{rationale}</span>
          </div>
          <div className="rounded-lg border bg-white">
            <KnowledgeGraph
              graph={graph}
              path={path}
              onSelect={(id) => {
                setKpId(id);
                setView("workbench");
              }}
            />
          </div>
        </div>
      )}

      {view === "workbench" && (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <select
              value={kpId}
              onChange={(e) => setKpId(e.target.value)}
              className="rounded border px-2 py-1 text-sm"
            >
              {graph?.points.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button
              onClick={learn}
              disabled={busy}
              className="rounded bg-blue-500 px-3 py-1 text-sm text-white disabled:opacity-50"
            >
              开始学习（触发多 Agent 协同）
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
    </div>
  );
}
