/**
 * HTTP client for communicating with the niceform.ai API
 */

import {
  AuthenticationError,
  RateLimitError,
  NotFoundError,
  PermissionError,
  ConflictError,
  ValidationError,
  MCPError,
} from "./errors.js";
import type { ApiErrorResponse } from "./types.js";

const DEFAULT_BASE_URL = "https://www.niceform.ai";
const DEFAULT_TIMEOUT = 120000; // 2 minutes (form generation can take time)

export interface APIClientConfig {
  baseUrl?: string;
  apiKey?: string;
  timeout?: number;
}

export interface APIRequestOptions {
  signal?: AbortSignal;
}

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * Returns an error message when the base URL would expose the API key:
 * anything other than https, except plain http to a loopback host for local dev.
 */
function validateBaseUrl(baseUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    return "NICEFORM_API_URL is not a valid URL";
  }
  if (url.protocol === "https:") return null;
  if (url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname)) return null;
  return "NICEFORM_API_URL must use https:// (http:// is only allowed for localhost)";
}

class APIClient {
  private baseUrl: string;
  private apiKey: string;
  private timeout: number;
  private baseUrlError: string | null;

  constructor(config: APIClientConfig = {}) {
    this.baseUrl =
      config.baseUrl || process.env.NICEFORM_API_URL || DEFAULT_BASE_URL;
    this.apiKey = config.apiKey || process.env.NICEFORM_API_KEY || "";
    this.timeout = config.timeout || DEFAULT_TIMEOUT;

    // Remove trailing slash from base URL
    this.baseUrl = this.baseUrl.replace(/\/$/, "");
    this.baseUrlError = validateBaseUrl(this.baseUrl);
  }

  /**
   * Check if the client is configured with an API key
   */
  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  /**
   * Get default headers for API requests
   */
  private getHeaders(): Record<string, string> {
    // Never send the API key to a plaintext or malformed endpoint.
    if (this.baseUrlError) {
      throw new MCPError(this.baseUrlError, "CONFIGURATION_ERROR");
    }
    if (!this.apiKey) {
      throw new AuthenticationError(
        "NICEFORM_API_KEY environment variable is not set. " +
          "Please set your API key to use this MCP server.",
      );
    }

    return {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": "niceform-mcp-server/0.3.0",
    };
  }

  /**
   * Handle API response errors
   */
  private async handleResponse<T>(response: Response): Promise<T> {
    if (response.ok) {
      return response.json() as Promise<T>;
    }

    let errorData: ApiErrorResponse;
    try {
      errorData = (await response.json()) as ApiErrorResponse;
    } catch {
      errorData = { error: response.statusText };
    }

    const message = errorData.message || errorData.error || "Unknown error";

    switch (response.status) {
      case 401:
        throw new AuthenticationError(message);
      case 400:
        throw new ValidationError(message);
      case 403:
        throw new PermissionError(message);
      case 429:
        throw new RateLimitError(
          message,
          errorData.retryAfter ??
            this.parseRetryAfter(response.headers.get("Retry-After")),
        );
      case 404:
        throw new NotFoundError(message);
      case 409:
        throw new ConflictError(message);
      default:
        throw new MCPError(message, "API_ERROR", response.status);
    }
  }

  private parseRetryAfter(value: string | null): number | undefined {
    if (!value) return undefined;
    const seconds = Number(value);
    return Number.isFinite(seconds) && seconds >= 0
      ? Math.ceil(seconds)
      : undefined;
  }

  /**
   * Make a GET request
   */
  async get<T>(path: string, options: APIRequestOptions = {}): Promise<T> {
    const controller = new AbortController();
    let timedOut = false;
    const abortFromCaller = () => controller.abort();
    if (options.signal?.aborted) {
      controller.abort();
    } else {
      options.signal?.addEventListener("abort", abortFromCaller, {
        once: true,
      });
    }
    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: "GET",
        headers: this.getHeaders(),
        signal: controller.signal,
      });
      // Await so body parsing stays under the timeout and caller cancellation.
      return await this.handleResponse<T>(response);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw timedOut
          ? new MCPError("Request timed out", "TIMEOUT", 408)
          : new MCPError("Request cancelled", "CANCELLED", 499);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
      options.signal?.removeEventListener("abort", abortFromCaller);
    }
  }

  /**
   * Make a POST request
   */
  async post<T>(
    path: string,
    body?: unknown,
    options: APIRequestOptions = {},
  ): Promise<T> {
    const controller = new AbortController();
    let timedOut = false;
    const abortFromCaller = () => controller.abort();
    if (options.signal?.aborted) {
      controller.abort();
    } else {
      options.signal?.addEventListener("abort", abortFromCaller, {
        once: true,
      });
    }
    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: this.getHeaders(),
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      // Await so body parsing stays under the timeout and caller cancellation.
      return await this.handleResponse<T>(response);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw timedOut
          ? new MCPError("Request timed out", "TIMEOUT", 408)
          : new MCPError("Request cancelled", "CANCELLED", 499);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
      options.signal?.removeEventListener("abort", abortFromCaller);
    }
  }
}

// Export singleton instance
export const apiClient = new APIClient();

// Export class for testing/custom configuration
export { APIClient };
