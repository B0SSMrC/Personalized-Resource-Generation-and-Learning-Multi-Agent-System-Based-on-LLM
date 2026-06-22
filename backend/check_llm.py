r"""快速自检：用 backend/.env 里的配置真打一次 LLM（chat + stream）。

运行（在 backend 目录下）：
    .\.venv\Scripts\python.exe check_llm.py
"""
import asyncio

from app.config import build_llm, settings


async def main():
    print(f"provider = {settings.llm_provider}")
    print(f"base_url = {settings.llm_base_url}")
    print(f"model    = {settings.llm_model}")
    print(f"api_key  = {'已设置' if settings.llm_api_key else '(空)'}")

    if settings.llm_provider != "openai_compat":
        print("\n⚠️ 当前 LLM_PROVIDER 不是 openai_compat，仍在用占位/离线模式。")

    llm = build_llm()

    print("\n--- 测试 chat (非流式) ---")
    try:
        out = await llm.chat([{"role": "user", "content": "用一句话确认你在线。"}])
        print("✅ 成功:", out)
    except Exception as e:  # noqa: BLE001
        print("❌ 失败:", type(e).__name__, e)
        print("   → 多半是 base_url / api_key / model 之一不对，见下方说明。")
        return

    print("\n--- 测试 stream (流式) ---")
    try:
        chunks = []
        async for tok in llm.stream([{"role": "user", "content": "数 1 到 5。"}]):
            chunks.append(tok)
        print("✅ 流式成功，收到", len(chunks), "块:", "".join(chunks)[:80])
    except Exception as e:  # noqa: BLE001
        print("⚠️ 流式失败（不影响演示，app 会自动回退预烘内容）:", type(e).__name__, e)


if __name__ == "__main__":
    asyncio.run(main())
