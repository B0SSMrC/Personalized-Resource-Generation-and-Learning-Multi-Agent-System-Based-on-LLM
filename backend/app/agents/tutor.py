import re
from typing import AsyncIterator

from app.agents.base import BaseAgent
from app.data import repository
from app.models import AgentEvent, Profile

_SYSTEM = (
    "你是讲解 Agent，基于给定素材对【该知识点本身】做准确、清晰、易懂的讲解，"
    "可用 Markdown（含 LaTeX 公式）。严格遵守："
    "1）只讲该知识点的概念、原理、性质、时间/空间复杂度、典型代码等学科内容；"
    "2）忠于素材、保证准确，不得编造或臆测；复杂度等关键结论必须与素材完全一致、"
    "前后不得自相矛盾，也不要新增一个重复罗列复杂度的小节；"
    "3）不要谈论教学方法、动画、互动体验、学习建议等与知识点无关的内容——"
    "动画演示和练习题由系统其它模块单独提供，讲解正文里不要提及它们；"
    "结尾也不要写「希望以上讲解能帮助你…」「通过理解…我们可以…」这类寄语或客套总结，讲完即止；"
    "4）学生偏好仅用于把握讲解的深浅与举例，绝不要把偏好本身写进正文；"
    "5）必须使用统一、清晰的 Markdown 结构，严禁输出没有任何标题和列表的一大段纯文本，"
    "请按如下骨架组织（小节可按知识点适当增减，但务必保持「## 小节标题 + 列表」的形式）：\n"
    "## 概念\n（一两句话定义该知识点）\n"
    "## 关键性质\n- 用要点列出核心性质\n"
    "## 复杂度\n- 某操作：O(…)（取自素材，不自相矛盾）\n"
    "## 典型应用\n- 用要点列出适用场景\n\n"
    "直接输出 Markdown 正文，不要把整段回答用 ``` 代码围栏包裹。"
)


def _unwrap_fence(text: str) -> str:
    """剥掉模型把整段回答用 ```markdown ... ``` 围栏包裹的外层，
    否则前端会把整块讲解当作代码块渲染（弱模型常见行为）。"""
    t = text.strip()
    if not t.startswith("```"):
        return text
    lines = t.splitlines()
    lines = lines[1:]  # 去掉开头的 ``` / ```markdown / ```md 行
    if lines and lines[-1].strip() == "```":
        lines = lines[:-1]  # 去掉结尾的 ``` 行
    return "\n".join(lines).strip()


_CLOSING_PREFIXES = (
    "希望", "通过", "总之", "综上", "以上", "相信", "总的来说",
    "总而言之", "可见", "由此", "总结一下",
)


def _strip_closing(text: str) -> str:
    """剥掉弱模型爱加的结尾客套段（如“希望以上讲解能帮助你…”）。
    只删结尾「单段纯文本、非标题非列表、且以客套词开头」的块，避免误删正常小节。"""
    blocks = text.rstrip().split("\n\n")
    while blocks:
        last = blocks[-1].strip()
        is_plain = (
            bool(last)
            and not last.startswith(("#", "-", "*", ">"))
            and not last[0].isdigit()
        )
        if is_plain and last.startswith(_CLOSING_PREFIXES):
            blocks.pop()
        else:
            break
    return "\n\n".join(blocks).strip()


def _looks_structured(md: str) -> bool:
    """判断讲解是否有基本结构（含标题或多个列表项）。弱模型有时退化成
    无标题无列表的一大段纯文本，此时上层回退到（有结构的）预烘素材。"""
    has_heading = bool(re.search(r"(?m)^#{1,6}\s", md))
    list_items = len(re.findall(r"(?m)^\s*([-*]|\d+[.)])\s", md))
    return has_heading or list_items >= 2


class TutorAgent(BaseAgent):
    name = "tutor"

    async def run(self, kp_id: str, profile: Profile) -> AsyncIterator[AgentEvent]:
        yield self.start()
        bundle = repository.get_resource(kp_id)
        if bundle is None:
            yield self.error(f"无知识点资源：{kp_id}")
            yield self.done({"explanation_md": ""})
            return
        base_md = bundle.explanation_md
        acc = ""
        try:
            async for tok in self.llm.stream([
                {"role": "system", "content": _SYSTEM},
                {"role": "user", "content":
                    f"请讲解这个知识点（忠于以下素材、只讲学科内容）：\n\n{base_md}\n\n"
                    f"（讲解深浅参考——学生偏好：{profile.preference or '无'}；"
                    f"此条仅供你把握难度，请勿写入正文。）"},
            ]):
                acc += tok
                yield self.token(tok)
        except Exception:  # noqa: BLE001  回退预烘
            acc = ""
        candidate = _strip_closing(_unwrap_fence(acc.strip()))
        # 无结构（纯文本墙）则回退到有结构的预烘素材，保证渲染一致
        final_md = candidate if (candidate and _looks_structured(candidate)) else base_md
        if not acc.strip():
            yield self.token(base_md)
        yield self.done({"explanation_md": final_md})
