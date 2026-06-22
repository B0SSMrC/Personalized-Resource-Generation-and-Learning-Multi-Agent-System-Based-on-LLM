from app.data import repository
from app.models import ResourceBundle


def test_get_resource_returns_bundle():
    b = repository.get_resource("array")
    assert isinstance(b, ResourceBundle)
    assert b.id == "array"
    assert b.viz.type == "linear"
    assert len(b.question_templates) >= 1


def test_get_resource_missing_returns_none():
    assert repository.get_resource("nonexistent") is None


def test_all_graph_points_with_resource_ref_loadable():
    points, _ = repository.load_graph()
    for pid, p in points.items():
        if (repository._DATA_DIR / p.resource_ref).exists():
            assert repository.get_resource(pid) is not None
