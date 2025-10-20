import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import path from "path";
import os from "os";
import { startSession, addNode, addEdge, setPortType, validateGraph, planFileLayout, emitImplBatches, getIR } from "../src/tools.js";
import { clearRequestCache } from "../src/store.js";
import { ERROR_CODES } from "../src/errors.js";

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(path.join(os.tmpdir(), "planning-mcp-"));
  process.env.PROJECT_FOLDER_PATH = tempDir;
  clearRequestCache();
});

afterEach(() => {
  clearRequestCache();
  if (process.env.ANTON_PLAN_PATH) {
    try {
      rmSync(process.env.ANTON_PLAN_PATH, { force: true });
    } catch {
      // ignore
    }
  }
  try {
    rmSync(tempDir, { recursive: true, force: true });
  } catch {
    // ignore
  }
  delete process.env.PROJECT_FOLDER_PATH;
  delete process.env.ANTON_PLAN_PATH;
});

describe("skeleton to implementation e2e", () => {
  it("progresses through phases and emits batches", async () => {
    const session = await startSession({
      name: "demo-project",
      goal: "Ship",
      capabilities: [],
      io_boundaries: { inputs: [], outputs: [] },
    });

    if (!session.ok) {
      throw new Error(`startSession failed: ${JSON.stringify(session.errors)}`);
    }

    const planPath = session.result!.planFilePath;
    process.env.ANTON_PLAN_PATH = planPath;

    await addNode({
      kind: "module",
      summary: "Fetch data",
      outputs: [{ name: "payload", required: true }],
      tags: ["source"],
    });

    await addNode({
      kind: "module",
      summary: "Process data",
      inputs: [{ name: "payload", required: true }],
      outputs: [{ name: "result", required: true }],
      tags: ["processor"],
    });

    const irAfterNodes = await getIR();
    const [sourceId, targetId] = irAfterNodes.result!.ir.nodes.map((node) => node.id);

    await addEdge({
      edge: {
        from: { node: sourceId, port: "payload" },
        to: { node: targetId, port: "payload" },
      },
    });

    const firstValidation = await validateGraph();
    expect(firstValidation.ok).toBe(true);

    await setPortType({
      node: sourceId,
      direction: "output",
      port: "payload",
      type: { kind: "Scalar", name: "String" },
    });

    await setPortType({
      node: targetId,
      direction: "input",
      port: "payload",
      type: { kind: "Scalar", name: "String" },
    });

    const secondValidation = await validateGraph();
    expect(secondValidation.ok).toBe(true);

    const layoutResult = await planFileLayout({ policy: "ts" });
    expect(layoutResult.ok).toBe(true);

    const batches = await emitImplBatches();
    expect(batches.ok).toBe(true);
    expect(batches.result!.plan.batches.length).toBeGreaterThan(0);
  });
});
