/**
 * publish_form tool - Publish a form draft to make it publicly accessible
 */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { APIClient } from "../lib/api-client.js";
import { formatErrorResult, formatSuccessResult } from "../lib/errors.js";
import type { PublishFormResponse, ToolResult } from "../lib/types.js";
import {
  assertNoUnknownArgs,
  assertObjectArgs,
  assertValidApiResponse,
  isRecord,
  optionalIntInRange,
  optionalIsoTimestamp,
  optionalString,
  requireFormId,
} from "../lib/validation.js";

/**
 * Tool definition for publish_form
 */
export const publishFormTool: Tool = {
  name: "publish_form",
  description: `Publish a form draft to make it publicly accessible for responses.

After publishing:
- The form will be live and accepting responses
- A public URL will be generated for sharing
- Usage limits will apply based on your plan
- The form can be shared via link, QR code, or embedded

You can set a deadline with \`close_at\` and/or a cap with \`response_limit\`; the form stops accepting responses when either is reached. Calling publish_form again on a published or closed form updates these settings (pass null to clear one) and reopens a closed form. Share the returned \`publicUrl\` with respondents yourself; niceform does not send it anywhere.

**Important:** Publishing a form counts toward your plan's form limit.`,
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
      name: {
        type: "string",
        minLength: 1,
        maxLength: 100,
        description:
          "Optional: Override the form name before publishing. If not provided, uses the AI-generated name.",
      },
      close_at: {
        type: ["string", "null"],
        description:
          "ISO 8601 timestamp with offset (e.g. 2026-12-01T17:00:00Z) after which the form stops accepting responses. null clears it.",
      },
      response_limit: {
        type: ["integer", "null"],
        minimum: 1,
        maximum: 100000,
        description:
          "Maximum number of responses to accept. null removes the limit.",
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
      publicUrl: { type: "string", format: "uri" },
      status: { type: "string", const: "published" },
      formStatus: { type: "string", enum: ["draft", "live", "closed"] },
      closeAt: { type: ["string", "null"] },
      responseLimit: { type: ["integer", "null"] },
    },
    required: ["formId", "publicId", "name", "publicUrl", "status"],
  },
  annotations: {
    title: "Publish form",
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: true,
    openWorldHint: true,
  },
};

/**
 * Handle publish_form tool execution
 */
export async function handlePublishForm(
  args: Record<string, unknown>,
  client: APIClient,
  signal?: AbortSignal,
): Promise<ToolResult> {
  try {
    assertObjectArgs(args);
    assertNoUnknownArgs(args, ["form_id", "name", "close_at", "response_limit"]);
    const formId = requireFormId(args);
    const name = optionalString(args, "name", { minLength: 1, maxLength: 100 });

    const closeAt = optionalIsoTimestamp(args, "close_at", true);
    const responseLimit = optionalIntInRange(
      args,
      "response_limit",
      1,
      100000,
      true,
    );
    const body = {
      ...(name ? { name } : {}),
      ...(closeAt !== undefined ? { closeAt } : {}),
      ...(responseLimit !== undefined ? { responseLimit } : {}),
    };

    const response = await client.post<PublishFormResponse>(
      `/api/mcp/forms/${encodeURIComponent(formId)}/publish`,
      Object.keys(body).length ? body : undefined,
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
      typeof response.publicUrl === "string",
      "missing publicUrl",
    );
    assertValidApiResponse(response.status === "published", "invalid status");

    const resultText = `**Form published successfully!** 🎉

**Public URL:** ${response.publicUrl}

---

**Form Details:**
- **Name:** ${response.name}
- **Form ID:** \`${response.formId}\`
- **Public ID:** \`${response.publicId}\`
- **Status:** 🟢 Published (${response.formStatus ?? "live"})${response.closeAt ? `\n- **Closes:** ${response.closeAt}` : ""}${response.responseLimit ? `\n- **Response limit:** ${response.responseLimit}` : ""}

---

**Share your form:**
- Copy and share the public URL above
- The form is now accepting responses
- View submissions in your niceform.ai dashboard

**Tip:** You can track response metrics and export data from the dashboard.`;

    return formatSuccessResult(resultText, {
      formId: response.formId,
      publicId: response.publicId,
      name: response.name,
      publicUrl: response.publicUrl,
      status: response.status,
      ...(response.formStatus ? { formStatus: response.formStatus } : {}),
      ...(response.closeAt !== undefined ? { closeAt: response.closeAt } : {}),
      ...(response.responseLimit !== undefined
        ? { responseLimit: response.responseLimit }
        : {}),
    });
  } catch (error) {
    return formatErrorResult(error);
  }
}
