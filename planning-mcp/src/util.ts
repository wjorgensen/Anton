/**
 * Utility functions for deterministic serialization and hashing
 */

import { createHash } from "crypto";

/**
 * Stable JSON stringification with sorted keys
 */
export function stableStringify(obj: any): string {
  if (obj === null) return "null";
  if (typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) {
    return "[" + obj.map(stableStringify).join(",") + "]";
  }

  const keys = Object.keys(obj).sort();
  const pairs = keys.map(k => `"${k}":${stableStringify(obj[k])}`);
  return "{" + pairs.join(",") + "}";
}

/**
 * Hash a JSON object with stable serialization
 */
export function hashJSON(obj: any): string {
  const content = stableStringify(obj);
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}
