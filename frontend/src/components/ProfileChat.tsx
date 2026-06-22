import { useEffect, useRef, useState } from "react";
import { streamSSE } from "../api/client";
import type { Profile } from "../types";
import { IconSend, IconSparkles } from "./icons";

interface Msg {
  role: "user" | "agent";
  text: string;
  thinking?: boolean;
}

export default function ProfileChat({
  onProfile,
}: {
  onProfile: (p: Profile) => void;
}) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setMsgs((m) => [...m, { role: "user", text }]);
    setBusy(true);
    let agentText = "";
    setMsgs((m) => [...m, { role: "agent", text: "", thinking: true }]);
    const set = (patch: Partial<Msg>) =>
      setMsgs((m) => {
        const copy = [...m];
        copy[copy.length - 1] = { ...copy[copy.length - 1], ...patch };
        return copy;
      });
    await streamSSE("/chat", { message: text }, (ev) => {
      if (ev.type === "token") {
        agentText += ev.content;
        set({ text: agentText, thinking: false });
      } else if (ev.type === "agent_error") {
        set({ text: `画像分析降级：${ev.content}`, thinking: false });
      } else if (ev.type === "agent_done" && ev.data?.profile) {
        onProfile(ev.data.profile as Profile);
      }
    }).catch(() => set({ text: "请求失败：后端未启动或地址不对。", thinking: false }));
    setBusy(false);
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-soft">
      <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3.5">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-violet-50 text-violet-600">
          <IconSparkles className="h-4 w-4" />
        </span>
        <span className="font-heading text-sm font-semibold text-indigo-950">
          画像 Agent
        </span>
        <span className="ml-2 h-1.5 w-1.5 rounded-full bg-emerald-400" />
        <span className="text-xs text-slate-400">在线</span>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
        {msgs.length === 0 && (
          <div className="mx-auto mt-8 max-w-md rounded-2xl border border-dashed border-violet-200 bg-violet-50/40 p-5 text-center">
            <div className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 text-white">
              <IconSparkles className="h-5 w-5" />
            </div>
            <p className="text-sm text-slate-600">
              试着说：「我学过数组和链表，但动态规划很弱，想准备数据结构期末考，喜欢看动画。」
            </p>
          </div>
        )}
        {msgs.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[80%] rounded-2xl rounded-br-md bg-gradient-to-br from-violet-600 to-violet-500 px-4 py-2.5 text-sm text-white shadow-sm">
                {m.text}
              </div>
            </div>
          ) : (
            <div key={i} className="flex items-start gap-2.5">
              <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-violet-100 text-violet-600">
                <IconSparkles className="h-4 w-4" />
              </span>
              <div className="max-w-[80%] rounded-2xl rounded-tl-md border border-slate-100 bg-slate-50 px-4 py-2.5 text-sm text-slate-700">
                {m.thinking ? (
                  <span className="flex items-center gap-1 py-1">
                    {[0, 1, 2].map((d) => (
                      <span
                        key={d}
                        className="typing-dot h-1.5 w-1.5 rounded-full bg-violet-400"
                        style={{ animationDelay: `${d * 0.15}s` }}
                      />
                    ))}
                  </span>
                ) : (
                  m.text
                )}
              </div>
            </div>
          ),
        )}
        <div ref={endRef} />
      </div>

      <div className="flex items-center gap-2 border-t border-slate-100 p-3">
        <input
          className="flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-violet-300 focus:bg-white focus:ring-2 focus:ring-violet-200"
          value={input}
          placeholder="说说你的基础、目标和偏好…"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
        />
        <button
          onClick={send}
          disabled={busy || !input.trim()}
          aria-label="发送"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-600 to-violet-500 text-white shadow-glow transition hover:brightness-110 disabled:opacity-40"
        >
          <IconSend className="h-[18px] w-[18px]" />
        </button>
      </div>
    </div>
  );
}
