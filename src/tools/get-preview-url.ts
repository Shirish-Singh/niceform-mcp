/**
 * get_preview_url tool - Get the preview URL for a form draft
 */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { APIClient } from "../lib/api-client.js";
import { formatErrorResult, formatSuccessResult } from "../lib/errors.js";
import type { PreviewUrlResponse, ToolResult } from "../lib/types.js";
import {
  assertNoUnknownArgs,
  assertObjectArgs,
  assertValidApiResponse,
  isRecord,
  requireFormId,
} from "../lib/validation.js";

/**
 * Tool definition for get_preview_url
 */
export const getPreviewUrlTool: Tool = {
  name: "get_preview_url",
  description: `Get the preview URL for a form draft to see how it looks before publishing.

Use this to:
- View a form you just created
- Check the current state of a draft
- Get form details (field count, steps, status)

The preview URL shows exactly how the form will appear to users once published.`,
  inputSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      form_id: {
        type: "string",
        minLength: 1,
        maxLength: 128,
        description:
          "The form UUID or public id.",
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
      status: { type: "string", enum: ["draft", "published"] },
      previewUrl: { type: "string", format: "uri" },
      fieldCount: { type: "integer", minimum: 0 },
      stepCount: { type: "integer", minimum: 1 },
    },
    required: [
      "formId",
      "publicId",
      "name",
      "status",
      "previewUrl",
      "fieldCount",
      "stepCount",
    ],
  },
  annotations: {
    title: "Get form preview",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
};

/**
 * Handle get_preview_url tool execution
 */
export async function handleGetPreviewUrl(
  args: Record<string, unknown>,
  client: APIClient,
  signal?: AbortSignal,
): Promise<ToolResult> {
  try {
    assertObjectArgs(args);
    assertNoUnknownArgs(args, ["form_id"]);
    const formId = requireFormId(args);

    const response = await client.get<PreviewUrlResponse>(
      `/api/mcp/forms/${encodeURIComponent(formId)}/preview`,
      { signal },
    );
    assertValidApiResponse(isRecord(response), "expected an object");
    assertValidApiResponse(
      typeof response.formId === "string",
      "missing formId",
    );
    assertValidApiResponse(
      typeof response.publicId === "string",
      "missing publicId",
    );
    assertValidApiResponse(typeof response.name === "string", "missing name");
    assertValidApiResponse(
      response.status === "draft" || response.status === "published",
      "invalid status",
    );
    assertValidApiResponse(
      typeof response.previewUrl === "string",
      "missing previewUrl",
    );
    assertValidApiResponse(
      Number.isInteger(response.fieldCount) && response.fieldCount >= 0,
      "invalid fieldCount",
    );
    assertValidApiResponse(
      Number.isInteger(response.stepCount) && response.stepCount >= 1,
      "invalid stepCount",
    );

    const statusEmoji = response.status === "published" ? "🟢" : "🟡";
    const statusText =
      response.status === "published"
        ? "Published (Live)"
        : "Draft (Not Public)";

    const resultText = `**Form Preview**

**Preview URL:** ${response.previewUrl}

---

**Form Details:**
- **Name:** ${response.name}
- **Form ID:** \`${response.formId}\`
- **Public ID:** \`${response.publicId}\`
- **Status:** ${statusEmoji} ${statusText}
- **Fields:** ${response.fieldCount}
- **Steps:** ${response.stepCount}

---

${
  response.status === "draft"
    ? `**Note:** This form is a draft and not yet accepting responses.\nUse \`publish_form\` with form_id \`${response.formId}\` to make it live.`
    : `**This form is live and accepting responses.**`
}`;

    return formatSuccessResult(resultText, {
      formId: response.formId,
      publicId: response.publicId,
      name: response.name,
      status: response.status,
      previewUrl: response.previewUrl,
      fieldCount: response.fieldCount,
      stepCount: response.stepCount,
    });
  } catch (error) {
    return formatErrorResult(error);
  }
}
