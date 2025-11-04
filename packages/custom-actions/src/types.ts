export type ActionType = "bash" | "http";

export type ActionTarget = "service" | "provider" | null;

export interface BaseAction {
  id: number;
  name: string;
  description: string;
  type: ActionType;
  target: ActionTarget;
}

export interface BashAction extends BaseAction {
  script: string | null;
  type: "bash";
}

export interface HttpAction extends BaseAction {
  url: string;
  type: "http";
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  headers?: Record<string, string> | null;
  body?: string | null;
}

export type CustomAction = BashAction | HttpAction;
