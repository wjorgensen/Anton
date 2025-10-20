import { describe, it, expect } from "vitest";
import { normalizeIR } from "../src/canonicalize.js";
import { hashIR } from "../src/validators.js";
import { RPGIR } from "../src/ir.js";

const NODE_SPECS: Record<string, { summary: string; inputs: { name: string; required: boolean }[]; outputs: { name: string; required: boolean }[] }> = {
  alpha: {
    summary: "Node alpha",
    inputs: [],
    outputs: [{ name: "out", required: true }],
  },
  zeta: {
    summary: "Node zeta",
    inputs: [{ name: "in", required: true }],
    outputs: [],
  },
};

function buildIr(nodeOrder: string[]): RPGIR {
  return {
    version: "rpg-ir@0.1",
    rev: 5,
    project: {
      id: "demo",
      name: "Demo",
      created_at: new Date().toISOString(),
    },
    requirements: {
      goal: "Test",
      capabilities: [],
      io_boundaries: { inputs: [], outputs: [] },
    },
    constraints: {
      runtime: ["node>=20"],
      licenses_allow: ["MIT"],
      licenses_deny: [],
    },
    nodes: nodeOrder.map((id) => ({
      id: `${id}@1`,
      kind: "module",
      summary: NODE_SPECS[id].summary,
      inputs: [...NODE_SPECS[id].inputs],
      outputs: [...NODE_SPECS[id].outputs],
    })),
    edges: [
      {
        from: { node: "alpha@1", port: "out" },
        to: { node: "zeta@1", port: "in" },
      },
    ],
    adapters: [],
    file_layout: undefined,
    metadata: { lifecycle: { phase: "ready" } },
  };
}

describe("canonicalize", () => {
  it("normalizes ordering deterministically", () => {
    const irA = buildIr(["zeta", "alpha"]);
    const irB = buildIr(["alpha", "zeta"]);

    const normA = normalizeIR(irA);
    const normB = normalizeIR(irB);

    expect(normA.nodes.map((node) => node.id)).toEqual(["alpha@1", "zeta@1"]);
    expect(normB.nodes.map((node) => node.id)).toEqual(["alpha@1", "zeta@1"]);

    const hashA = hashIR(normA);
    const hashB = hashIR(normB);

    expect(hashA).toBe(hashB);
  });
});
