import { describe, it, expect } from "vitest";
import { validateAll, isTypeCompatible, detectCycles } from "../src/validators.js";
import { RPGIR, Node, TypeExpr } from "../src/ir.js";
import { ERROR_CODES } from "../src/errors.js";

function createBaseIr(): RPGIR {
  return {
    version: "rpg-ir@0.1",
    rev: 1,
    project: {
      id: "test",
      name: "Test Project",
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
    nodes: [],
    edges: [],
    adapters: [],
    file_layout: undefined,
    metadata: { lifecycle: { phase: "skeleton" } },
  };
}

describe("validators", () => {
  it("detects missing required inputs", () => {
    const ir = createBaseIr();

    const producer: Node = {
      id: "producer@1",
      kind: "module",
      summary: "Produces data",
      inputs: [],
      outputs: [{ name: "out", required: true }],
    };

    const consumer: Node = {
      id: "consumer@1",
      kind: "module",
      summary: "Consumes data",
      inputs: [{ name: "in", required: true }],
      outputs: [],
    };

    ir.nodes = [producer, consumer];

    const errors = validateAll(ir);
    expect(errors.some((error) => error.code === ERROR_CODES.UNCONNECTED_REQUIRED_INPUT)).toBe(true);
  });

  it("allows literal widening to scalar", () => {
    const literal: TypeExpr = { kind: "Literal", valueType: "String", value: "ok" };
    const scalar: TypeExpr = { kind: "Scalar", name: "String" };

    expect(isTypeCompatible(literal, scalar)).toBe(true);
  });

  it("permits cycles only when buffered", () => {
    const ir = createBaseIr();

    const a: Node = {
      id: "a@1",
      kind: "module",
      summary: "A",
      inputs: [{ name: "in", required: true }],
      outputs: [{ name: "out", required: true }],
    };
    const b: Node = {
      id: "b@1",
      kind: "module",
      summary: "B",
      inputs: [{ name: "in", required: true }],
      outputs: [{ name: "out", required: true }],
      buffer: true,
    };

    ir.nodes = [a, b];
    ir.edges = [
      { from: { node: "a@1", port: "out" }, to: { node: "b@1", port: "in" } },
      { from: { node: "b@1", port: "out" }, to: { node: "a@1", port: "in" } },
    ];

    expect(detectCycles(ir)).toHaveLength(0);

    b.buffer = false;
    expect(detectCycles(ir).some((error) => error.code === ERROR_CODES.CYCLE)).toBe(true);
  });
});
