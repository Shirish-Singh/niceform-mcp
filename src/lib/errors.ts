/**
 * Error handling utilities for the MCP server
 */

import type { ToolResult } from "./types.js";

export class MCPError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = "MCPError";
  }
}

export class AuthenticationError extends MCPError {
  constructor(message: string = "Invalid or missing API key") {
    super(message, "AUTHENTICATION_ERROR", 401);
  }
}

export class RateLimitError extends MCPError {
  constructor(
    message: string = "Rate limit exceeded",
    public readonly retryAfter?: number,
  ) {
    super(message, "RATE_LIMIT_ERROR", 429);
  }
}

export class NotFoundError extends MCPError {
  constructor(message: string = "Resource not found") {
    super(message, "NOT_FOUND", 404);
  }
}

export class PermissionError extends MCPError {
  constructor(message: string = "Insufficient permissions") {
    super(message, "PERMISSION_ERROR", 403);
  }
}

export class ConflictError extends MCPError {
  constructor(message: string = "Request conflicts with existing state") {
    super(message, "CONFLICT", 409);
  }
}

export class ValidationError extends MCPError {
  constructor(message: string) {
    super(message, "VALIDATION_ERROR", 400);
  }
}

/**
 * Format an error into an MCP tool result
 */
export function formatErrorResult(error: unknown): ToolResult {
  let message: string;

  if (error instanceof MCPError) {
    message = `Error (${error.code}): ${error.message}`;
    if (error instanceof RateLimitError && error.retryAfter) {
      message += `\n\nRetry after ${error.retryAfter} seconds.`;
    }
  } else if (error instanceof Error) {
    message = `Error: ${error.message}`;
  } else {
    message = "An unknown error occurred";
  }

  return {
    content: [{ type: "text", text: message }],
    isError: true,
  };
}

/**
 * Format a success message into an MCP tool result
 */
export function formatSuccessResult(
  text: string,
  structuredContent?: Record<string, unknown>,
): ToolResult {
  return {
    content: [{ type: "text", text }],
    ...(structuredContent ? { structuredContent } : {}),
  };
}
