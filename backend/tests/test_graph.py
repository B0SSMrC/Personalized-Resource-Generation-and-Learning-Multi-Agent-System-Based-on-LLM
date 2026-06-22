from app.data import repository


def test_load_graph():
    points, edges = repository.load_graph()
    assert "array" in points
    assert points["array"].name == "数组"
    # 边由先修推导：array -> linked_list 等
    assert ("array", "linked_list") in edges


def test_compute_path_respects_prerequisites():
    points, _ = repository.load_graph()
    path = repository.compute_path(points, mastered=set(), weak_points=set())
    # array 无先修，必排在 linked_list / binary_tree 之前
    assert path.index("array") < path.index("linked_list")
    assert path.index("linked_list") < path.index("binary_tree")


def test_compute_path_excludes_mastered():
    points, _ = repository.load_graph()
    path = repository.compute_path(points, mastered={"array"}, weak_points=set())
    assert "array" not in path


def test_compute_path_prioritizes_weak_points():
    points, _ = repository.load_graph()
    # array 已掌握后，linked_list 与 sorting 同时就绪；sorting 为薄弱点应靠前
    path = repository.compute_path(points, mastered={"array"}, weak_points={"sorting"})
    assert path.index("sorting") < path.index("linked_list")
