/**
 * get_form tool - Inspect a form's settings and fields
 */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { APIClient } from "../lib/api-client.js";
import { formatErrorResult, formatSuccessResult } from "../lib/errors.js";
import type { GetFormResponse, ToolResult } from "../lib/types.js";
import {
  assertNoUnknownArgs,
  assertObjectArgs,
  assertValidApiResponse,
  isRecord,
  requireFormId,
} from "../lib/validation.js";

export const getFormTool: Tool = {
  name: "get_form",
  description: `Get a form's current status (draft / live / closed), public URL, close time, response limit and its fields (key, label, type, required, options).

Use this to see what questions a form asks, or to map field keys in list_form_responses output to questions. Does not return responses.`,
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
      publicId: { type: "string" },
      name: { type: "string" },
      status: { type: "string", enum: ["draft", "live", "closed"] },
      publicUrl: { type: ["string", "null"] },
      closeAt: { type: ["string", "null"] },
      responseLimit: { type: ["integer", "null"] },
      oneResponsePerDevice: { type: "boolean" },
      fields: {
        type: "array",
        items: {
          type: "object",
          properties: {
            key: { type: "string" },
            label: { type: "string" },
            type: { type: "string" },
            widget: { type: "string" },
            required: { type: "boolean" },
            options: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  value: { type: "string" },
                  label: { type: "string" },
                },
                required: ["value", "label"],
              },
            },
          },
          required: ["key", "label", "type", "required"],
        },
      },
    },
    required: [
      "formId",
      "publicId",
      "name",
      "status",
      "publicUrl",
      "closeAt",
      "responseLimit",
      "oneResponsePerDevice",
      "fields",
    ],
  },
  annotations: {
    title: "Get form",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
};

export async function handleGetForm(
  args: Record<string, unknown>,
  client: APIClient,
  signal?: AbortSignal,
): Promise<ToolResult> {
  try {
    assertObjectArgs(args);
    assertNoUnknownArgs(args, ["form_id"]);
    const formId = requireFormId(args);

    const r = await client.get<GetFormResponse>(
      `/api/mcp/forms/${encodeURIComponent(formId)}`,
      { signal },
    );
    assertValidApiResponse(isRecord(r), "expected an object");
    assertValidApiResponse(typeof r.formId === "string", "missing formId");
    assertValidApiResponse(typeof r.name === "string", "missing name");
    assertValidApiResponse(typeof r.status === "string", "missing status");
    assertValidApiResponse(Array.isArray(r.fields), "missing fields");

    const fieldLines = r.fields
      .map(
        (f) =>
          `- \`${f.key}\` — ${f.label} (${f.type}${f.required ? ", required" : ""})${f.options?.length ? `: ${f.options.map((o) => o.label).join(" / ")}` : ""}`,
      )
      .join("\n");
    const text = `**${r.name}** (\`${r.formId}\`) — ${r.status}
${r.publicUrl ? `**Public URL:** ${r.publicUrl}\n` : ""}**Closes:** ${r.closeAt ?? "no close time"} | **Response limit:** ${r.responseLimit ?? "none"} | **One response per device:** ${r.oneResponsePerDevice ? "yes" : "no"}

**Fields:**
${fieldLines}`;

    return formatSuccessResult(text, {
      formId: r.formId,
      publicId: r.publicId,
      name: r.name,
      status: r.status,
      publicUrl: r.publicUrl ?? null,
      closeAt: r.closeAt ?? null,
      responseLimit: r.responseLimit ?? null,
      oneResponsePerDevice: r.oneResponsePerDevice,
      fields: r.fields,
    });
  } catch (error) {
    return formatErrorResult(error);
  }
}
