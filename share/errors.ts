// errors.ts

export type AgentErrorCode =
  | "POLICY_REJECTED"
  | "INSUFFICIENT_FUNDS"
  | "UNTRUSTED_FACILITATOR"
  | "DAILY_LIMIT_EXCEEDED"
  | "NETWORK_ERROR"
  | "HTTP_ERROR"
  | "PROTOCOL_ERROR"
  | "UNKNOWN_ERROR";

export class AgentError extends Error {
  constructor(
    public message: string,
    public code: AgentErrorCode = "UNKNOWN_ERROR",
    public status?: number,      // HTTP Status (400, 402, 500)
    public details?: any         // Full response body or context
  ) {
    super(message);
    this.name = "AgentError";
  }
}
