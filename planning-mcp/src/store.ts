/**
 * File-backed storage operations for RPGIR
 * No global state - all operations read from and write to anton-plan.json
 */

import { RPGIR } from "./ir.ts";
import * as fs from "fs";
import * as dotenv from "dotenv";
import * as path from "path";
import { ERROR_CODES } from "./errors.ts";
import type { ToolResponse } from "./errors.ts";

dotenv.config();

// Simple in-memory request cache for idempotency within a single process
const requestCache = new Map<string, ToolResponse>();

/**
 * Get the path to the anton-plan.json file from environment variable
 */
export function getAntonPlanPath(): string {
  const planPath = process.env.ANTON_PLAN_PATH;

  if (!planPath || planPath.trim() === "") {
    throw new Error(
      "ANTON_PLAN_PATH not set in .env file. " +
      "This should point to an existing anton-plan.json file. " +
      "Use start_session to create a new project first."
    );
  }

  return planPath;
}

/**
 * Load IR from the anton-plan.json file
 */
export function loadIR(): RPGIR {
  const planPath = getAntonPlanPath();
  return loadIRFromPath(planPath);
}

function loadIRFromPath(planPath: string): RPGIR {
  ensurePlanExists(planPath);

  try {
    const content = fs.readFileSync(planPath, "utf-8");
    const ir = JSON.parse(content) as RPGIR;
    if (typeof ir.rev !== "number" || ir.rev < 1 || !Number.isInteger(ir.rev)) {
      ir.rev = 1;
    }
    return ir;
  } catch (error) {
    throw new Error(`Failed to read or parse anton-plan.json: ${error}`);
  }
}

/**
 * Save IR to the anton-plan.json file
 */
export function saveIR(
  ir: RPGIR,
  options: {
    expectedRev?: number;
    filePath?: string;
    allowCreate?: boolean;
  } = {}
): void {
  const planPath = options.filePath || getAntonPlanPath();
  const allowCreate = options.allowCreate ?? false;
  const expectedRev = options.expectedRev;

  const planDir = path.dirname(planPath);
  const tempPath = `${planPath}.${process.pid}.${Date.now()}.tmp`;
  const lockPath = `${planPath}.lock`;

  const exists = fs.existsSync(planPath);
  if (!exists && !allowCreate) {
    throw new Error(
      `Anton plan file not found at ${planPath}. ` +
      "Use start_session to create a project first."
    );
  }

  const currentRev = exists ? readCurrentRev(planPath) : 0;

  if (expectedRev !== undefined && currentRev !== expectedRev) {
    const err = new Error(
      `Stale IR revision. Expected ${expectedRev}, found ${currentRev}.`
    ) as NodeJS.ErrnoException;
    err.code = ERROR_CODES.STALE_REV;
    throw err;
  }

  let lockFd: number | null = null;
  try {
    lockFd = acquireLock(lockPath);

    const serialized = JSON.stringify(ir, null, 2);
    const fd = fs.openSync(tempPath, "w");
    try {
      fs.writeSync(fd, serialized);
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }

    const dirFd = fs.openSync(planDir, "r");
    try {
      fs.fsyncSync(dirFd);
    } finally {
      fs.closeSync(dirFd);
    }

    fs.renameSync(tempPath, planPath);

    const dirFdPost = fs.openSync(planDir, "r");
    try {
      fs.fsyncSync(dirFdPost);
    } finally {
      fs.closeSync(dirFdPost);
    }
  } catch (error) {
    if (fs.existsSync(tempPath)) {
      try {
        fs.unlinkSync(tempPath);
      } catch {
        // ignore cleanup errors
      }
    }
    if (error && typeof error === "object") {
      const err = error as NodeJS.ErrnoException;
      err.message = `Failed to write anton-plan.json: ${err.message ?? String(error)}`;
      throw err;
    }
    throw new Error(`Failed to write anton-plan.json: ${String(error)}`);
  } finally {
    if (lockFd !== null) {
      releaseLock(lockPath, lockFd);
    }
  }
}

/**
 * Check if a request ID exists in cache
 */
export function hasRequestCache(requestId: string): boolean {
  return requestCache.has(requestId);
}

/**
 * Get cached response for a request ID
 */
export function getRequestCache(requestId: string): ToolResponse | undefined {
  return requestCache.get(requestId);
}

/**
 * Set cached response for a request ID
 */
export function setRequestCache(requestId: string, response: ToolResponse): void {
  requestCache.set(requestId, response);
}

/**
 * Clear the request cache (useful for testing)
 */
export function clearRequestCache(): void {
  requestCache.clear();
}

function ensurePlanExists(planPath: string) {
  if (!fs.existsSync(planPath)) {
    throw new Error(
      `Anton plan file not found at ${planPath}. ` +
      "Ensure ANTON_PLAN_PATH points to a valid anton-plan.json file created via start_session."
    );
  }
}

function readCurrentRev(planPath: string): number {
  try {
    const content = fs.readFileSync(planPath, "utf-8");
    const parsed = JSON.parse(content) as Partial<RPGIR>;
    const rev = typeof parsed.rev === "number" ? parsed.rev : 0;
    return Number.isInteger(rev) && rev >= 0 ? rev : 0;
  } catch {
    return 0;
  }
}

function acquireLock(lockPath: string): number {
  try {
    return fs.openSync(lockPath, "wx");
  } catch (error: any) {
    if (error?.code === "EEXIST") {
      const err = new Error(
        `Plan file is locked by another process (${lockPath}).`
      ) as NodeJS.ErrnoException;
      err.code = ERROR_CODES.LOCKED;
      throw err;
    }
    throw error;
  }
}

function releaseLock(lockPath: string, fd: number) {
  try {
    fs.closeSync(fd);
  } finally {
    if (fs.existsSync(lockPath)) {
      try {
        fs.unlinkSync(lockPath);
      } catch {
        // ignore unlock errors
      }
    }
  }
}
