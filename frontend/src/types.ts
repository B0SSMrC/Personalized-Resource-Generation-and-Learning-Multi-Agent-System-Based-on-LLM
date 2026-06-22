export interface AgentEvent {
  agent: string;
  type: "agent_start" | "token" | "agent_done" | "agent_error";
  content: string;
  data: Record<string, any> | null;
}

export interface Profile {
  learner_id: string;
  mastered: string[];
  weak_points: string[];
  goal: string;
  preference: string;
  pace: string;
  history: Record<string, any>[];
}

export interface KnowledgePoint {
  id: string;
  name: string;
  difficulty: number;
  prerequisites: string[];
  est_minutes: number;
  resource_ref: string;
}

export interface Graph {
  points: KnowledgePoint[];
  edges: [string, string][];
}

export interface ResourceBundle {
  id: string;
  explanation_md: string;
  viz: { type: string; params: Record<string, any> };
  code: { language: string; source: string };
  question_templates: { stem: string; answer: string; difficulty: number }[];
}
