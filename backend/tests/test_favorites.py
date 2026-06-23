from app.data.repository import InMemoryFavoritesRepo, fav_id
from app.models import FavoriteQuestion


def test_add_returns_fav_with_derived_id_and_lists():
    repo = InMemoryFavoritesRepo()
    fav = repo.add("demo", FavoriteQuestion(kp_id="array", stem="数组访问复杂度?", answer="O(1)"))
    assert fav.id == fav_id("array", "数组访问复杂度?")
    items = repo.list("demo")
    assert len(items) == 1 and items[0].stem == "数组访问复杂度?"


def test_add_is_idempotent_by_kp_and_stem():
    repo = InMemoryFavoritesRepo()
    repo.add("demo", FavoriteQuestion(kp_id="array", stem="同题", answer="A"))
    repo.add("demo", FavoriteQuestion(kp_id="array", stem="同题", answer="A2"))
    assert len(repo.list("demo")) == 1


def test_remove_one():
    repo = InMemoryFavoritesRepo()
    f = repo.add("demo", FavoriteQuestion(kp_id="array", stem="题1"))
    repo.remove("demo", f.id)
    assert repo.list("demo") == []


def test_clear_by_kp_then_all():
    repo = InMemoryFavoritesRepo()
    repo.add("demo", FavoriteQuestion(kp_id="array", stem="a"))
    repo.add("demo", FavoriteQuestion(kp_id="queue", stem="q"))
    repo.clear("demo", "array")
    assert {f.kp_id for f in repo.list("demo")} == {"queue"}
    repo.clear("demo")
    assert repo.list("demo") == []
