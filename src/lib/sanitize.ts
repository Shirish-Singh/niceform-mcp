/**
 * Sanitization for untrusted, end-user-submitted data before it reaches an LLM.
 *
 * Strips characters that can hide or disguise instructions (control chars,
 * ANSI escapes, zero-width and bidi overrides) and bounds the size of what
 * a single tool call can return.
 */

export const MAX_STRING_LENGTH = 2000;
export const MAX_DEPTH = 8;
export const MAX_COLLECTION_ITEMS = 200;

// C0/C1 controls except tab (\x09), newline (\x0A) and carriage return (\x0D).
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g;
// eslint-disable-next-line no-control-regex
const ANSI_ESCAPES = /\x1B\[[0-?]*[ -/]*[@-~]/g;
// Zero-width, bidi embedding/override/isolate marks, word joiner, BOM.
const INVISIBLE_CHARS = /[​-‏‪-‮⁠-⁤⁦-⁩﻿]/g;

/** Strip hidden/control characters without length-capping (for structured text like CSV). */
export function stripHiddenChars(value: string): string {
  return value
    .replace(ANSI_ESCAPES, "")
    .replace(CONTROL_CHARS, "")
    .replace(INVISIBLE_CHARS, "");
}

export function sanitizeString(value: string): string {
  const cleaned = stripHiddenChars(value);
  if (cleaned.length <= MAX_STRING_LENGTH) return cleaned;
  return `${cleaned.slice(0, MAX_STRING_LENGTH)}…[truncated ${cleaned.length - MAX_STRING_LENGTH} chars]`;
}

/**
 * Recursively sanitize a JSON value: clean strings (including object keys),
 * cap nesting depth and collection sizes.
 */
export function sanitizeUntrusted(value: unknown, depth = 0): unknown {
  if (typeof value === "string") return sanitizeString(value);
  if (value === null || typeof value !== "object") return value;
  if (depth >= MAX_DEPTH) return "[omitted: nested too deeply]";

  if (Array.isArray(value)) {
    const items = value
      .slice(0, MAX_COLLECTION_ITEMS)
      .map((item) => sanitizeUntrusted(item, depth + 1));
    if (value.length > MAX_COLLECTION_ITEMS) {
      items.push(`[${value.length - MAX_COLLECTION_ITEMS} more items omitted]`);
    }
    return items;
  }

  const entries = Object.entries(value as Record<string, unknown>);
  const result: Record<string, unknown> = {};
  for (const [key, item] of entries.slice(0, MAX_COLLECTION_ITEMS)) {
    result[sanitizeString(key)] = sanitizeUntrusted(item, depth + 1);
  }
  if (entries.length > MAX_COLLECTION_ITEMS) {
    result["[omitted]"] = `${entries.length - MAX_COLLECTION_ITEMS} more fields`;
  }
  return result;
}
