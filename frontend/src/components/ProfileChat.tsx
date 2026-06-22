import { useState } from "react";
import { streamSSE } from "../api/client";
import type { Profile } from "../types";

interface Msg {
  role: "user" | "agent";
  text: string;
}

export default function ProfileChat({
  onProfile,
}: {
  onProfile: (p: Profile) => void;
}) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setMsgs((m) => [...m, { role: "user", text }]);
    setBusy(true);
    let agentText = "";
    setMsgs((m) => [...m, { role: "agent", text: "" }]);
    const set = (t: string) =>
      setMsgs((m) => {
        const copy = [...m];
        copy[copy.length - 1] = { role: "agent", text: t };
        return copy;
      });
    await streamSSE("/chat", { message: text }, (ev) => {
      if (ev.type === "agent_start") {
        set("（画像 Agent 分析中…）");
      } else if (ev.type === "token") {
        agentText += ev.content;
        set(agentText);
      } else if (ev.type === "agent_error") {
        set(`（画像分析降级：${ev.content}）`);
      } else if (ev.type === "agent_done" && ev.data?.profile) {
        onProfile(ev.data.profile as Profile);
      }
    }).catch((e) => {
      console.error(e);
      set("（请求失败：后端没启动或端口不对，请看下方排查）");
    });
    setBusy(false);
  }

  return (
    <div className="flex h-full flex-col rounded-lg border bg-white">
      <div className="border-b p-3 text-sm font-semibold">对话式学习画像构建</div>
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {msgs.length === 0 && (
          <div className="text-sm text-gray-400">
            试着说：「我学过数组和链表，但动态规划很弱，想准备数据结构期末考，喜欢看动画。」
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
            <span
              className={`inline-block rounded-lg px-3 py-1.5 text-sm ${
                m.role === "user" ? "bg-blue-500 text-white" : "bg-gray-100"
              }`}
            >
              {m.text || "…"}
            </span>
          </div>
        ))}
      </div>
      <div className="flex gap-2 border-t p-2">
        <input
          className="flex-1 rounded border px-2 py-1 text-sm"
          value={input}
          placeholder="说说你的基础、目标和偏好…"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
        />
        <button
          onClick={send}
          disabled={busy}
          className="rounded bg-blue-500 px-3 py-1 text-sm text-white disabled:opacity-50"
        >
          发送
        </button>
      </div>
    </div>
  );
}
