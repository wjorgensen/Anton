/**
 * Core IR (Intermediate Representation) types for Anton planning system
 */

export type Scalar = "Number" | "String" | "Bool";

export type TypeExpr =
  | { kind: "Scalar"; name: Scalar }
  | { kind: "Array"; of: TypeExpr }
  | { kind: "Record"; fields: Record<string, TypeExpr> }
  | { kind: "Union"; options: TypeExpr[] }
  | { kind: "Opaque"; name: string }
  | { kind: "Literal"; valueType: Scalar; value: string | number | boolean };

export interface Port {
  name: string;
  type?: TypeExpr;
  required?: boolean;
}

export interface Contracts {
  pre?: string[];
  post?: string[];
  invariants?: string[];
}

export interface Quality {
  score?: number;      // 0-1 range
  evidence?: string[];
}

export interface Security {
  threat_model?: string;
  known_issues?: string[];
  ruleset?: string;
}

export type NodeRole = "framework" | "module" | "atom" | "adapter" | "infra" | "test";

export interface Node {
  id: string;                      // Generated ID matching pattern: ^[a-z0-9](?:[a-z0-9._-]{1,62})@\d+(?:\.\d+){0,2}$
  kind: NodeRole;
  summary: string;
  inputs: Port[];
  outputs: Port[];
  language?: string;               // Primary implementation language (go, ts, py, etc.)
  framework_hint?: string;         // Opinionated stack advice (e.g., 'express', 'fiber', 'fastapi')
  build_prompt?: string;           // In-depth build instructions for code generation
  tags?: string[];
  contracts?: Contracts;
  deps?: string[];                 // External runtime/library dependencies
  module_candidates?: string[];    // References to marketplace nodes/templates
  quality?: Quality;
  security?: Security;
  notes?: string;
  hash?: string;                   // Content hash of the node spec
  buffer?: boolean;                // Marks buffering nodes that can break cycles
}

export interface Edge {
  from: { node: string; port: string };
  to: { node: string; port: string };
  order_before?: boolean;
  coercion?: any;  // CoercionPlan if automatic type coercion is needed
}

export interface Constraints {
  runtime: string[];           // e.g., ["node>=20"]
  licenses_allow: string[];    // e.g., ["MIT", "Apache-2.0"]
  licenses_deny: string[];     // e.g., []
  regions?: string[];
  policy?: Record<string, any>;
}

export interface Channel {
  kind: string;  // "http|cli|file|queue|stream|grpc|db|metrics|log|library|custom"
  id: string;
  spec: string;
}

export interface IOBoundaries {
  inputs: Channel[];
  outputs: Channel[];
}

export interface Requirements {
  goal: string;
  capabilities: string[];
  io_boundaries: IOBoundaries;
}

export interface Project {
  id: string;
  name: string;
  created_at: string;
  description?: string;
}

export type IRPhase = "skeleton" | "typing" | "ready";

export interface LifecycleMetadata {
  phase: IRPhase;
  lastValidatedAt?: string;
  lastValidationErrors?: number;
}

export interface Metadata {
  lifecycle?: LifecycleMetadata;
  [key: string]: unknown;
}

export interface RPGIR {
  version: "rpg-ir@0.1";
  project: Project;
  requirements: Requirements;
  constraints: Constraints;
  nodes: Node[];
  edges: Edge[];
  adapters?: any[];
  file_layout?: FileLayout;
  metadata?: Metadata;
  rev: number;
  hash?: string;              // content hash set by server
}

export interface LayoutFile {
  path: string;
  kind: "code" | "test" | "config" | "barrel";
  nodeId: string;
  role: NodeRole;
  language: string;
}

export interface BarrelSpec {
  path: string;
  exports: string[];
}

export interface FileLayout {
  files: LayoutFile[];
  barrels: BarrelSpec[];
}

export interface NodeView {
  self: Node;
  producers: Record<string, Array<{ nodeId: string; type?: TypeExpr }>>;
  consumers: Record<string, Array<{ nodeId: string; type?: TypeExpr }>>;
}

export interface ExecutionHint {
  kind: "retry" | "timeout" | "context";
  detail: number | string | string[];
}

export interface ImplTask {
  nodeId: string;
  nodeView: NodeView;
  targetFiles: string[];
  tests: string[];
  buildPrompt: string;
  hints: ExecutionHint[];
}

export interface ImplPlan {
  batches: ImplTask[][];
}
