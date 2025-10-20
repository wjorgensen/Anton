/**
 * Compiler-style validation pipeline for the RPG IR
 */

import { createHash } from "crypto";
import { RPGIR, TypeExpr, Constraints } from "./ir.ts";
import { MCPError, ValidationSummary, ERROR_CODES } from "./errors.ts";
import { stableStringify } from "./util.ts";

type RuntimeConstraint = {
  engine: string;
  comparator: ">=" | ">" | "=" | "~";
  version?: string;
};

/**
 * Compute content hash of IR for change tracking
 */
export function hashIR(ir: RPGIR): string {
  const { hash, ...irWithoutHash } = ir;
  const content = stableStringify(irWithoutHash);
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

/**
 * Minimal shape validation (schema checks only, no deep graph analysis)
 */
export function minimalShapeCheck(ir: RPGIR): MCPError[] {
  const errors: MCPError[] = [];

  if (!Number.isInteger(ir.rev) || ir.rev < 1) {
    errors.push({
      code: ERROR_CODES.SCHEMA_INVALID,
      msg: "IR rev must be a positive integer",
      path: "rev",
    });
  }

  const idPattern = /^[a-z0-9](?:[a-z0-9._-]{1,62})?@\d+(?:\.\d+){0,2}$/;
  const portPattern = /^[a-z][a-z0-9_]{0,63}$/;
  const seenIds = new Set<string>();

  for (const node of ir.nodes) {
    if (!node.id || !idPattern.test(node.id)) {
      errors.push({
        code: ERROR_CODES.SCHEMA_INVALID,
        msg: `Invalid node id: ${node.id}`,
        path: node.id || "<missing>",
      });
      continue;
    }

    if (seenIds.has(node.id)) {
      errors.push({
        code: ERROR_CODES.DUP_NODE_ID,
        msg: `Duplicate node id ${node.id}`,
        path: node.id,
      });
    }
    seenIds.add(node.id);

    if (!node.summary || node.summary.trim().length === 0) {
      errors.push({
        code: ERROR_CODES.SCHEMA_INVALID,
        msg: `Node ${node.id} missing summary`,
        path: `${node.id}.summary`,
      });
    }

    validatePorts(node.id, "inputs", node.inputs, portPattern, errors);
    validatePorts(node.id, "outputs", node.outputs, portPattern, errors);
  }

  return errors;
}

/**
 * Full graph validation (all checks)
 */
export function validateAll(ir: RPGIR): MCPError[] {
  const errors: MCPError[] = [];
  errors.push(...minimalShapeCheck(ir));
  errors.push(...validatePortSaturation(ir));
  errors.push(...detectCycles(ir));
  errors.push(...validateTypeCompatibility(ir));
  errors.push(...validateConstraintCompatibility(ir.constraints ?? { runtime: [], licenses_allow: [], licenses_deny: [] }, ir));
  return errors;
}

/**
 * Detect cycles allowing buffered nodes to break loops
 */
export function detectCycles(ir: RPGIR): MCPError[] {
  const nodeMap = new Map(ir.nodes.map((node) => [node.id, node]));
  const adjacency = new Map<string, string[]>();

  for (const node of ir.nodes) {
    adjacency.set(node.id, []);
  }

  for (const edge of ir.edges) {
    if (edge.order_before) continue;
    const fromNode = nodeMap.get(edge.from.node);
    if (!fromNode) continue;
    if (fromNode.buffer === true) continue; // buffers break cycles
    adjacency.get(edge.from.node)?.push(edge.to.node);
  }

  const errors: MCPError[] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (nodeId: string, trail: string[]): boolean => {
    if (visiting.has(nodeId)) {
      const cyclePath = [...trail, nodeId].join(" -> ");
      errors.push({
        code: ERROR_CODES.CYCLE,
        msg: `Cycle detected: ${cyclePath}`,
        path: nodeId,
      });
      return true;
    }
    if (visited.has(nodeId)) {
      return false;
    }

    visiting.add(nodeId);
    const neighbours = adjacency.get(nodeId) ?? [];
    for (const next of neighbours) {
      if (visit(next, [...trail, nodeId])) {
        return true;
      }
    }
    visiting.delete(nodeId);
    visited.add(nodeId);
    return false;
  };

  for (const nodeId of adjacency.keys()) {
    if (!visited.has(nodeId) && visit(nodeId, [])) {
      break;
    }
  }

  return errors;
}

/**
 * Check that all required inputs are connected exactly once
 */
function validatePortSaturation(ir: RPGIR): MCPError[] {
  const errors: MCPError[] = [];
  const incomingByNodePort = new Map<string, number>();

  for (const edge of ir.edges) {
    const key = `${edge.to.node}::${edge.to.port}`;
    incomingByNodePort.set(key, (incomingByNodePort.get(key) ?? 0) + 1);
  }

  for (const node of ir.nodes) {
    for (const input of node.inputs) {
      const key = `${node.id}::${input.name}`;
      const count = incomingByNodePort.get(key) ?? 0;
      const required = input.required !== false;

      if (required && count === 0) {
        errors.push({
          code: ERROR_CODES.UNCONNECTED_REQUIRED_INPUT,
          msg: `Required input ${node.id}.${input.name} has no producer`,
          path: key,
        });
      }

      if (count > 1) {
        errors.push({
          code: ERROR_CODES.SCHEMA_INVALID,
          msg: `Input ${node.id}.${input.name} has ${count} producers (should be exactly one)`,
          path: key,
        });
      }
    }
  }

  return errors;
}

/**
 * Type compatibility validation with structural assignability
 */
function validateTypeCompatibility(ir: RPGIR): MCPError[] {
  const errors: MCPError[] = [];
  const nodeIndex = new Map(ir.nodes.map((node) => [node.id, node]));

  for (const edge of ir.edges) {
    const fromNode = nodeIndex.get(edge.from.node);
    const toNode = nodeIndex.get(edge.to.node);
    if (!fromNode || !toNode) continue;

    const fromPort = fromNode.outputs.find((p) => p.name === edge.from.port);
    const toPort = toNode.inputs.find((p) => p.name === edge.to.port);
    if (!fromPort || !toPort) continue;

    if (fromPort.type && toPort.type) {
      if (!isTypeCompatible(fromPort.type, toPort.type)) {
        errors.push({
          code: ERROR_CODES.TYPE_MISMATCH,
          msg: `Type mismatch ${edge.from.node}.${edge.from.port} -> ${edge.to.node}.${edge.to.port}`,
          path: `${edge.from.node}.${edge.from.port}`,
        });
      }
    }
  }

  return errors;
}

/**
 * Validate runtime/license/policy compatibility
 */
function validateConstraintCompatibility(constraints: Constraints, ir: RPGIR): MCPError[] {
  const errors: MCPError[] = [];
  const runtimes = (constraints.runtime ?? []).map(parseRuntimeConstraint).filter(Boolean) as RuntimeConstraint[];
  const policy = constraints.policy as (Record<string, any> | undefined);

  if (constraints.licenses_allow && constraints.licenses_deny) {
    const overlap = constraints.licenses_allow.filter((license) => constraints.licenses_deny.includes(license));
    if (overlap.length > 0) {
      errors.push({
        code: ERROR_CODES.CONSTRAINT_VIOLATION,
        msg: `License allow/deny overlap for ${overlap.join(", ")}`,
        path: "constraints.licenses",
      });
    }
  }

  for (const node of ir.nodes) {
    if (node.language) {
      const satisfied = runtimes.length === 0 || runtimes.some((runtime) => matchesRuntime(node.language!, runtime));
      if (!satisfied) {
        errors.push({
          code: ERROR_CODES.CONSTRAINT_VIOLATION,
          msg: `Node ${node.id} (language ${node.language}) violates runtime constraints`,
          path: `${node.id}.language`,
        });
      }
    }

    if (policy && Array.isArray(policy.deny_tags)) {
      const overlap = (node.tags ?? []).filter((tag) => policy.deny_tags.includes(tag));
      if (overlap.length > 0) {
        errors.push({
          code: ERROR_CODES.POLICY_VIOLATION,
          msg: `Node ${node.id} contains denied tags ${overlap.join(", ")}`,
          path: `${node.id}.tags`,
        });
      }
    }
  }

  if (policy && Array.isArray(policy.require_tags)) {
    for (const tag of policy.require_tags) {
      const covered = ir.nodes.some((node) => (node.tags ?? []).includes(tag));
      if (!covered) {
        errors.push({
          code: ERROR_CODES.POLICY_VIOLATION,
          msg: `Required policy tag ${tag} missing from all nodes`,
          path: "constraints.policy.require_tags",
        });
      }
    }
  }

  if (policy && policy.max_edges !== undefined) {
    const maxEdges = Number(policy.max_edges);
    if (!Number.isNaN(maxEdges) && ir.edges.length > maxEdges) {
      errors.push({
        code: ERROR_CODES.POLICY_VIOLATION,
        msg: `Edge count ${ir.edges.length} exceeds max_edges ${maxEdges}`,
        path: "constraints.policy.max_edges",
      });
    }
  }

  return errors;
}

/**
 * Generate validation summary from IR and errors
 */
export function summarize(ir: RPGIR, errors: MCPError[]): ValidationSummary {
  const typeMismatches = errors.filter((e) => e.code === ERROR_CODES.TYPE_MISMATCH).length;
  const unconnected = errors.filter((e) => e.code === ERROR_CODES.UNCONNECTED_REQUIRED_INPUT).length;
  const cycles = errors.filter((e) => e.code === ERROR_CODES.CYCLE).length;

  return {
    nodes: ir.nodes.length,
    edges: ir.edges.length,
    requiredInputsUnconnected: unconnected,
    typeMismatches,
    cycles,
  };
}

/**
 * Structural type compatibility check
 */
export function isTypeCompatible(sourceType: TypeExpr | undefined, targetType: TypeExpr | undefined): boolean {
  if (!sourceType || !targetType) {
    return true;
  }
  return assignable(sourceType, targetType);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validatePorts(nodeId: string, kind: "inputs" | "outputs", ports: any[], pattern: RegExp, errors: MCPError[]) {
  if (!Array.isArray(ports)) {
    errors.push({
      code: ERROR_CODES.SCHEMA_INVALID,
      msg: `Node ${nodeId} missing ${kind}`,
      path: `${nodeId}.${kind}`,
    });
    return;
  }

  const seen = new Set<string>();
  for (const port of ports) {
    const name = port?.name;
    if (!name || !pattern.test(name)) {
      errors.push({
        code: ERROR_CODES.SCHEMA_INVALID,
        msg: `Node ${nodeId} ${kind} contains invalid port name`,
        path: `${nodeId}.${kind}`,
      });
      continue;
    }

    if (seen.has(name)) {
      errors.push({
        code: ERROR_CODES.SCHEMA_INVALID,
        msg: `Node ${nodeId} ${kind} has duplicate port ${name}`,
        path: `${nodeId}.${kind}.${name}`,
      });
    }
    seen.add(name);
  }
}

function assignable(source: TypeExpr, target: TypeExpr): boolean {
  if (target.kind === "Union") {
    return target.options.some((option) => assignable(source, option));
  }

  if (source.kind === "Union") {
    return source.options.every((option) => assignable(option, target));
  }

  if (target.kind === "Literal") {
    if (source.kind === "Literal") {
      return (
        source.valueType === target.valueType &&
        source.value === target.value
      );
    }
    return false;
  }

  if (source.kind === "Literal") {
    if (target.kind === "Scalar") {
      return literalMatchesScalar(source, target.name);
    }
    return false;
  }

  if (source.kind === "Scalar" && target.kind === "Scalar") {
    return source.name === target.name;
  }

  if (source.kind === "Opaque" && target.kind === "Opaque") {
    return source.name === target.name;
  }

  if (source.kind === "Array" && target.kind === "Array") {
    return assignable(source.of, target.of);
  }

  if (source.kind === "Record" && target.kind === "Record") {
    const sourceFields = source.fields ?? {};
    const targetFields = target.fields ?? {};
    return Object.entries(targetFields).every(([fieldName, targetType]) => {
      const sourceType = sourceFields[fieldName];
      if (!sourceType) return false;
      return assignable(sourceType, targetType);
    });
  }

  return false;
}

function literalMatchesScalar(literal: TypeExpr & { kind: "Literal" }, scalar: string): boolean {
  switch (scalar) {
    case "String":
      return literal.valueType === "String";
    case "Number":
      return literal.valueType === "Number";
    case "Bool":
      return literal.valueType === "Bool";
    default:
      return false;
  }
}

function parseRuntimeConstraint(runtime: string): RuntimeConstraint | null {
  const trimmed = runtime.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const match = trimmed.match(/^([a-z0-9_-]+)\s*(>=|>|=|~)?\s*(.+)?$/i);
  if (!match) {
    return null;
  }

  const [, engineRaw, comparatorRaw, versionRaw] = match;
  const engine = engineRaw.toLowerCase();
  const comparator = (comparatorRaw as RuntimeConstraint["comparator"]) ?? ">=";
  const version = versionRaw?.trim();

  return { engine, comparator, version };
}

function matchesRuntime(language: string, runtime: RuntimeConstraint): boolean {
  const normalizedLang = language.toLowerCase();
  if (!normalizedLang.startsWith(runtime.engine)) {
    return false;
  }
  // Without explicit version info we accept match on engine
  return true;
}
