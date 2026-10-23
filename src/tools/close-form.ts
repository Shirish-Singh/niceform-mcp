/**
 * close_form tool - Stop a live form from accepting responses
 */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { APIClient } from "../lib/api-client.js";
import { formatErrorResult, formatSuccessResult } from "../lib/errors.js";
import type { CloseFormResponse, ToolResult } from "../lib/types.js";
import {
  assertNoUnknownArgs,
  assertObjectArgs,
  assertValidApiResponse,
  isRecord,
  requireFormId,
} from "../lib/validation.js";

export const closeFormTool: Tool = {
  name: "close_form",
  description: `Close a live form so it stops accepting responses immediately (for example once the RSVP deadline has passed). Existing responses are kept and stay readable.

Only works on a published form; a draft cannot be closed (it returns a conflict error). To reopen, call publish_form again.`,
  inputSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      form_id: {
        type: "string",
        minLength: 1,
        maxLength: 128,
        description: "The form UUID or public id.",
      },
    },
    required: ["form_id"],
  },
  outputSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      formId: { type: "string" },
      status: { type: "string", const: "closed" },
      closedAt: { type: "string" },
    },
    required: ["formId", "status", "closedAt"],
  },
  annotations: {
    title: "Close form",
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: true,
    openWorldHint: true,
  },
};

export async function handleCloseForm(
  args: Record<string, unknown>,
  client: APIClient,
  signal?: AbortSignal,
): Promise<ToolResult> {
  try {
    assertObjectArgs(args);
    assertNoUnknownArgs(args, ["form_id"]);
    const formId = requireFormId(args);

    const response = await client.post<CloseFormResponse>(
      `/api/mcp/forms/${encodeURIComponent(formId)}/close`,
      undefined,
      { signal },
    );
    assertValidApiResponse(isRecord(response), "expected an object");
    assertValidApiResponse(
      typeof response.formId === "string",
      "missing formId",
    );
    assertValidApiResponse(response.status === "closed", "invalid status");
    assertValidApiResponse(
      typeof response.closedAt === "string",
      "missing closedAt",
    );

    return formatSuccessResult(
      `**Form closed.** It no longer accepts responses (closed at ${response.closedAt}). Existing responses are unchanged.`,
      {
        formId: response.formId,
        status: response.status,
        closedAt: response.closedAt,
      },
    );
  } catch (error) {
    return formatErrorResult(error);
  }
}
