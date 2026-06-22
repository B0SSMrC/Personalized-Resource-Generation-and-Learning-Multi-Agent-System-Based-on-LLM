"""讯飞星火 HTTP 接入（OpenAI 兼容）。

星火开放平台提供 OpenAI 兼容的 HTTP 接口：端点 /chat/completions、请求体与
data:{...} 流式格式都与 OpenAI 一致，鉴权用控制台「http服务接口认证信息」里的
单个 APIPassword 作 Bearer。因此直接复用 OpenAICompatClient 的 chat/stream，
只固化星火默认 base_url，把 APIPassword 当作 api_key 传入。

模型版本对应的 model 取值（填到 .env 的 LLM_MODEL）：
    lite          Spark Lite（免费）
    generalv3     Spark Pro
    pro-128k      Spark Pro-128K
    generalv3.5   Spark Max
    max-32k       Spark Max-32K
    4.0Ultra      Spark 4.0 Ultra
"""
from app.llm.openai_compat import OpenAICompatClient

SPARK_BASE_URL = "https://spark-api-open.xf-yun.com/v1"


class SparkClient(OpenAICompatClient):
    """讯飞星火 OpenAI 兼容客户端：APIPassword 作 Bearer，默认指向星火端点。"""

    def __init__(self, api_password: str, model: str = "lite",
                 base_url: str = SPARK_BASE_URL):
        super().__init__(base_url=base_url or SPARK_BASE_URL,
                         api_key=api_password, model=model)
