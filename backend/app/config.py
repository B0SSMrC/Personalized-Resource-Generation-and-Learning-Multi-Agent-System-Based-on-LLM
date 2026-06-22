import os

from dotenv import load_dotenv

load_dotenv()


class Settings:
    llm_provider = os.getenv("LLM_PROVIDER", "fake")
    llm_base_url = os.getenv("LLM_BASE_URL", "")
    llm_api_key = os.getenv("LLM_API_KEY", "")
    llm_model = os.getenv("LLM_MODEL", "gpt-4o-mini")
    # 留空 -> 内存仓储；设文件名 -> SQLite 持久化
    db_path = os.getenv("DB_PATH", "")


settings = Settings()


def build_llm():
    from app.llm.fake import FakeLLMClient

    if settings.llm_provider == "openai_compat":
        from app.llm.openai_compat import OpenAICompatClient

        return OpenAICompatClient(
            settings.llm_base_url, settings.llm_api_key, settings.llm_model
        )
    if settings.llm_provider == "spark":
        from app.llm.spark import SparkClient

        return SparkClient()
    return FakeLLMClient()
