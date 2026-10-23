/**
 * list_forms tool - Find the forms you own
 */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { APIClient } from "../lib/api-client.js";
import { formatErrorResult, formatSuccessResult } from "../lib/errors.js";
import type { ListFormsResponse, ToolResult } from "../lib/types.js";
import {
  assertNoUnknownArgs,
  assertObjectArgs,
  assertValidApiResponse,
  isRecord,
  optionalIntInRange,
  optionalString,
} from "../lib/validation.js";

const DEFAULT_LIMIT = 25;

export const listFormsTool: Tool = {
  name: "list_forms",
  description: `List the forms you own, newest first, with status (draft / live / closed), response count and public URL.

Use this to find a form_id you no longer have, or to check which forms are still live. Filter by name with \`query\`. Pass \`cursor\` from the previous call to fetch the next page; \`nextCursor\` is null on the last page.`,
  inputSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      query: {
        type: "string",
        minLength: 1,
        maxLength: 200,
        description: "Only forms whose name contains this text.",
      },
      limit: {
        type: "integer",
        minimum: 1,
        maximum: 100,
        default: DEFAULT_LIMIT,
        description: "Page size, 1-100. Defaults to 25.",
      },
      cursor: {
        type: "string",
        minLength: 1,
        maxLength: 2048,
        description:
          "Pagination cursor from a previous call. Omit for the first page.",
      },
    },
  },
  outputSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      forms: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            formId: { type: "string" },
            publicId: { type: "string" },
            name: { type: "string" },
            status: { type: "string", enum: ["draft", "live", "closed"] },
            responseCount: { type: "integer", minimum: 0 },
            publicUrl: { type: ["string", "null"] },
            closeAt: { type: ["string", "null"] },
            createdAt: { type: "string" },
          },
          required: [
            "formId",
            "publicId",
            "name",
            "status",
            "responseCount",
            "publicUrl",
            "closeAt",
            "createdAt",
          ],
        },
      },
      nextCursor: { type: ["string", "null"] },
    },
    required: ["forms", "nextCursor"],
  },
  annotations: {
    title: "List forms",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
};

export async function handleListForms(
  args: Record<string, unknown>,
  client: APIClient,
  signal?: AbortSignal,
): Promise<ToolResult> {
  try {
    assertObjectArgs(args);
    assertNoUnknownArgs(args, ["query", "limit", "cursor"]);
    const query = optionalString(args, "query", {
      minLength: 1,
      maxLength: 200,
    });
    const limit = optionalIntInRange(args, "limit", 1, 100) ?? DEFAULT_LIMIT;
    const cursor = optionalString(args, "cursor", {
      minLength: 1,
      maxLength: 2048,
    });

    const params = new URLSearchParams();
    if (query) params.set("q", query);
    params.set("limit", String(limit));
    if (cursor) params.set("cursor", cursor);

    const response = await client.get<ListFormsResponse>(
      `/api/mcp/forms?${params.toString()}`,
      { signal },
    );
    assertValidApiResponse(isRecord(response), "expected an object");
    assertValidApiResponse(Array.isArray(response.forms), "missing forms");
    assertValidApiResponse(
      response.nextCursor === null || typeof response.nextCursor === "string",
      "invalid nextCursor",
    );
    for (const f of response.forms) {
      assertValidApiResponse(
        isRecord(f) &&
          typeof f.formId === "string" &&
          typeof f.name === "string" &&
          typeof f.status === "string",
        "invalid form item",
      );
    }

    const rows = response.forms
      .map(
        (f) =>
          `- **${f.name}** (\`${f.formId}\`) — ${f.status}, ${f.responseCount} response${f.responseCount === 1 ? "" : "s"}${f.publicUrl ? `, ${f.publicUrl}` : ""}${f.closeAt ? `, closes ${f.closeAt}` : ""}`,
      )
      .join("\n");
    const text = response.forms.length
      ? `**${response.forms.length} form${response.forms.length === 1 ? "" : "s"}**\n\n${rows}${response.nextCursor ? `\n\n**More available.** Next cursor: \`${response.nextCursor}\`` : "\n\n*(End of results)*"}`
      : "**No forms found.**";

    return formatSuccessResult(text, {
      forms: response.forms,
      nextCursor: response.nextCursor,
    });
  } catch (error) {
    return formatErrorResult(error);
  }
}
