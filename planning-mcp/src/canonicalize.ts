/**
 * Pure canonicalization utilities for RPGIR
 * Ensures deterministic ordering and normalization prior to hashing/persisting
 */

import { RPGIR, Node, Edge, Port, TypeExpr, FileLayout } from "./ir.ts";
import { stableStringify } from "./util.ts";

export function normalizeIR(ir: RPGIR): RPGIR {
  const clone = JSON.parse(JSON.stringify(ir)) as RPGIR;

  delete (clone as { hash?: string }).hash;

  clone.nodes = (clone.nodes ?? [])
    .map(normalizeNode)
    .sort((a, b) => a.id.localeCompare(b.id));

  clone.edges = (clone.edges ?? [])
    .map(normalizeEdge)
    .sort(compareEdges);

  if (clone.adapters) {
    clone.adapters = [...clone.adapters].sort((a, b) =>
      stableStringify(a).localeCompare(stableStringify(b))
    );
  }

  if (clone.file_layout) {
    clone.file_layout = normalizeFileLayout(clone.file_layout);
  }

  if (clone.requirements) {
    clone.requirements = normalizePlainObject(clone.requirements);
  }

  if (clone.constraints) {
    clone.constraints = normalizePlainObject(clone.constraints);
    if (Array.isArray(clone.constraints.runtime)) {
      clone.constraints.runtime = [...clone.constraints.runtime].sort();
    }
    if (Array.isArray(clone.constraints.licenses_allow)) {
      clone.constraints.licenses_allow = [...clone.constraints.licenses_allow].sort();
    }
    if (Array.isArray(clone.constraints.licenses_deny)) {
      clone.constraints.licenses_deny = [...clone.constraints.licenses_deny].sort();
    }
  }

  if (clone.metadata) {
    clone.metadata = normalizePlainObject(clone.metadata);
  }

  return JSON.parse(stableStringify(clone)) as RPGIR;
}

function normalizeNode(node: Node): Node {
  const normalized: Node = {
    ...node,
    inputs: (node.inputs ?? []).map(normalizePort).sort(comparePorts),
    outputs: (node.outputs ?? []).map(normalizePort).sort(comparePorts),
  };

  if (normalized.tags) {
    normalized.tags = [...normalized.tags].sort();
  }

  if (normalized.deps) {
    normalized.deps = [...normalized.deps].sort();
  }

  if (normalized.module_candidates) {
    normalized.module_candidates = [...normalized.module_candidates].sort();
  }

  if (normalized.contracts) {
    normalized.contracts = {
      ...normalized.contracts,
      pre: normalized.contracts.pre ? [...normalized.contracts.pre].sort() : undefined,
      post: normalized.contracts.post ? [...normalized.contracts.post].sort() : undefined,
      invariants: normalized.contracts.invariants
        ? [...normalized.contracts.invariants].sort()
        : undefined,
    };
  }

  if (normalized.quality?.evidence) {
    normalized.quality = {
      ...normalized.quality,
      evidence: [...normalized.quality.evidence].sort(),
    };
  }

  if (normalized.security?.known_issues) {
    normalized.security = {
      ...normalized.security,
      known_issues: [...normalized.security.known_issues].sort(),
    };
  }

  if (node.buffer === true) {
    normalized.buffer = true;
  } else {
    delete (normalized as { buffer?: boolean }).buffer;
  }

  delete (normalized as { hash?: string }).hash;

  return normalized;
}

function normalizePort(port: Port): Port {
  const cleanedName = port.name.trim();
  const normalized: Port = {
    ...port,
    name: cleanedName,
    required: port.required === false ? false : true,
  };

  if (port.type) {
    normalized.type = normalizeTypeExpr(port.type);
  }

  return normalized;
}

function normalizeEdge(edge: Edge): Edge {
  return {
    ...edge,
    from: {
      node: edge.from.node,
      port: edge.from.port,
    },
    to: {
      node: edge.to.node,
      port: edge.to.port,
    },
    order_before: edge.order_before === true,
  };
}

function comparePorts(a: Port, b: Port): number {
  return a.name.localeCompare(b.name);
}

function compareEdges(a: Edge, b: Edge): number {
  const keyA = `${a.from.node}.${a.from.port}->${a.to.node}.${a.to.port}`;
  const keyB = `${b.from.node}.${b.from.port}->${b.to.node}.${b.to.port}`;
  return keyA.localeCompare(keyB);
}

function normalizeTypeExpr(type: TypeExpr): TypeExpr {
  switch (type.kind) {
    case "Scalar":
      return { kind: "Scalar", name: type.name };
    case "Array":
      return { kind: "Array", of: normalizeTypeExpr(type.of) };
    case "Record": {
      const entries = Object.entries(type.fields ?? {}).map(([key, value]) => ({
        key: key.trim(),
        value: normalizeTypeExpr(value),
      }));
      entries.sort((left, right) => left.key.localeCompare(right.key));
      const fields: Record<string, TypeExpr> = {};
      for (const entry of entries) {
        fields[entry.key] = entry.value;
      }
      return { kind: "Record", fields };
    }
    case "Union": {
      const options = [...type.options].map(normalizeTypeExpr);
      options.sort((left, right) => {
        const a = stableStringify(left);
        const b = stableStringify(right);
        return a.localeCompare(b);
      });
      return { kind: "Union", options };
    }
    case "Opaque":
      return { kind: "Opaque", name: type.name };
    case "Literal":
      return {
        kind: "Literal",
        valueType: type.valueType,
        value: type.value,
      };
    default:
      return type;
  }
}

function normalizeFileLayout(layout: FileLayout): FileLayout {
  const files = (layout.files ?? [])
    .map((entry) => ({
      ...entry,
      path: entry.path.trim(),
      language: entry.language,
    }))
    .sort((a, b) => a.path.localeCompare(b.path));

  const barrels = (layout.barrels ?? [])
    .map((barrel) => ({
      path: barrel.path.trim(),
      exports: [...barrel.exports].sort(),
    }))
    .sort((a, b) => a.path.localeCompare(b.path));

  return {
    ...layout,
    files,
    barrels,
  };
}

function normalizePlainObject<T extends Record<string, any> | undefined>(value: T): T {
  if (!value) return value;
  const sortedEntries = Object.entries(value).sort(([a], [b]) => a.localeCompare(b));
  const result: Record<string, any> = {};
  for (const [key, val] of sortedEntries) {
    if (Array.isArray(val)) {
      const normalizedArray = val.map((item) => {
        if (item && typeof item === "object") {
          return normalizePlainObject(item as Record<string, any>);
        }
        return item;
      });
      normalizedArray.sort((a, b) =>
        stableStringify(a).localeCompare(stableStringify(b))
      );
      result[key] = normalizedArray;
    } else if (val && typeof val === "object") {
      result[key] = normalizePlainObject(val);
    } else {
      result[key] = val;
    }
  }
  return result as T;
}
