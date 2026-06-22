import type { Profile } from "../types";

export default function ProfileCard({ profile }: { profile: Profile | null }) {
  if (!profile) return <div className="text-gray-400">暂无画像</div>;
  const Tag = ({ text, color }: { text: string; color: string }) => (
    <span className={`mb-1 mr-1 inline-block rounded px-2 py-0.5 text-xs ${color}`}>
      {text}
    </span>
  );
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <h3 className="mb-2 font-semibold">学习画像</h3>
      <div className="mb-2 text-sm text-gray-600">目标：{profile.goal || "—"}</div>
      <div className="mb-2 text-sm text-gray-600">偏好：{profile.preference || "—"}</div>
      <div className="mb-2 text-sm text-gray-600">节奏：{profile.pace || "—"}</div>
      <div className="mb-1 text-xs text-gray-500">已掌握</div>
      <div>
        {profile.mastered.length
          ? profile.mastered.map((m) => (
              <Tag key={m} text={m} color="bg-green-100 text-green-700" />
            ))
          : <span className="text-xs text-gray-400">—</span>}
      </div>
      <div className="mb-1 mt-2 text-xs text-gray-500">薄弱点</div>
      <div>
        {profile.weak_points.length
          ? profile.weak_points.map((m) => (
              <Tag key={m} text={m} color="bg-red-100 text-red-700" />
            ))
          : <span className="text-xs text-gray-400">—</span>}
      </div>
    </div>
  );
}
