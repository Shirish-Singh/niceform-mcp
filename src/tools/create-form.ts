/**
 * create_form tool - Generate a new form from a natural language description
 */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { APIClient } from "../lib/api-client.js";
import { formatErrorResult, formatSuccessResult } from "../lib/errors.js";
import {
  FIELD_TYPES,
  type CreateFormResponse,
  type FieldSpec,
  type PublishFormResponse,
  type ToolResult,
} from "../lib/types.js";
import { ValidationError } from "../lib/errors.js";
import {
  assertNoUnknownArgs,
  assertObjectArgs,
  optionalBoolean,
  optionalIntInRange,
  optionalIsoTimestamp,
  optionalString,
  requireNonEmptyString,
  assertValidApiResponse,
  isRecord,
} from "../lib/validation.js";

const STYLE_PREFERENCES = [
  "modern",
  "minimal",
  "colorful",
  "professional",
  "default",
] as const;

/**
 * Tool definition for create_form
 */
export const createFormTool: Tool = {
  name: "create_form",
  description: `Create a new form. Provide exactly one of:
- \`fields\` (with \`name\`): use this when you already know the questions. It is instant and exact.
- \`description\`: a natural-language brief; niceform's AI designs the form (takes 10-60 seconds).

Set \`publish: true\` to make the form live right away, optionally with \`close_at\` (deadline) and \`response_limit\`. Without it the form is a draft: use get_preview_url to look at it, then publish_form.

niceform does not send the form to anyone. Once published, share the returned \`publicUrl\` with respondents yourself (email, chat, etc.). To check on results later, call summarize_responses for totals, or list_form_responses with \`since\` (the previous \`latestSubmittedAt\`) for new answers. Call close_form when collection is over.

Examples:
- fields: [{label: "Name", type: "text", required: true}, {label: "Attending?", type: "radio", options: ["Yes", "No"]}], name: "Party RSVP"
- description: "Create a customer feedback form for a restaurant with rating scales and comments"`,
  inputSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      description: {
        type: "string",
        minLength: 10,
        maxLength: 5000,
        description:
          "Natural language brief for niceform to design the form (10-60 s). Mutually exclusive with fields.",
      },
      fields: {
        type: "array",
        minItems: 1,
        maxItems: 50,
        description:
          "Exact questions, in order. Mutually exclusive with description; requires name.",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            label: { type: "string", minLength: 1, maxLength: 200 },
            type: { type: "string", enum: [...FIELD_TYPES] },
            required: { type: "boolean", default: false },
            options: {
              type: "array",
              minItems: 1,
              maxItems: 50,
              items: { type: "string", minLength: 1, maxLength: 200 },
              description:
                "Required for select, radio and checkboxes (unique values); not allowed for other types.",
            },
          },
          required: ["label", "type"],
        },
      },
      name: {
        type: "string",
        minLength: 1,
        maxLength: 100,
        description: "Form name. Required with fields.",
      },
      publish: {
        type: "boolean",
        default: false,
        description: "Publish immediately after creating.",
      },
      close_at: {
        type: "string",
        description:
          "ISO 8601 timestamp with offset after which the form stops accepting responses. Requires publish: true.",
      },
      response_limit: {
        type: "integer",
        minimum: 1,
        maximum: 100000,
        description:
          "Maximum responses to accept. Requires publish: true.",
      },
      one_response_per_device: {
        type: "boolean",
        default: false,
        description: "Allow only one response per device.",
      },
      style_preference: {
        type: "string",
        enum: ["modern", "minimal", "colorful", "professional", "default"],
        description:
          "Optional style preference for the form appearance. Default uses organization branding.",
        default: "default",
      },
      idempotency_key: {
        type: "string",
        minLength: 8,
        maxLength: 128,
        description:
          "A caller-generated unique key (preferably a UUID) for this intended form creation. Reuse the same key when retrying the same request.",
      },
    },
    required: ["idempotency_key"],
  },
  outputSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      formId: { type: "string" },
      publicId: { type: "string" },
      idempotencyKey: { type: "string" },
      name: { type: "string" },
      fieldCount: { type: "integer", minimum: 0 },
      stepCount: { type: "integer", minimum: 1 },
      previewUrl: { type: "string", format: "uri" },
      status: { type: "string", enum: ["draft", "published"] },
      publicUrl: {
        type: "string",
        format: "uri",
        description: "Present when published; share this with respondents.",
      },
      closeAt: { type: ["string", "null"] },
      responseLimit: { type: ["integer", "null"] },
    },
    required: [
      "formId",
      "publicId",
      "idempotencyKey",
      "name",
      "fieldCount",
      "stepCount",
      "previewUrl",
      "status",
    ],
  },
  annotations: {
    title: "Create form draft",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
};

const SELECTABLE = ["select", "radio", "checkboxes"];

function parseFields(value: unknown): FieldSpec[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 50) {
    throw new ValidationError("fields must be an array of 1-50 items");
  }
  return value.map((raw, i) => {
    const at = `fields[${i}]`;
    assertObjectArgs(raw);
    assertNoUnknownArgs(raw, ["label", "type", "required", "options"]);
    const label = requireNonEmptyString(raw, "label", { maxLength: 200 });
    if (!FIELD_TYPES.includes(raw.type as (typeof FIELD_TYPES)[number])) {
      throw new ValidationError(
        `${at}.type must be one of: ${FIELD_TYPES.join(", ")}`,
      );
    }
    const type = raw.type as FieldSpec["type"];
    const required = optionalBoolean(raw, "required");
    const spec: FieldSpec = { label, type };
    if (required !== undefined) spec.required = required;
    if (SELECTABLE.includes(type)) {
      const o = raw.options;
      if (
        !Array.isArray(o) ||
        o.length < 1 ||
        o.length > 50 ||
        o.some((x) => typeof x !== "string" || x.trim() === "" || x.length > 200)
      ) {
        throw new ValidationError(
          `${at}.options must be 1-50 non-empty strings for type ${type}`,
        );
      }
      if (new Set(o).size !== o.length) {
        throw new ValidationError(`${at}.options must be unique`);
      }
      spec.options = o as string[];
    } else if (raw.options !== undefined) {
      throw new ValidationError(
        `${at}.options is only allowed for select, radio and checkboxes`,
      );
    }
    return spec;
  });
}

/**
 * Handle create_form tool execution
 */
export async function handleCreateForm(
  args: Record<string, unknown>,
  client: APIClient,
  signal?: AbortSignal,
): Promise<ToolResult> {
  try {
    assertObjectArgs(args);
    assertNoUnknownArgs(args, [
      "description",
      "fields",
      "name",
      "publish",
      "close_at",
      "response_limit",
      "one_response_per_device",
      "style_preference",
      "idempotency_key",
    ]);
    if ((args.description === undefined) === (args.fields === undefined)) {
      throw new ValidationError(
        "Provide exactly one of description or fields",
      );
    }
    const description =
      args.description === undefined
        ? undefined
        : requireNonEmptyString(args, "description", {
            minLength: 10,
            maxLength: 5000,
          });
    const fields =
      args.fields === undefined ? undefined : parseFields(args.fields);
    const name = optionalString(args, "name", { minLength: 1, maxLength: 100 });
    if (fields && !name) {
      throw new ValidationError("name is required when fields is provided");
    }
    const publish = optionalBoolean(args, "publish") ?? false;
    const closeAt = optionalIsoTimestamp(args, "close_at") as string | undefined;
    const responseLimit = optionalIntInRange(
      args,
      "response_limit",
      1,
      100000,
    ) as number | undefined;
    if (!publish && (closeAt !== undefined || responseLimit !== undefined)) {
      throw new ValidationError(
        "close_at and response_limit require publish: true. Create the form as a draft, then call publish_form with close_at / response_limit.",
      );
    }
    const oneResponsePerDevice = optionalBoolean(
      args,
      "one_response_per_device",
    );
    const stylePreference = optionalString(args, "style_preference");
    const idempotencyKey = requireNonEmptyString(args, "idempotency_key", {
      minLength: 8,
      maxLength: 128,
    });
    if (
      stylePreference !== undefined &&
      !STYLE_PREFERENCES.includes(
        stylePreference as (typeof STYLE_PREFERENCES)[number],
      )
    ) {
      return formatErrorResult(
        new Error(
          `style_preference must be one of: ${STYLE_PREFERENCES.join(", ")}`,
        ),
      );
    }

    const response = await client.post<CreateFormResponse>(
      "/api/mcp/forms",
      {
        ...(fields ? { fields, name } : { prompt: description }),
        stylePreference: stylePreference || "default",
        idempotencyKey,
        ...(oneResponsePerDevice !== undefined ? { oneResponsePerDevice } : {}),
      },
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
    assertValidApiResponse(
      response.idempotencyKey === idempotencyKey,
      "idempotency key mismatch",
    );
    assertValidApiResponse(typeof response.name === "string", "missing name");
    assertValidApiResponse(
      Number.isInteger(response.fieldCount) && response.fieldCount >= 0,
      "invalid fieldCount",
    );
    assertValidApiResponse(
      Number.isInteger(response.stepCount) && response.stepCount >= 1,
      "invalid stepCount",
    );
    assertValidApiResponse(
      typeof response.previewUrl === "string",
      "missing previewUrl",
    );
    assertValidApiResponse(
      response.status === "draft" || response.status === "published",
      "invalid status",
    );

    let published: PublishFormResponse | undefined;
    if (publish && response.status === "draft") {
      try {
        published = await client.post<PublishFormResponse>(
          `/api/mcp/forms/${encodeURIComponent(response.formId)}/publish`,
          {
            ...(closeAt !== undefined ? { closeAt } : {}),
            ...(responseLimit !== undefined ? { responseLimit } : {}),
          },
          { signal },
        );
        assertValidApiResponse(isRecord(published), "expected an object");
        assertValidApiResponse(
          typeof published.publicUrl === "string",
          "missing publicUrl",
        );
      } catch (error) {
        if (error instanceof Error) {
          error.message = `Form ${response.formId} was created as a draft but publishing failed: ${error.message}. Call publish_form with this form_id to retry.`;
        }
        throw error;
      }
    }
    const status = published ? "published" : response.status;

    const resultText = `**${response.status === "published" ? "Existing form retrieved successfully" : published ? "Form created and published successfully" : "Form draft created successfully"}!**

**Form ID:** \`${response.formId}\`
**Idempotency Key:** \`${response.idempotencyKey}\`
**Name:** ${response.name}
**Fields:** ${response.fieldCount} field${response.fieldCount !== 1 ? "s" : ""} across ${response.stepCount} step${response.stepCount !== 1 ? "s" : ""}
${published ? `\n**Public URL (share this with respondents):** ${published.publicUrl}\n` : ""}
**Preview URL:** ${response.previewUrl}

---

**Next steps:**
${
  published
    ? `1. Share the public URL with respondents yourself
2. Check results with \`summarize_responses\` or \`list_form_responses\` (form_id \`${response.formId}\`)
3. Use \`close_form\` when collection is over`
    : `1. Open the preview URL to see your form
2. Use \`get_preview_url\` with form_id \`${response.formId}\` to get details anytime
${
  response.status === "draft"
    ? `3. Use \`publish_form\` with form_id \`${response.formId}\` to make it publicly accessible`
    : "3. This form is already published and accepting responses"
}`
}`;

    return formatSuccessResult(resultText, {
      formId: response.formId,
      publicId: response.publicId,
      idempotencyKey: response.idempotencyKey,
      name: response.name,
      fieldCount: response.fieldCount,
      stepCount: response.stepCount,
      previewUrl: response.previewUrl,
      status,
      ...(published
        ? {
            publicUrl: published.publicUrl,
            closeAt: published.closeAt ?? null,
            responseLimit: published.responseLimit ?? null,
          }
        : {}),
    });
  } catch (error) {
    return formatErrorResult(error);
  }
}
