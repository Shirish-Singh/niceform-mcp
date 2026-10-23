import { MCPError, ValidationError } from "./errors.js";

export const FORM_ID_MAX_LENGTH = 128;

export function assertObjectArgs(
  args: unknown,
): asserts args is Record<string, unknown> {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new ValidationError("Tool arguments must be an object");
  }
}

export function assertNoUnknownArgs(
  args: Record<string, unknown>,
  allowed: readonly string[],
): void {
  const unknown = Object.keys(args).filter((key) => !allowed.includes(key));
  if (unknown.length > 0) {
    throw new ValidationError(
      `Unknown parameter${unknown.length === 1 ? "" : "s"}: ${unknown.join(", ")}`,
    );
  }
}

export function requireNonEmptyString(
  args: Record<string, unknown>,
  key: string,
  options: { minLength?: number; maxLength?: number } = {},
): string {
  const value = args[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ValidationError(`Missing or invalid required parameter: ${key}`);
  }

  const trimmed = value.trim();
  if (options.minLength !== undefined && trimmed.length < options.minLength) {
    throw new ValidationError(
      `${key} must be at least ${options.minLength} characters`,
    );
  }
  if (options.maxLength !== undefined && trimmed.length > options.maxLength) {
    throw new ValidationError(
      `${key} must be at most ${options.maxLength} characters`,
    );
  }

  return trimmed;
}

export function optionalString(
  args: Record<string, unknown>,
  key: string,
  options: { minLength?: number; maxLength?: number } = {},
): string | undefined {
  if (args[key] === undefined) return undefined;
  if (typeof args[key] !== "string") {
    throw new ValidationError(`${key} must be a string`);
  }

  const value = (args[key] as string).trim();
  if (options.minLength !== undefined && value.length < options.minLength) {
    throw new ValidationError(
      `${key} must be at least ${options.minLength} characters`,
    );
  }
  if (options.maxLength !== undefined && value.length > options.maxLength) {
    throw new ValidationError(
      `${key} must be at most ${options.maxLength} characters`,
    );
  }

  return value;
}

export function requireFormId(args: Record<string, unknown>): string {
  return requireNonEmptyString(args, "form_id", {
    maxLength: FORM_ID_MAX_LENGTH,
  });
}

export function assertValidApiResponse(
  condition: unknown,
  detail: string,
): asserts condition {
  if (!condition) {
    throw new MCPError(
      `The niceform API returned an invalid response (${detail})`,
      "UPSTREAM_RESPONSE_ERROR",
      502,
    );
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

const ISO_WITH_OFFSET =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

/** ISO 8601 timestamp with an explicit offset (or Z). `null` passes through only when allowed. */
export function optionalIsoTimestamp(
  args: Record<string, unknown>,
  key: string,
  allowNull = false,
): string | null | undefined {
  const value = args[key];
  if (value === undefined) return undefined;
  if (value === null && allowNull) return null;
  if (
    typeof value !== "string" ||
    !ISO_WITH_OFFSET.test(value) ||
    Number.isNaN(Date.parse(value))
  ) {
    throw new ValidationError(
      `${key} must be an ISO 8601 timestamp with a timezone offset, e.g. 2026-12-01T17:00:00Z${allowNull ? " (or null to clear)" : ""}`,
    );
  }
  return value;
}

export function optionalIntInRange(
  args: Record<string, unknown>,
  key: string,
  min: number,
  max: number,
  allowNull = false,
): number | null | undefined {
  const value = args[key];
  if (value === undefined) return undefined;
  if (value === null && allowNull) return null;
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < min ||
    value > max
  ) {
    throw new ValidationError(
      `${key} must be an integer between ${min} and ${max}${allowNull ? " (or null to clear)" : ""}`,
    );
  }
  return value;
}

export function optionalBoolean(
  args: Record<string, unknown>,
  key: string,
): boolean | undefined {
  const value = args[key];
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") {
    throw new ValidationError(`${key} must be a boolean`);
  }
  return value;
}
