from pydantic import BaseModel, Field


class KnowledgePoint(BaseModel):
    id: str
    name: str
    difficulty: int = 1
    prerequisites: list[str] = Field(default_factory=list)
    est_minutes: int = 30
    resource_ref: str = ""


class Profile(BaseModel):
    learner_id: str = "demo"
    mastered: list[str] = Field(default_factory=list)
    weak_points: list[str] = Field(default_factory=list)
    goal: str = ""
    preference: str = ""
    pace: str = "medium"
    history: list[dict] = Field(default_factory=list)


class VizSpec(BaseModel):
    type: str = "linear"  # linear | sorting | tree | graph
    params: dict = Field(default_factory=dict)


class CodeSnippet(BaseModel):
    language: str = "python"
    source: str = ""
    output: str = ""


class QuestionTemplate(BaseModel):
    stem: str
    answer: str = ""
    difficulty: int = 1


class ResourceBundle(BaseModel):
    id: str
    explanation_md: str = ""
    viz: VizSpec = Field(default_factory=VizSpec)
    code: CodeSnippet = Field(default_factory=CodeSnippet)
    question_templates: list[QuestionTemplate] = Field(default_factory=list)


class AgentEvent(BaseModel):
    agent: str
    type: str  # agent_start | token | agent_done | agent_error
    content: str = ""
    data: dict | None = None


class FavoriteQuestion(BaseModel):
    id: str = ""
    kp_id: str
    stem: str
    answer: str = ""
    difficulty: int = 1
