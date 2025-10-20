/**
 * Error codes and response types for MCP tools
 */

export const ERROR_CODES = {
  SCHEMA_INVALID: "SCHEMA_INVALID",
  DUP_NODE_ID: "DUP_NODE_ID",
  MISSING_NODE: "MISSING_NODE",
  MISSING_PORT: "MISSING_PORT",
  UNCONNECTED_REQUIRED_INPUT: "UNCONNECTED_REQUIRED_INPUT",
  EDGE_FROM_MISSING_NODE: "EDGE_FROM_MISSING_NODE",
  EDGE_TO_MISSING_NODE: "EDGE_TO_MISSING_NODE",
  CYCLE: "CYCLE",
  UNTYPED_PORT: "UNTYPED_PORT",
  TYPE_MISMATCH: "TYPE_MISMATCH",
  CAPABILITY_GAP: "CAPABILITY_GAP",
  CONSTRAINT_VIOLATION: "CONSTRAINT_VIOLATION",
  READ_ONLY: "READ_ONLY",
  NOTHING_TO_DO: "NOTHING_TO_DO",
  STALE_REV: "STALE_REV",
  LOCKED: "LOCKED",
  INVALID_PHASE: "INVALID_PHASE",
  POLICY_VIOLATION: "POLICY_VIOLATION",
  PATCH_FAILED: "PATCH_FAILED",
  ADAPTER_INSERT_FAILED: "ADAPTER_INSERT_FAILED",
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

export interface MCPError {
  code: ErrorCode;
  msg: string;
  path?: string;
}

export interface ToolResponse<T = unknown> {
  ok: boolean;
  result?: T;
  errors?: MCPError[];
  irHash?: string;
}

export interface ValidationSummary {
  nodes: number;
  edges: number;
  requiredInputsUnconnected: number;
  typeMismatches: number;
  cycles: number;
}
