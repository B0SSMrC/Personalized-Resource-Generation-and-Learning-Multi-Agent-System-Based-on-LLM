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


def test_spark_client_defaults_and_bearer_auth():
    """星火 HTTP：默认指向星火端点、默认 lite 模型，APIPassword 作单个 Bearer。"""
    from app.llm.spark import SparkClient, SPARK_BASE_URL

    c = SparkClient(api_password="pw-123")
    assert c.base_url == SPARK_BASE_URL.rstrip("/")
    assert c.model == "lite"
    assert c._headers["Authorization"] == "Bearer pw-123"


def test_build_llm_spark_returns_configured_spark_client(monkeypatch):
    """LLM_PROVIDER=spark 时，从 settings 装配 SparkClient（base_url 留空回退星火默认）。"""
    from app import config
    monkeypatch.setattr(config.settings, "llm_provider", "spark")
    monkeypatch.setattr(config.settings, "llm_base_url", "")
    monkeypatch.setattr(config.settings, "llm_api_key", "pw-xyz")
    monkeypatch.setattr(config.settings, "llm_model", "generalv3.5")
    from app.llm.spark import SparkClient, SPARK_BASE_URL

    client = config.build_llm()
    assert isinstance(client, SparkClient)
    assert client.base_url == SPARK_BASE_URL.rstrip("/")
    assert client.model == "generalv3.5"
    assert client._headers["Authorization"] == "Bearer pw-xyz"
