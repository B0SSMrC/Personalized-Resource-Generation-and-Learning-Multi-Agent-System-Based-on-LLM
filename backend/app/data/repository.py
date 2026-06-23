import hashlib
import heapq
import json
import sqlite3
from pathlib import Path

from app.models import FavoriteQuestion, KnowledgePoint, Profile, ResourceBundle

_DATA_DIR = Path(__file__).parent
_GRAPH_FILE = _DATA_DIR / "knowledge_graph.json"


# ---------- 知识图谱 ----------

def load_graph() -> tuple[dict[str, KnowledgePoint], list[tuple[str, str]]]:
    raw = json.loads(_GRAPH_FILE.read_text(encoding="utf-8"))
    points = {p["id"]: KnowledgePoint(**p) for p in raw["points"]}
    edges = [(pre, pid) for pid, p in points.items() for pre in p.prerequisites]
    return points, edges


def compute_path(points: dict[str, KnowledgePoint],
                 mastered: set[str], weak_points: set[str]) -> list[str]:
    """Kahn 拓扑排序 + 优先队列：薄弱点优先、难度低优先，且满足先修约束。"""
    indeg: dict[str, int] = {}
    for pid, p in points.items():
        if pid in mastered:
            continue
        indeg[pid] = sum(1 for pre in p.prerequisites
                         if pre in points and pre not in mastered)

    def key(pid: str):
        p = points[pid]
        return (0 if pid in weak_points else 1, p.difficulty, p.name)

    heap = [(key(pid), pid) for pid, d in indeg.items() if d == 0]
    heapq.heapify(heap)
    order: list[str] = []
    while heap:
        _, pid = heapq.heappop(heap)
        order.append(pid)
        for cid, cp in points.items():
            if cid in indeg and pid in cp.prerequisites:
                indeg[cid] -= 1
                if indeg[cid] == 0:
                    heapq.heappush(heap, (key(cid), cid))
    return order


# ---------- 预烘资源 ----------

def get_resource(kp_id: str) -> ResourceBundle | None:
    points, _ = load_graph()
    p = points.get(kp_id)
    if p is None or not p.resource_ref:
        return None
    path = _DATA_DIR / p.resource_ref
    if not path.exists():
        return None
    return ResourceBundle(**json.loads(path.read_text(encoding="utf-8")))


# ---------- 画像仓储 ----------

class InMemoryProfileRepo:
    def __init__(self):
        self._store: dict[str, Profile] = {}

    def get_profile(self, learner_id: str = "demo") -> Profile:
        return self._store.get(learner_id) or Profile(learner_id=learner_id)

    def save_profile(self, profile: Profile) -> None:
        self._store[profile.learner_id] = profile

    def append_history(self, learner_id: str, entry: dict) -> Profile:
        p = self.get_profile(learner_id)
        p.history.append(entry)
        self.save_profile(p)
        return p


class SQLiteProfileRepo:
    def __init__(self, db_path: str):
        self.db_path = db_path
        with sqlite3.connect(self.db_path) as con:
            con.execute("CREATE TABLE IF NOT EXISTS profiles "
                        "(learner_id TEXT PRIMARY KEY, json TEXT)")

    def get_profile(self, learner_id: str = "demo") -> Profile:
        with sqlite3.connect(self.db_path) as con:
            row = con.execute("SELECT json FROM profiles WHERE learner_id=?",
                              (learner_id,)).fetchone()
        if not row:
            return Profile(learner_id=learner_id)
        return Profile.model_validate_json(row[0])

    def save_profile(self, profile: Profile) -> None:
        with sqlite3.connect(self.db_path) as con:
            con.execute("INSERT INTO profiles(learner_id, json) VALUES(?,?) "
                        "ON CONFLICT(learner_id) DO UPDATE SET json=excluded.json",
                        (profile.learner_id, profile.model_dump_json()))

    def append_history(self, learner_id: str, entry: dict) -> Profile:
        p = self.get_profile(learner_id)
        p.history.append(entry)
        self.save_profile(p)
        return p


def _make_repo():
    try:
        from app.config import settings
        if settings.db_path:
            return SQLiteProfileRepo(settings.db_path)
    except Exception:  # noqa: BLE001  回退内存
        pass
    return InMemoryProfileRepo()


profile_repo = _make_repo()


# ---------- 收藏仓储 ----------

def fav_id(kp_id: str, stem: str) -> str:
    return hashlib.sha1(f"{kp_id}|{stem}".encode("utf-8")).hexdigest()[:12]


class InMemoryFavoritesRepo:
    def __init__(self):
        self._store: dict[str, dict[str, FavoriteQuestion]] = {}

    def list(self, learner_id: str = "demo") -> list[FavoriteQuestion]:
        return list(self._store.get(learner_id, {}).values())

    def add(self, learner_id: str, fav: FavoriteQuestion) -> FavoriteQuestion:
        fav = fav.model_copy(update={"id": fav_id(fav.kp_id, fav.stem)})
        self._store.setdefault(learner_id, {})[fav.id] = fav
        return fav

    def remove(self, learner_id: str, qid: str) -> None:
        self._store.get(learner_id, {}).pop(qid, None)

    def clear(self, learner_id: str, kp_id: str | None = None) -> None:
        store = self._store.get(learner_id)
        if store is None:
            return
        if kp_id is None:
            store.clear()
        else:
            for i in [i for i, f in store.items() if f.kp_id == kp_id]:
                store.pop(i, None)


class SQLiteFavoritesRepo:
    def __init__(self, db_path: str):
        self.db_path = db_path
        with sqlite3.connect(self.db_path) as con:
            con.execute(
                "CREATE TABLE IF NOT EXISTS favorites "
                "(learner_id TEXT, id TEXT, kp_id TEXT, stem TEXT, answer TEXT, "
                "difficulty INTEGER, PRIMARY KEY (learner_id, id))"
            )

    def list(self, learner_id: str = "demo") -> list[FavoriteQuestion]:
        with sqlite3.connect(self.db_path) as con:
            rows = con.execute(
                "SELECT id, kp_id, stem, answer, difficulty FROM favorites WHERE learner_id=?",
                (learner_id,),
            ).fetchall()
        return [FavoriteQuestion(id=r[0], kp_id=r[1], stem=r[2], answer=r[3], difficulty=r[4])
                for r in rows]

    def add(self, learner_id: str, fav: FavoriteQuestion) -> FavoriteQuestion:
        fav = fav.model_copy(update={"id": fav_id(fav.kp_id, fav.stem)})
        with sqlite3.connect(self.db_path) as con:
            con.execute(
                "INSERT OR REPLACE INTO favorites"
                "(learner_id, id, kp_id, stem, answer, difficulty) VALUES(?,?,?,?,?,?)",
                (learner_id, fav.id, fav.kp_id, fav.stem, fav.answer, fav.difficulty),
            )
        return fav

    def remove(self, learner_id: str, qid: str) -> None:
        with sqlite3.connect(self.db_path) as con:
            con.execute("DELETE FROM favorites WHERE learner_id=? AND id=?", (learner_id, qid))

    def clear(self, learner_id: str, kp_id: str | None = None) -> None:
        with sqlite3.connect(self.db_path) as con:
            if kp_id is None:
                con.execute("DELETE FROM favorites WHERE learner_id=?", (learner_id,))
            else:
                con.execute("DELETE FROM favorites WHERE learner_id=? AND kp_id=?",
                            (learner_id, kp_id))


def _make_favorites_repo():
    try:
        from app.config import settings
        if settings.db_path:
            return SQLiteFavoritesRepo(settings.db_path)
    except Exception:  # noqa: BLE001  回退内存
        pass
    return InMemoryFavoritesRepo()


favorites_repo = _make_favorites_repo()
