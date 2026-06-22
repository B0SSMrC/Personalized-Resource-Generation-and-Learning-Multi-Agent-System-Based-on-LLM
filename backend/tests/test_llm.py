from app.llm.fake import FakeLLMClient


async def test_fake_chat_returns_injected_response():
    llm = FakeLLMClient(responses=["hello"])
    out = await llm.chat([{"role": "user", "content": "hi"}])
    assert out == "hello"


async def test_fake_stream_yields_chunks():
    llm = FakeLLMClient(responses=["a b c"])
    chunks = [c async for c in llm.stream([{"role": "user", "content": "x"}])]
    assert "".join(chunks).strip() == "a b c"


async def test_fake_canned_matches_keyword():
    llm = FakeLLMClient(canned={"画像": '{"mastered":["array"]}'})
    out = await llm.chat([{"role": "system", "content": "你是画像Agent"}])
    assert "array" in out


def test_build_llm_defaults_to_fake(monkeypatch):
    from app import config
    monkeypatch.setattr(config.settings, "llm_provider", "fake")
    from app.llm.fake import FakeLLMClient as F
    assert isinstance(config.build_llm(), F)
