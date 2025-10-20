/**
 * MCP tool implementations
 */

import { RPGIR, Node, Edge, TypeExpr, Contracts, Constraints, Requirements, FileLayout, ImplPlan, ImplTask, Channel, IOBoundaries, Project, IRPhase, Port, ExecutionHint, NodeView } from "./ir.ts";
import { ToolResponse, MCPError, ERROR_CODES, ValidationSummary, ErrorCode } from "./errors.ts";
import { loadIR, saveIR, hasRequestCache, getRequestCache, setRequestCache } from "./store.ts";
import { hashIR, minimalShapeCheck, validateAll, summarize, detectCycles, isTypeCompatible } from "./validators.ts";
import { tryPlanCoercion } from "./coercion.ts";
import { normalizeIR } from "./canonicalize.ts";
import { stableStringify } from "./util.ts";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import * as YAML from "yaml";

// Load environment variables
dotenv.config();

// ============================================================================
// Helper Functions
// ============================================================================

interface MutationContext {
  current: RPGIR;
  working: RPGIR;
  baseRev: number;
}

interface MutationDraft<T> {
  ir: RPGIR;
  makeResult: (finalIr: RPGIR) => T;
  didChange?: boolean;
}

interface MutationOptions {
  allowCreate?: boolean;
  filePath?: string;
}

type JsonPatchOperation = {
  op: "add" | "remove" | "replace";
  path: string;
  value?: any;
};

function cloneIR(ir: RPGIR): RPGIR {
  return JSON.parse(JSON.stringify(ir)) as RPGIR;
}

function finalizeAndPersist(ir: RPGIR, baseRev: number, options: MutationOptions = {}): RPGIR {
  const candidate = cloneIR(ir);
  candidate.rev = baseRev;

  const normalized = normalizeIR(candidate);
  normalized.rev = baseRev + 1;
  normalized.hash = hashIR(normalized);

  saveIR(normalized, {
    expectedRev: baseRev,
    allowCreate: options.allowCreate,
    filePath: options.filePath,
  });

  return normalized;
}

function isKnownErrorCode(value: unknown): value is ErrorCode {
  return typeof value === "string" && Object.values(ERROR_CODES).includes(value as ErrorCode);
}

function mutationError(error: unknown, irHash?: string): ToolResponse<never> {
  const err = error as NodeJS.ErrnoException;
  const message = err?.message ?? String(error);
  const code = isKnownErrorCode(err?.code) ? (err.code as ErrorCode) : ERROR_CODES.SCHEMA_INVALID;
  return {
    ok: false,
    errors: [{ code, msg: message }],
    irHash,
  };
}

async function executeMutation<T>(
  requestId: string | undefined,
  mutator: (ctx: MutationContext) => MutationDraft<T>,
  options: MutationOptions = {}
): Promise<ToolResponse<T>> {
  if (requestId && hasRequestCache(requestId)) {
    return getRequestCache(requestId)! as ToolResponse<T>;
  }

  let current: RPGIR;
  try {
    current = loadIR();
  } catch (error) {
    return mutationError(error);  
  }

  const baseRev = typeof current.rev === "number" && Number.isInteger(current.rev) ? current.rev : 1;
  const working = cloneIR(current);

  try {
    const draft = mutator({ current, working, baseRev });
    const didChange = draft.didChange !== false;

    if (didChange) {
      const shapeErrors = minimalShapeCheck(draft.ir);
      if (shapeErrors.length > 0) {
        return {
          ok: false,
          errors: shapeErrors,
          irHash: current.hash,
        };
      }
    }

    const finalIr = didChange
      ? finalizeAndPersist(draft.ir, baseRev, options)
      : current;

    const result = draft.makeResult(finalIr);
    const response: ToolResponse<T> = {
      ok: true,
      result,
      irHash: finalIr.hash,
    };

    if (requestId) {
      setRequestCache(requestId, response);
    }

    return response;
  } catch (error) {
    return mutationError(error, current.hash);
  }
}

function throwToolError(code: ErrorCode, msg: string): never {
  const err = new Error(msg) as NodeJS.ErrnoException;
  err.code = code;
  throw err;
}

function requireNode(ir: RPGIR, nodeId: string): Node {
  const node = ir.nodes.find((n) => n.id === nodeId);
  if (!node) {
    throwToolError(ERROR_CODES.MISSING_NODE, `Node ${nodeId} not found`);
  }
  return node;
}

function requirePort(node: Node, direction: "input" | "output", portName: string): { port: Port; ports: Port[] } {
  const ports = direction === "input" ? node.inputs : node.outputs;
  const port = ports.find((p) => p.name === portName);
  if (!port) {
    throwToolError(
      ERROR_CODES.MISSING_PORT,
      `${direction} port ${portName} not found on ${node.id}`
    );
  }
  return { port, ports };
}

function getPhase(ir: RPGIR): IRPhase {
  const phase = ir.metadata?.lifecycle?.phase;
  if (phase === "typing" || phase === "ready") {
    return phase;
  }
  return "skeleton";
}

function ensurePhase(ir: RPGIR, allowed: IRPhase[]): void {
  const phase = getPhase(ir);
  if (!allowed.includes(phase)) {
    throwToolError(
      ERROR_CODES.INVALID_PHASE,
      `Operation not permitted in "${phase}" phase. Allowed phases: ${allowed.join(", ")}.`
    );
  }
}

function setPhase(ir: RPGIR, phase: IRPhase): void {
  if (!ir.metadata) {
    ir.metadata = { lifecycle: { phase } };
    return;
  }
  if (!ir.metadata.lifecycle) {
    ir.metadata.lifecycle = { phase };
    return;
  }
  ir.metadata.lifecycle.phase = phase;
}

/**
 * Generate a unique node ID based on a base name and version
 */
function generateNodeId(baseName: string, existingNodes: Node[]): string {
  // Sanitize the base name to match pattern requirements
  const sanitized = baseName
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/^[^a-z0-9]+/, '')
    .replace(/[^a-z0-9]+$/, '')
    .substring(0, 32);

  if (!sanitized) {
    throw new Error("Base name must contain at least one alphanumeric character");
  }

  // Find the highest version number for this base name
  let version = 0;
  const pattern = new RegExp(`^${sanitized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}@(\\d+)(?:\\.(\\d+))?(?:\\.(\\d+))?$`);

  for (const node of existingNodes) {
    const match = node.id.match(pattern);
    if (match) {
      const nodeVersion = parseInt(match[1], 10);
      if (nodeVersion > version) {
        version = nodeVersion;
      }
    }
  }

  // Increment version for new node
  version++;

  return `${sanitized}@${version}`;
}

// ============================================================================
// Session & IR Management
// ============================================================================

interface StartSessionArgs {
  name: string;
  goal: string;
  capabilities: string[];
  io_boundaries: IOBoundaries;
}

function sanitizeProjectId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/^[^a-z0-9]+/, '')
    .replace(/[^a-z0-9]+$/, '')
    .substring(0, 64);
}

export async function startSession(args: StartSessionArgs): Promise<ToolResponse<{ ir: RPGIR; projectPath: string; planFilePath: string }>> {
  const projectFolderPath = process.env.PROJECT_FOLDER_PATH;

  if (!projectFolderPath) {
    return {
      ok: false,
      errors: [{ code: "SCHEMA_INVALID", msg: "PROJECT_FOLDER_PATH not set in .env file" }],
    };
  }

  // Sanitize project name to create ID
  const projectId = sanitizeProjectId(args.name);

  if (projectId.length < 3) {
    return {
      ok: false,
      errors: [{ code: "SCHEMA_INVALID", msg: "Project name must result in at least 3 valid characters after sanitization" }],
    };
  }

  // Create project folder structure
  const projectPath = path.join(projectFolderPath, args.name);
  const logsPath = path.join(projectPath, "logs");
  const planPath = path.join(projectPath, "anton-plan.json");

  try {
    // Create project directory and logs subdirectory
    fs.mkdirSync(projectPath, { recursive: true });
    fs.mkdirSync(logsPath, { recursive: true });
  } catch (error) {
    return {
      ok: false,
      errors: [{ code: "SCHEMA_INVALID", msg: `Failed to create project directories: ${error}` }],
    };
  }

  // Build the RPGIR structure
  const project: Project = {
    id: projectId,
    name: args.name,
    created_at: new Date().toISOString(),
  };

  const requirements: Requirements = {
    goal: args.goal,
    capabilities: args.capabilities,
    io_boundaries: args.io_boundaries,
  };

  const constraints: Constraints = {
    runtime: ["node>=20"],
    licenses_allow: ["MIT", "Apache-2.0"],
    licenses_deny: [],
  };

  const ir: RPGIR = {
    version: "rpg-ir@0.1",
    project,
    requirements,
    constraints,
    nodes: [],
    edges: [],
    adapters: [],
    file_layout: { files: [], barrels: [] },
    metadata: { lifecycle: { phase: "skeleton" } },
    rev: 0,
  };

  const normalized = normalizeIR(ir);
  normalized.rev = 1;
  normalized.hash = hashIR(normalized);

  try {
    saveIR(normalized, { filePath: planPath, allowCreate: true, expectedRev: 0 });
  } catch (error) {
    return {
      ok: false,
      errors: [{ code: "SCHEMA_INVALID", msg: `Failed to write anton-plan.json: ${error}` }],
    };
  }

  return {
    ok: true,
    result: { ir: normalized, projectPath, planFilePath: planPath },
    irHash: normalized.hash,
  };
}

export async function getIR(): Promise<ToolResponse<{ ir: RPGIR }>> {
  try {
    const ir = loadIR();
    return {
      ok: true,
      result: { ir },
      irHash: ir.hash,
    };
  } catch (error) {
    return {
      ok: false,
      errors: [{ code: "SCHEMA_INVALID", msg: error instanceof Error ? error.message : String(error) }],
    };
  }
}

export async function setConstraints(args: { constraints: Constraints }): Promise<ToolResponse<{ ir: RPGIR }>> {
  return executeMutation(undefined, ({ working }) => {
    working.constraints = args.constraints;
    return {
      ir: working,
      makeResult: (finalIr) => ({ ir: finalIr }),
    };
  });
}

// ============================================================================
// Node Tools
// ============================================================================

export async function addNode(args: {
  requestId?: string;
  name_hint?: string;           // Optional hint for ID generation, defaults to generated ID
  kind: "framework" | "module" | "atom" | "adapter" | "infra" | "test";
  summary: string;
  inputs?: Array<{ name: string; required?: boolean }>;   // Port names only, types added later
  outputs?: Array<{ name: string; required?: boolean }>;  // Port names only, types added later
  language?: string;
  framework_hint?: string;
  build_prompt?: string;
  tags?: string[];
}): Promise<ToolResponse<{ ir: RPGIR; nodeId: string }>> {
  return executeMutation(args.requestId, ({ working }) => {
    ensurePhase(working, ["skeleton"]);

    const summary = args.summary?.trim();
    if (!summary) {
      throwToolError(ERROR_CODES.SCHEMA_INVALID, "Summary is required and cannot be empty");
    }

    const uniqueCheck = (ports: Array<{ name: string }> | undefined, label: string) => {
      if (!ports) return;
      const seen = new Set<string>();
      for (const port of ports) {
        const name = port.name.trim();
        if (seen.has(name)) {
          throwToolError(ERROR_CODES.SCHEMA_INVALID, `${label} port names must be unique`);
        }
        seen.add(name);
      }
    };

    uniqueCheck(args.inputs, "Input");
    uniqueCheck(args.outputs, "Output");

    const baseName = args.name_hint ?? `node-${working.nodes.length + 1}`;
    const nodeId = generateNodeId(baseName, working.nodes);

    const node: Node = {
      id: nodeId,
      kind: args.kind,
      summary,
      inputs: args.inputs ? args.inputs.map(port => ({ ...port })) : [],
      outputs: args.outputs ? args.outputs.map(port => ({ ...port })) : [],
      language: args.language,
      framework_hint: args.framework_hint,
      build_prompt: args.build_prompt,
      tags: args.tags,
    };

    working.nodes.push(node);

    return {
      ir: working,
      makeResult: (finalIr) => ({
        ir: finalIr,
        nodeId,
      }),
    };
  });
}

export async function updateNode(args: {
  requestId?: string;
  id: string;
  kind?: "framework" | "module" | "atom" | "adapter" | "infra" | "test";
  summary?: string;
  language?: string;
  framework_hint?: string;
  build_prompt?: string;
  tags?: string[];
}): Promise<ToolResponse<{ ir: RPGIR }>> {
  return executeMutation(args.requestId, ({ working }) => {
    const nodeIdx = working.nodes.findIndex((n) => n.id === args.id);
    if (nodeIdx === -1) {
      throwToolError(ERROR_CODES.MISSING_NODE, `Node ${args.id} not found`);
    }

    const summary = args.summary?.trim();
    if (args.summary !== undefined && !summary) {
      throwToolError(ERROR_CODES.SCHEMA_INVALID, "Summary cannot be empty");
    }

    const next: Node = {
      ...working.nodes[nodeIdx],
    };

    if (args.kind !== undefined) next.kind = args.kind;
    if (summary !== undefined) next.summary = summary;
    if (args.language !== undefined) next.language = args.language;
    if (args.framework_hint !== undefined) next.framework_hint = args.framework_hint;
    if (args.build_prompt !== undefined) next.build_prompt = args.build_prompt;
    if (args.tags !== undefined) next.tags = args.tags;

    working.nodes[nodeIdx] = next;

    return {
      ir: working,
      makeResult: (finalIr) => ({ ir: finalIr }),
    };
  });
}

export async function deleteNode(args: {
  requestId?: string;
  id: string;
  force?: boolean;
}): Promise<ToolResponse<{ ir: RPGIR }>> {
  return executeMutation(args.requestId, ({ working }) => {
    ensurePhase(working, ["skeleton"]);

    const nodeIdx = working.nodes.findIndex((n) => n.id === args.id);
    if (nodeIdx === -1) {
      throwToolError(ERROR_CODES.MISSING_NODE, `Node ${args.id} not found`);
    }

    const hasEdges = working.edges.some(
      (edge) => edge.from.node === args.id || edge.to.node === args.id
    );

    if (hasEdges && !args.force) {
      throwToolError(
        ERROR_CODES.CONSTRAINT_VIOLATION,
        `Node ${args.id} has edges. Use force=true to delete.`
      );
    }

    working.nodes.splice(nodeIdx, 1);
    working.edges = working.edges.filter(
      (edge) => edge.from.node !== args.id && edge.to.node !== args.id
    );

    return {
      ir: working,
      makeResult: (finalIr) => ({ ir: finalIr }),
    };
  });
}

// ============================================================================
// Port Tools
// ============================================================================

export async function addPort(args: {
  requestId?: string;
  node: string;
  direction: "input" | "output";
  name: string;
  required?: boolean;
}): Promise<ToolResponse<{ ir: RPGIR }>> {
  return executeMutation(args.requestId, ({ working }) => {
    ensurePhase(working, ["skeleton", "typing"]);

    const node = working.nodes.find((n) => n.id === args.node);
    if (!node) {
      throwToolError(ERROR_CODES.MISSING_NODE, `Node ${args.node} not found`);
    }

    const ports = args.direction === "input" ? node.inputs : node.outputs;
    const portName = args.name.trim();

    if (ports.some((p) => p.name === portName)) {
      throwToolError(
        ERROR_CODES.SCHEMA_INVALID,
        `Port ${portName} already exists on ${args.node}`
      );
    }

    ports.push({
      name: portName,
      required: args.required !== undefined ? args.required : true,
    });

    return {
      ir: working,
      makeResult: (finalIr) => ({ ir: finalIr }),
    };
  });
}

export async function removePort(args: {
  requestId?: string;
  node: string;
  direction: "input" | "output";
  port: string;
}): Promise<ToolResponse<{ ir: RPGIR }>> {
  return executeMutation(args.requestId, ({ working }) => {
    ensurePhase(working, ["skeleton", "typing"]);

    const node = working.nodes.find((n) => n.id === args.node);
    if (!node) {
      throwToolError(ERROR_CODES.MISSING_NODE, `Node ${args.node} not found`);
    }

    const ports = args.direction === "input" ? node.inputs : node.outputs;
    const index = ports.findIndex((p) => p.name === args.port);
    if (index === -1) {
      throwToolError(
        ERROR_CODES.MISSING_PORT,
        `Port ${args.port} not found on ${args.node}`
      );
    }

    const hasEdges = working.edges.some((edge) => {
      if (args.direction === "output") {
        return edge.from.node === args.node && edge.from.port === args.port;
      }
      return edge.to.node === args.node && edge.to.port === args.port;
    });

    if (hasEdges) {
      throwToolError(
        ERROR_CODES.CONSTRAINT_VIOLATION,
        `Port ${args.port} on ${args.node} has connected edges. Remove edges first.`
      );
    }

    ports.splice(index, 1);

    return {
      ir: working,
      makeResult: (finalIr) => ({ ir: finalIr }),
    };
  });
}

// ============================================================================
// Edge Tools
// ============================================================================

export async function addEdge(args: {
  edgeId?: string;
  edge: Edge;
}): Promise<ToolResponse<{ ir: RPGIR }>> {
  return executeMutation(args.edgeId, ({ working }) => {
    ensurePhase(working, ["skeleton", "typing", "ready"]);

    const fromNode = requireNode(working, args.edge.from.node);
    const toNode = requireNode(working, args.edge.to.node);

    const { port: fromPort } = requirePort(fromNode, "output", args.edge.from.port);
    const { port: toPort } = requirePort(toNode, "input", args.edge.to.port);

    const duplicate = working.edges.some(
      (edge) =>
        edge.from.node === args.edge.from.node &&
        edge.from.port === args.edge.from.port &&
        edge.to.node === args.edge.to.node &&
        edge.to.port === args.edge.to.port
    );

    if (duplicate) {
      throwToolError(
        ERROR_CODES.SCHEMA_INVALID,
        `Edge from ${args.edge.from.node}.${args.edge.from.port} to ${args.edge.to.node}.${args.edge.to.port} already exists`
      );
    }

    const nextEdge: Edge = {
      from: {
        node: args.edge.from.node,
        port: args.edge.from.port,
      },
      to: {
        node: args.edge.to.node,
        port: args.edge.to.port,
      },
    };

    if (args.edge.order_before) {
      nextEdge.order_before = true;
    }

    if (fromPort.type && toPort.type) {
      if (!isTypeCompatible(fromPort.type, toPort.type)) {
        const plan = tryPlanCoercion(fromPort.type, toPort.type);
        if (plan && plan.kind !== "id") {
          nextEdge.coercion = plan;
        } else {
          throwToolError(
            ERROR_CODES.TYPE_MISMATCH,
            `Type mismatch: ${fromNode.id}.${fromPort.name} incompatible with ${toNode.id}.${toPort.name}`
          );
        }
      }
    }

    working.edges.push(nextEdge);

    const cycleErrors = detectCycles(working);
    if (cycleErrors.length > 0) {
      throwToolError(cycleErrors[0].code, cycleErrors[0].msg);
    }

    return {
      ir: working,
      makeResult: (finalIr) => ({ ir: finalIr }),
    };
  });
}

export async function removeEdge(args: {
  edgeId?: string;
  from: { node: string; port: string };
  to: { node: string; port: string };
}): Promise<ToolResponse<{ ir: RPGIR }>> {
  return executeMutation(args.edgeId, ({ working }) => {
    const index = working.edges.findIndex(
      (edge) =>
        edge.from.node === args.from.node &&
        edge.from.port === args.from.port &&
        edge.to.node === args.to.node &&
        edge.to.port === args.to.port
    );

    if (index === -1) {
      throwToolError(
        ERROR_CODES.NOTHING_TO_DO,
        `Edge ${args.from.node}.${args.from.port} → ${args.to.node}.${args.to.port} not found`
      );
    }

    working.edges.splice(index, 1);

    return {
      ir: working,
      makeResult: (finalIr) => ({ ir: finalIr }),
    };
  });
}

// ============================================================================
// Typing & Contracts
// ============================================================================

export async function setPortType(args: {
  requestId?: string;
  node: string;
  direction: "input" | "output";
  port: string;
  type: TypeExpr;
}): Promise<ToolResponse<{ ir: RPGIR }>> {
  return executeMutation(args.requestId, ({ working }) => {
    ensurePhase(working, ["typing", "ready"]);

    const node = requireNode(working, args.node);
    const { port } = requirePort(node, args.direction, args.port);

    port.type = args.type;

    return {
      ir: working,
      makeResult: (finalIr) => ({ ir: finalIr }),
    };
  });
}

export async function setContracts(args: {
  requestId?: string;
  node: string;
  contracts: Contracts;
}): Promise<ToolResponse<{ ir: RPGIR }>> {
  return executeMutation(args.requestId, ({ working }) => {
    ensurePhase(working, ["typing", "ready"]);

    const node = requireNode(working, args.node);
    node.contracts = args.contracts;

    return {
      ir: working,
      makeResult: (finalIr) => ({ ir: finalIr }),
    };
  });
}

// ============================================================================
// Validation
// ============================================================================

export async function validateGraph(): Promise<ToolResponse<{ summary: ValidationSummary }>> {
  let current: RPGIR;
  try {
    current = loadIR();
  } catch (error) {
    return mutationError(error);
  }

  const baseRev = current.rev;
  const working = cloneIR(current);
  const errors = validateAll(working);
  const summary = summarize(working, errors);
  const now = new Date().toISOString();

  if (!working.metadata) {
    working.metadata = { lifecycle: { phase: getPhase(current) } };
  }
  if (!working.metadata.lifecycle) {
    working.metadata.lifecycle = { phase: getPhase(current) };
  }

  working.metadata.lifecycle.lastValidatedAt = now;
  working.metadata.lifecycle.lastValidationErrors = errors.length;

  if (errors.length === 0) {
    const phase = getPhase(working);
    if (phase === "skeleton") {
      setPhase(working, "typing");
    } else if (phase === "typing") {
      setPhase(working, "ready");
    }
  }

  try {
    const finalIr = finalizeAndPersist(working, baseRev);
    return {
      ok: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      result: { summary },
      irHash: finalIr.hash,
    };
  } catch (error) {
    return mutationError(error, current.hash);
  }
}

export async function getValidationErrors(): Promise<ToolResponse<{ errors: MCPError[] }>> {
  try {
    const ir = loadIR();
    const errors = validateAll(ir);

    return {
      ok: true,
      result: { errors },
      irHash: ir.hash,
    };
  } catch (error) {
    return {
      ok: false,
      errors: [{ code: "SCHEMA_INVALID", msg: error instanceof Error ? error.message : String(error) }],
    };
  }
}

// ============================================================================
// Canonicalization & Snapshots
// ============================================================================

export async function canonicalizeIR(): Promise<ToolResponse<{ ir: RPGIR }>> {
  try {
    const ir = loadIR();
    const canonicalIR = normalizeIR(ir);
    canonicalIR.rev = ir.rev;
    canonicalIR.hash = hashIR(canonicalIR);

    return {
      ok: true,
      result: { ir: canonicalIR },
      irHash: canonicalIR.hash,
    };
  } catch (error) {
    return {
      ok: false,
      errors: [{ code: "SCHEMA_INVALID", msg: error instanceof Error ? error.message : String(error) }],
    };
  }
}

export async function exportSnapshot(args: {
  format: "json" | "yaml";
}): Promise<ToolResponse<{ artifactBase64: string }>> {
  try {
    const ir = loadIR();
    let content: string;

    if (args.format === "json") {
      content = JSON.stringify(ir, null, 2);
    } else if (args.format === "yaml") {
      content = YAML.stringify(ir);
    } else {
      return {
        ok: false,
        errors: [{ code: "SCHEMA_INVALID", msg: `Unsupported export format: ${args.format}` }],
      };
    }

    const artifactBase64 = Buffer.from(content).toString("base64");

    return {
      ok: true,
      result: { artifactBase64 },
      irHash: ir.hash,
    };
  } catch (error) {
    return {
      ok: false,
      errors: [{ code: "SCHEMA_INVALID", msg: error instanceof Error ? error.message : String(error) }],
    };
  }
}

// ============================================================================
// File Layout & Implementation Planning
// ============================================================================

interface PlanFileLayoutArgs {
  requestId?: string;
  policy?: "go" | "ts" | "py" | "auto";
  roleToFolder?: Record<string, string>;
  testLayout?: "dedicated" | "co-located";
}

const DEFAULT_TEST_LAYOUT: "dedicated" = "dedicated";

export async function planFileLayout(args: PlanFileLayoutArgs): Promise<ToolResponse<{ layout: FileLayout; nodeToFiles: Record<string, string[]> }>> {
  return executeMutation(args.requestId, ({ working }) => {
    ensurePhase(working, ["typing", "ready"]);
    const layout = buildDeterministicLayout(working, {
      policy: args.policy ?? "auto",
      roleToFolder: args.roleToFolder ?? {},
      testLayout: args.testLayout ?? DEFAULT_TEST_LAYOUT,
    });
    working.file_layout = layout;

    return {
      ir: working,
      makeResult: (finalIr) => {
        const finalLayout = (finalIr.file_layout ?? { files: [], barrels: [] }) as FileLayout;
        return {
          layout: finalLayout,
          nodeToFiles: deriveNodeToFiles(finalLayout),
        };
      },
    };
  });
}

export async function synthesizeFileLayout(args: PlanFileLayoutArgs): Promise<ToolResponse<{ layout: FileLayout; nodeToFiles: Record<string, string[]> }>> {
  return planFileLayout(args);
}

export async function emitImplBatches(args: { requestId?: string } = {}): Promise<ToolResponse<{ plan: ImplPlan }>> {
  let ir: RPGIR;
  try {
    ir = loadIR();
  } catch (error) {
    return mutationError(error);
  }

  const validationErrors = validateAll(ir);
  if (validationErrors.length > 0) {
    return {
      ok: false,
      errors: validationErrors,
      result: { plan: { batches: [] } },
      irHash: ir.hash,
    };
  }

  if (!ir.file_layout) {
    return {
      ok: false,
      errors: [{
        code: ERROR_CODES.SCHEMA_INVALID,
        msg: "File layout missing. Run plan_file_layout first.",
      }],
      irHash: ir.hash,
    };
  }

  if (getPhase(ir) !== "ready") {
    return {
      ok: false,
      errors: [{
        code: ERROR_CODES.INVALID_PHASE,
        msg: `emit_impl_batches requires IR in 'ready' phase (current: ${getPhase(ir)})`,
      }],
      irHash: ir.hash,
    };
  }

  const plan = buildImplementationPlan(ir);
  return {
    ok: true,
    result: { plan },
    irHash: ir.hash,
  };
}

export async function buildImplPlan(args: { requestId?: string } & Record<string, unknown>): Promise<ToolResponse<{ plan: ImplPlan }>> {
  return emitImplBatches({ requestId: args.requestId });
}

function deriveNodeToFiles(layout: FileLayout): Record<string, string[]> {
  const mapping: Record<string, string[]> = {};
  for (const file of layout.files ?? []) {
    if (!mapping[file.nodeId]) {
      mapping[file.nodeId] = [];
    }
    mapping[file.nodeId].push(file.path);
  }
  return mapping;
}

function buildDeterministicLayout(ir: RPGIR, options: { policy: "go" | "ts" | "py" | "auto"; roleToFolder: Record<string, string>; testLayout: "dedicated" | "co-located" }): FileLayout {
  const files: FileLayout["files"] = [];
  const barrels: FileLayout["barrels"] = [];
  const seenPaths = new Set<string>();
  const seenBarrels = new Set<string>();
  const directoryExports = new Map<string, { language: string; exports: string[] }>();

  const nodes = [...ir.nodes].sort((a, b) => a.id.localeCompare(b.id));

  for (const node of nodes) {
    const language = resolveLanguage(node, options.policy);
    const directory = resolveDirectory(node, language, options.roleToFolder);
    const base = canonicalFileBase(node.id);
    const extension = extensionFor(language);

    const codePath = `${directory}/${base}.${extension}`;
    ensureUniquePath(seenPaths, codePath);
    files.push({
      path: codePath,
      kind: "code",
      nodeId: node.id,
      role: node.kind,
      language,
    });

    const testPath = makeTestPath(language, node.kind, base, options.testLayout, directory);
    ensureUniquePath(seenPaths, testPath);
    files.push({
      path: testPath,
      kind: "test",
      nodeId: node.id,
      role: node.kind,
      language,
    });

    if (language === "ts") {
      const entry = directoryExports.get(directory) ?? { language, exports: [] };
      entry.language = language;
      entry.exports.push(`./${base}`);
      directoryExports.set(directory, entry);
    }
  }

  for (const [directory, entry] of [...directoryExports.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const barrelPath = `${directory}/index.${extensionFor(entry.language)}`;
    if (!seenPaths.has(barrelPath)) {
      ensureUniquePath(seenBarrels, barrelPath);
      barrels.push({
        path: barrelPath,
        exports: [...new Set(entry.exports)].sort(),
      });
    }
  }

  return { files, barrels };
}

function ensureUniquePath(seen: Set<string>, candidate: string) {
  if (seen.has(candidate)) {
    throwToolError(ERROR_CODES.SCHEMA_INVALID, `PATH_COLLISION: ${candidate}`);
  }
  seen.add(candidate);
}

function resolveLanguage(node: Node, policy: "go" | "ts" | "py" | "auto"): string {
  if (node.language) return node.language;
  if (policy !== "auto") return policy;
  return "ts";
}

function resolveDirectory(node: Node, language: string, overrides: Record<string, string>): string {
  const override = overrides[node.kind];
  if (override) return sanitizeDirectory(override);

  switch (language.toLowerCase()) {
    case "go":
      return `internal/${node.kind}`;
    case "py":
      return `src/${node.kind}`;
    default:
      return `src/${node.kind}`;
  }
}

function sanitizeDirectory(dir: string): string {
  return dir.replace(/\/+/g, "/").replace(/^\//, "").replace(/\/$/, "");
}

function canonicalFileBase(nodeId: string): string {
  return nodeId.replace(/@/g, "_").replace(/\./g, "_");
}

function extensionFor(language: string): string {
  const normalized = language.toLowerCase();
  if (normalized.startsWith("go")) return "go";
  if (normalized.startsWith("py")) return "py";
  if (normalized.startsWith("ts")) return "ts";
  if (normalized.startsWith("js")) return "js";
  return "ts";
}

function makeTestPath(language: string, role: Node["kind"], base: string, layout: "dedicated" | "co-located", directory: string): string {
  const ext = extensionFor(language);
  if (layout === "co-located") {
    if (ext === "go") {
      return `${directory}/${base}_test.go`;
    }
    if (ext === "py") {
      return `${directory}/test_${base}.py`;
    }
    return `${directory}/${base}.spec.${ext}`;
  }

  if (ext === "go") {
    return `tests/${role}/${base}_test.go`;
  }
  if (ext === "py") {
    return `tests/${role}/test_${base}.py`;
  }
  return `tests/${role}/${base}.spec.${ext}`;
}

function buildImplementationPlan(ir: RPGIR): ImplPlan {
  const nodeById = new Map(ir.nodes.map((node) => [node.id, node]));
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, Edge[]>();

  for (const node of ir.nodes) {
    inDegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }

  for (const edge of ir.edges) {
    adjacency.get(edge.from.node)?.push(edge);
    inDegree.set(edge.to.node, (inDegree.get(edge.to.node) ?? 0) + 1);
  }

  const queue = ir.nodes
    .filter((node) => (inDegree.get(node.id) ?? 0) === 0)
    .map((node) => node.id);

  const batches: ImplTask[][] = [];
  const processed = new Set<string>();

  while (queue.length > 0) {
    const level = [...queue];
    queue.length = 0;
    const tasks: ImplTask[] = [];

    for (const nodeId of level) {
      processed.add(nodeId);
      const node = nodeById.get(nodeId)!;
      const nodeView = buildNodeView(ir, nodeId);
      const layout = ir.file_layout ?? { files: [], barrels: [] };
      const nodeFiles = (layout.files ?? []).filter((file) => file.nodeId === nodeId);
      const targetFiles = nodeFiles.filter((file) => file.kind === "code").map((file) => file.path);
      const tests = nodeFiles.filter((file) => file.kind === "test").map((file) => file.path);
      const hints = deriveExecutionHints(node, nodeView);

      tasks.push({
        nodeId,
        nodeView,
        targetFiles,
        tests,
        buildPrompt: node.build_prompt ?? "",
        hints,
      });

      for (const edge of adjacency.get(nodeId) ?? []) {
        const nextId = edge.to.node;
        inDegree.set(nextId, (inDegree.get(nextId) ?? 0) - 1);
        if ((inDegree.get(nextId) ?? 0) === 0) {
          queue.push(nextId);
        }
      }
    }

    batches.push(tasks);
  }

  if (processed.size !== ir.nodes.length) {
    throwToolError(ERROR_CODES.CYCLE, "Graph contains cycles, cannot emit implementation batches");
  }

  return { batches };
}

function buildNodeView(ir: RPGIR, nodeId: string): NodeView {
  const node = ir.nodes.find((n) => n.id === nodeId)!;
  const producers: NodeView["producers"] = {};
  const consumers: NodeView["consumers"] = {};

  for (const edge of ir.edges) {
    if (edge.to.node === nodeId) {
      const producerNode = ir.nodes.find((n) => n.id === edge.from.node);
      const targetPort = edge.to.port;
      if (!producers[targetPort]) producers[targetPort] = [];
      const sourcePort = producerNode?.outputs.find((p) => p.name === edge.from.port);
      producers[targetPort].push({ nodeId: edge.from.node, type: sourcePort?.type });
    }
    if (edge.from.node === nodeId) {
      const consumerNode = ir.nodes.find((n) => n.id === edge.to.node);
      const sourcePort = edge.from.port;
      if (!consumers[sourcePort]) consumers[sourcePort] = [];
      const targetPort = consumerNode?.inputs.find((p) => p.name === edge.to.port);
      consumers[sourcePort].push({ nodeId: edge.to.node, type: targetPort?.type });
    }
  }

  return { self: node, producers, consumers };
}

function deriveExecutionHints(node: Node, view: NodeView): ExecutionHint[] {
  const hints: ExecutionHint[] = [];

  if (node.kind === "adapter") {
    hints.push({ kind: "context", detail: ["type-coercion"] });
  }
  if ((node.tags ?? []).includes("external-io")) {
    hints.push({ kind: "timeout", detail: 30000 });
  }
  if (Object.keys(view.producers ?? {}).length > 2) {
    hints.push({ kind: "retry", detail: 2 });
  }

  return hints;
}

// ============================================================================
// Repair & Composition Tools
// ============================================================================

export async function insertAdapter(args: {
  requestId?: string;
  edge: { from: { node: string; port: string }; to: { node: string; port: string } };
  adapter: {
    name_hint?: string;
    summary: string;
    tags?: string[];
    language?: string;
    buffer?: boolean;
  };
}): Promise<ToolResponse<{ ir: RPGIR; adapterId: string }>> {
  return executeMutation(args.requestId, ({ working }) => {
    ensurePhase(working, ["typing", "ready"]);

    const edgeIndex = working.edges.findIndex(
      (edge) =>
        edge.from.node === args.edge.from.node &&
        edge.from.port === args.edge.from.port &&
        edge.to.node === args.edge.to.node &&
        edge.to.port === args.edge.to.port
    );

    if (edgeIndex === -1) {
      throwToolError(ERROR_CODES.NOTHING_TO_DO, "Edge to adapt not found");
    }

    const originalEdge = working.edges[edgeIndex];
    const sourceNode = requireNode(working, originalEdge.from.node);
    const targetNode = requireNode(working, originalEdge.to.node);
    const sourcePort = requirePort(sourceNode, "output", originalEdge.from.port).port;
    const targetPort = requirePort(targetNode, "input", originalEdge.to.port).port;

    const baseName = args.adapter.name_hint ?? `${sourceNode.id}-${targetNode.id}-adapter`;
    const adapterId = generateNodeId(baseName, working.nodes);

    const inputPortName = sanitizePortName(targetPort.name, "input");
    const outputPortName = sanitizePortName(sourcePort.name, "output");

    const adapterNode: Node = {
      id: adapterId,
      kind: "adapter",
      summary: args.adapter.summary,
      inputs: [{ name: inputPortName, required: true }],
      outputs: [{ name: outputPortName, required: true }],
      language: args.adapter.language ?? sourceNode.language ?? targetNode.language,
      tags: args.adapter.tags ?? [],
      buffer: args.adapter.buffer ?? true,
    };

    working.nodes.push(adapterNode);
    working.edges.splice(edgeIndex, 1);

    const upstreamEdge: Edge = {
      from: { node: sourceNode.id, port: originalEdge.from.port },
      to: { node: adapterId, port: inputPortName },
      order_before: originalEdge.order_before,
    };

    const downstreamEdge: Edge = {
      from: { node: adapterId, port: outputPortName },
      to: { node: targetNode.id, port: originalEdge.to.port },
      order_before: originalEdge.order_before,
    };

    working.edges.push(upstreamEdge, downstreamEdge);

    return {
      ir: working,
      makeResult: (finalIr) => ({ ir: finalIr, adapterId }),
    };
  });
}

export async function renamePort(args: {
  requestId?: string;
  node: string;
  direction: "input" | "output";
  from: string;
  to: string;
}): Promise<ToolResponse<{ ir: RPGIR; port: string }>> {
  return executeMutation(args.requestId, ({ working }) => {
    ensurePhase(working, ["skeleton", "typing", "ready"]);
    const node = requireNode(working, args.node);
    const { port, ports } = requirePort(node, args.direction, args.from);

    const nextName = sanitizePortName(args.to, "port");
    if (ports.some((existing) => existing.name === nextName)) {
      throwToolError(ERROR_CODES.SCHEMA_INVALID, `Port ${nextName} already exists on ${args.node}`);
    }

    port.name = nextName;

    for (const edge of working.edges) {
      if (args.direction === "output" && edge.from.node === node.id && edge.from.port === args.from) {
        edge.from.port = nextName;
      }
      if (args.direction === "input" && edge.to.node === node.id && edge.to.port === args.from) {
        edge.to.port = nextName;
      }
    }

    return {
      ir: working,
      makeResult: (finalIr) => ({ ir: finalIr, port: nextName }),
    };
  });
}

export async function splitNode(args: {
  requestId?: string;
  node: string;
  parts: Array<{
    name_hint?: string;
    summary: string;
    inputs: string[];
    outputs: string[];
    tags?: string[];
  }>;
}): Promise<ToolResponse<{ ir: RPGIR; nodeIds: string[] }>> {
  return executeMutation(args.requestId, ({ working }) => {
    ensurePhase(working, ["skeleton", "typing"]);

    if (!args.parts || args.parts.length === 0) {
      throwToolError(ERROR_CODES.SCHEMA_INVALID, "split_node requires at least one part");
    }

    const original = requireNode(working, args.node);
    const originalInputNames = new Set(original.inputs.map((p) => p.name));
    const originalOutputNames = new Set(original.outputs.map((p) => p.name));

    const seenInputs = new Set<string>();
    const seenOutputs = new Set<string>();
    const newNodes: Node[] = [];

    for (const part of args.parts) {
      if (!part.summary || part.summary.trim().length === 0) {
        throwToolError(ERROR_CODES.SCHEMA_INVALID, "Part summary cannot be empty");
      }

      if (!part.outputs || part.outputs.length === 0) {
        throwToolError(ERROR_CODES.SCHEMA_INVALID, "Each part must declare at least one output");
      }

      for (const output of part.outputs) {
        if (!originalOutputNames.has(output)) {
          throwToolError(ERROR_CODES.SCHEMA_INVALID, `Output ${output} not found on ${original.id}`);
        }
        if (seenOutputs.has(output)) {
          throwToolError(ERROR_CODES.SCHEMA_INVALID, `Output ${output} assigned multiple times`);
        }
        seenOutputs.add(output);
      }

      for (const input of part.inputs ?? []) {
        if (!originalInputNames.has(input)) {
          throwToolError(ERROR_CODES.SCHEMA_INVALID, `Input ${input} not found on ${original.id}`);
        }
        seenInputs.add(input);
      }

      const baseName = part.name_hint ?? `${original.id}-${part.outputs[0]}`;
      const nodeId = generateNodeId(baseName, [...working.nodes, ...newNodes]);
      const inputs = original.inputs.filter((input) =>
        (part.inputs ?? original.inputs.map((p) => p.name)).includes(input.name)
      );
      const outputs = original.outputs.filter((output) => part.outputs.includes(output.name));

      const clone: Node = {
        id: nodeId,
        kind: original.kind,
        summary: part.summary,
        inputs: inputs.map((input) => ({ ...input })),
        outputs: outputs.map((output) => ({ ...output })),
        language: original.language,
        framework_hint: original.framework_hint,
        build_prompt: original.build_prompt,
        tags: part.tags ?? original.tags,
        contracts: original.contracts,
        deps: original.deps,
        module_candidates: original.module_candidates,
        buffer: original.buffer,
      };

      newNodes.push(clone);
    }

    if (seenOutputs.size !== originalOutputNames.size) {
      throwToolError(ERROR_CODES.SCHEMA_INVALID, "All original outputs must be allocated to parts");
    }
    if (seenInputs.size !== originalInputNames.size) {
      throwToolError(ERROR_CODES.SCHEMA_INVALID, "All original inputs must be allocated to parts");
    }

    const originalId = original.id;

    for (const partNode of newNodes) {
      working.nodes.push(partNode);
    }

    for (const edge of working.edges) {
      if (edge.to.node === originalId) {
        const matchingNode = newNodes.find((node) =>
          node.inputs.some((port) => port.name === edge.to.port)
        );
        if (!matchingNode) {
          throwToolError(ERROR_CODES.SCHEMA_INVALID, `No split node claimed input ${edge.to.port}`);
        }
        edge.to.node = matchingNode.id;
      }
      if (edge.from.node === originalId) {
        const matchingNode = newNodes.find((node) =>
          node.outputs.some((port) => port.name === edge.from.port)
        );
        if (!matchingNode) {
          throwToolError(ERROR_CODES.SCHEMA_INVALID, `No split node claimed output ${edge.from.port}`);
        }
        edge.from.node = matchingNode.id;
      }
    }

    working.nodes = working.nodes.filter((node) => node.id !== originalId);
    const uniqueEdges = new Map<string, Edge>();
    for (const edge of working.edges) {
      const key = `${edge.from.node}.${edge.from.port}->${edge.to.node}.${edge.to.port}`;
      uniqueEdges.set(key, edge);
    }
    working.edges = [...uniqueEdges.values()];

    return {
      ir: working,
      makeResult: (finalIr) => ({ ir: finalIr, nodeIds: newNodes.map((node) => node.id) }),
    };
  });
}

export async function mergeNodes(args: {
  requestId?: string;
  nodes: string[];
  name_hint?: string;
  summary: string;
  tags?: string[];
}): Promise<ToolResponse<{ ir: RPGIR; nodeId: string }>> {
  return executeMutation(args.requestId, ({ working }) => {
    ensurePhase(working, ["skeleton", "typing"]);

    if (!args.nodes || args.nodes.length < 2) {
      throwToolError(ERROR_CODES.SCHEMA_INVALID, "merge_nodes requires at least two nodes");
    }

    const mergeSet = new Set(args.nodes);
    const nodes = args.nodes.map((id) => requireNode(working, id));
    const kind = nodes[0].kind;
    if (!nodes.every((node) => node.kind === kind)) {
      throwToolError(ERROR_CODES.SCHEMA_INVALID, "All nodes to merge must have the same kind");
    }

    const inputMap = new Map<string, Port>();
    const outputMap = new Map<string, Port>();

    const mergePort = (map: Map<string, Port>, port: Port, scope: string) => {
      if (map.has(port.name)) {
        const existing = map.get(port.name)!;
        if (stableStringify(existing) !== stableStringify(port)) {
          throwToolError(ERROR_CODES.SCHEMA_INVALID, `Port conflict on ${scope}.${port.name}`);
        }
      } else {
        map.set(port.name, { ...port });
      }
    };

    for (const node of nodes) {
      node.inputs.forEach((port) => mergePort(inputMap, port, node.id));
      node.outputs.forEach((port) => mergePort(outputMap, port, node.id));
    }

    const baseName = args.name_hint ?? `${nodes[0].id}-merged`;
    const mergedId = generateNodeId(baseName, working.nodes);

    const mergedNode: Node = {
      id: mergedId,
      kind,
      summary: args.summary,
      inputs: [...inputMap.values()],
      outputs: [...outputMap.values()],
      language: nodes[0].language,
      framework_hint: nodes[0].framework_hint,
      build_prompt: nodes[0].build_prompt,
      tags: args.tags ?? Array.from(new Set(nodes.flatMap((node) => node.tags ?? []))),
      contracts: nodes[0].contracts,
      deps: Array.from(new Set(nodes.flatMap((node) => node.deps ?? []))),
      module_candidates: Array.from(new Set(nodes.flatMap((node) => node.module_candidates ?? []))),
      buffer: nodes.some((node) => node.buffer),
    };

    working.nodes.push(mergedNode);

    for (const edge of working.edges) {
      if (mergeSet.has(edge.from.node)) {
        if (!outputMap.has(edge.from.port)) {
          throwToolError(ERROR_CODES.SCHEMA_INVALID, `Merged node missing output ${edge.from.port}`);
        }
        edge.from.node = mergedId;
      }
      if (mergeSet.has(edge.to.node)) {
        if (!inputMap.has(edge.to.port)) {
          throwToolError(ERROR_CODES.SCHEMA_INVALID, `Merged node missing input ${edge.to.port}`);
        }
        edge.to.node = mergedId;
      }
    }

    working.nodes = working.nodes.filter((node) => !mergeSet.has(node.id));
    const uniqueEdges = new Map<string, Edge>();
    for (const edge of working.edges) {
      const key = `${edge.from.node}.${edge.from.port}->${edge.to.node}.${edge.to.port}`;
      uniqueEdges.set(key, edge);
    }
    working.edges = [...uniqueEdges.values()];

    return {
      ir: working,
      makeResult: (finalIr) => ({ ir: finalIr, nodeId: mergedId }),
    };
  });
}

export async function patchIR(args: {
  requestId?: string;
  operations: JsonPatchOperation[];
}): Promise<ToolResponse<{ ir: RPGIR }>> {
  if (!args.operations || args.operations.length === 0) {
    throwToolError(ERROR_CODES.PATCH_FAILED, "No patch operations supplied");
  }

  return executeMutation(args.requestId, ({ working }) => {
    try {
      applyJsonPatch(working, args.operations);
    } catch (error) {
      throwToolError(ERROR_CODES.PATCH_FAILED, (error as Error).message);
    }
    return {
      ir: working,
      makeResult: (finalIr) => ({ ir: finalIr }),
    };
  });
}

// ============================================================================
// Compatibility & Scoring
// ============================================================================

export async function validateCompatibility(): Promise<ToolResponse<{ errors: MCPError[] }>> {
  try {
    const ir = loadIR();
    const errors = validateAll(ir).filter(
      (error) =>
        error.code === ERROR_CODES.CONSTRAINT_VIOLATION ||
        error.code === ERROR_CODES.POLICY_VIOLATION
    );
    return {
      ok: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      result: { errors },
      irHash: ir.hash,
    };
  } catch (error) {
    return mutationError(error);
  }
}

export async function scoreIR(): Promise<ToolResponse<{ score: number; breakdown: Record<string, number>; stats: Record<string, number> }>> {
  try {
    const ir = loadIR();
    const capabilityTarget = ir.requirements?.capabilities ?? [];
    const covered = new Set(
      ir.nodes.flatMap((node) => node.tags ?? [])
    );
    const coverageScore = capabilityTarget.length === 0
      ? 1
      : capabilityTarget.filter((cap) => covered.has(cap)).length / capabilityTarget.length;

    const adapterCount = ir.nodes.filter((node) => node.kind === "adapter").length;
    const adapterScore = ir.nodes.length === 0
      ? 1
      : 1 - Math.min(1, adapterCount / ir.nodes.length);

    let depthScore = 1;
    try {
      const plan = buildImplementationPlan(ir);
      const depth = plan.batches.length;
      depthScore = 1 - Math.min(1, (depth - 1) / 10);
    } catch {
      depthScore = 0;
    }

    const weightCoverage = 0.5;
    const weightAdapters = 0.25;
    const weightDepth = 0.25;

    const finalScore = Number(
      Math.max(
        0,
        Math.min(
          1,
          weightCoverage * coverageScore +
            weightAdapters * adapterScore +
            weightDepth * depthScore
        )
      ).toFixed(3)
    );

    const breakdown = {
      coverage: Number(coverageScore.toFixed(3)),
      adapterEfficiency: Number(adapterScore.toFixed(3)),
      depth: Number(depthScore.toFixed(3)),
    };

    const stats = {
      nodes: ir.nodes.length,
      adapters: adapterCount,
      edges: ir.edges.length,
    };

    return {
      ok: true,
      result: { score: finalScore, breakdown, stats },
      irHash: ir.hash,
    };
  } catch (error) {
    return mutationError(error);
  }
}

// ============================================================================
// Introspection & Export
// ============================================================================

export async function getRPGView(): Promise<ToolResponse<{ ir: RPGIR; summary: ValidationSummary; phase: IRPhase }>> {
  try {
    const ir = loadIR();
    const validations = validateAll(ir);
    return {
      ok: validations.length === 0,
      errors: validations.length > 0 ? validations : undefined,
      result: {
        ir,
        summary: summarize(ir, validations),
        phase: getPhase(ir),
      },
      irHash: ir.hash,
    };
  } catch (error) {
    return mutationError(error);
  }
}

export async function getImplView(): Promise<ToolResponse<{ layout: FileLayout | null; plan: ImplPlan | null; phase: IRPhase }>> {
  try {
    const ir = loadIR();
    if (!ir.file_layout) {
      return {
        ok: false,
        errors: [{
          code: ERROR_CODES.SCHEMA_INVALID,
          msg: "File layout missing. Run plan_file_layout first.",
        }],
        result: { layout: null, plan: null, phase: getPhase(ir) },
        irHash: ir.hash,
      };
    }

    let plan: ImplPlan | null = null;
    try {
      plan = buildImplementationPlan(ir);
    } catch {
      plan = null;
    }

    return {
      ok: true,
      result: {
        layout: ir.file_layout,
        plan,
        phase: getPhase(ir),
      },
      irHash: ir.hash,
    };
  } catch (error) {
    return mutationError(error);
  }
}

export async function exportGraphviz(args: { view: "rpg" | "impl" }): Promise<ToolResponse<{ dot: string }>> {
  try {
    const ir = loadIR();
    if (args.view === "impl" && !ir.file_layout) {
      return {
        ok: false,
        errors: [{
          code: ERROR_CODES.SCHEMA_INVALID,
          msg: "File layout missing. Run plan_file_layout first.",
        }],
        irHash: ir.hash,
      };
    }

    const dot = args.view === "impl"
      ? renderImplGraphviz(ir)
      : renderRpgGraphviz(ir);

    return {
      ok: true,
      result: { dot },
      irHash: ir.hash,
    };
  } catch (error) {
    return mutationError(error);
  }
}

// ============================================================================
// Supporting Helpers
// ============================================================================

function sanitizePortName(name: string, fallback: string): string {
  let normalized = name.toLowerCase().replace(/[^a-z0-9_]/g, "_");
  normalized = normalized.replace(/_+/g, "_").replace(/^_+/, "").replace(/_+$/, "");
  if (!normalized) {
    normalized = fallback;
  }
  if (!/^[a-z]/.test(normalized)) {
    normalized = `p_${normalized}`;
  }
  return normalized.slice(0, 64);
}

function applyJsonPatch(target: any, operations: JsonPatchOperation[]): void {
  for (const operation of operations) {
    const segments = decodePointer(operation.path);
    if (segments.length === 0) {
      throw new Error("Root-level patch operations are not supported");
    }

    const { parent, key } = getPointerParent(target, segments.slice(0, -1));
    const lastSegment = segments[segments.length - 1];

    switch (operation.op) {
      case "add": {
        if (Array.isArray(parent)) {
          if (lastSegment === "-") {
            parent.push(operation.value);
          } else {
            const index = parseInt(lastSegment, 10);
            if (Number.isNaN(index)) {
              throw new Error(`Invalid array index: ${lastSegment}`);
            }
            parent.splice(index, 0, operation.value);
          }
        } else if (isObject(parent)) {
          parent[lastSegment] = operation.value;
        } else {
          throw new Error(`Cannot add property on non-container for path ${operation.path}`);
        }
        break;
      }
      case "remove": {
        if (Array.isArray(parent)) {
          const index = parseInt(lastSegment, 10);
          if (Number.isNaN(index)) {
            throw new Error(`Invalid array index: ${lastSegment}`);
          }
          parent.splice(index, 1);
        } else if (isObject(parent)) {
          delete parent[lastSegment];
        } else {
          throw new Error(`Cannot remove property on non-container for path ${operation.path}`);
        }
        break;
      }
      case "replace": {
        if (Array.isArray(parent)) {
          const index = parseInt(lastSegment, 10);
          if (Number.isNaN(index)) {
            throw new Error(`Invalid array index: ${lastSegment}`);
          }
          parent[index] = operation.value;
        } else if (isObject(parent)) {
          parent[lastSegment] = operation.value;
        } else {
          throw new Error(`Cannot replace property on non-container for path ${operation.path}`);
        }
        break;
      }
      default:
        throw new Error(`Unsupported patch operation: ${operation.op}`);
    }
  }
}

function decodePointer(path: string): string[] {
  if (path === "") return [];
  const segments = path.split("/").slice(1);
  return segments.map((segment) => segment.replace(/~1/g, "/").replace(/~0/g, "~"));
}

function getPointerParent(target: any, segments: string[]): { parent: any; key: string } {
  let parent = target;
  for (const segment of segments) {
    if (Array.isArray(parent)) {
      const index = parseInt(segment, 10);
      if (Number.isNaN(index)) {
        throw new Error(`Invalid array index: ${segment}`);
      }
      parent = parent[index];
    } else if (isObject(parent)) {
      if (!(segment in parent)) {
        parent[segment] = {};
      }
      parent = parent[segment];
    } else {
      throw new Error(`Cannot traverse pointer segment: ${segment}`);
    }
  }
  return { parent, key: segments[segments.length - 1] };
}

function isObject(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function renderRpgGraphviz(ir: RPGIR): string {
  const lines: string[] = [
    "digraph RPG {",
    '  rankdir=LR;',
    '  node [shape=box, style=rounded];',
  ];

  for (const node of [...ir.nodes].sort((a, b) => a.id.localeCompare(b.id))) {
    const label = `${node.id}\\n${node.kind}`;
    lines.push(`  "${node.id}" [label="${label}"];`);
  }

  for (const edge of [...ir.edges].sort((a, b) => {
    const left = `${a.from.node}.${a.from.port}->${a.to.node}.${a.to.port}`;
    const right = `${b.from.node}.${b.from.port}->${b.to.node}.${b.to.port}`;
    return left.localeCompare(right);
  })) {
    const label = `${edge.from.port} \\u2192 ${edge.to.port}`;
    lines.push(`  "${edge.from.node}" -> "${edge.to.node}" [label="${label}"];`);
  }

  lines.push("}");
  return lines.join("\n");
}

function renderImplGraphviz(ir: RPGIR): string {
  const plan = buildImplementationPlan(ir);
  const lines: string[] = [
    "digraph Impl {",
    "  rankdir=LR;",
    "  compound=true;",
  ];

  plan.batches.forEach((batch, index) => {
    lines.push(`  subgraph cluster_${index} {`);
    lines.push(`    label="Batch ${index + 1}";`);
    for (const task of batch) {
      const node = ir.nodes.find((n) => n.id === task.nodeId);
      const summary = node ? node.summary.replace(/"/g, '\\"') : "";
      const label = `${task.nodeId}\\n${summary}`;
      lines.push(`    "${task.nodeId}" [label="${label}", shape=box, style=rounded];`);
    }
    lines.push("  }");
  });

  for (const edge of ir.edges) {
    lines.push(`  "${edge.from.node}" -> "${edge.to.node}" [label="${edge.from.port}→${edge.to.port}"];`);
  }

  lines.push("}");
  return lines.join("\n");
}
