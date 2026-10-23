/**
 * Shared types for the niceform MCP server
 */

// ============================================
// API Response Types
// ============================================

export interface CreateFormResponse {
  formId: string;
  publicId: string;
  idempotencyKey: string;
  name: string;
  fieldCount: number;
  stepCount: number;
  previewUrl: string;
  status: "draft" | "published";
}

export interface PreviewUrlResponse {
  formId: string;
  publicId: string;
  name: string;
  status: "draft" | "published";
  previewUrl: string;
  fieldCount: number;
  stepCount: number;
}

export interface PublishFormResponse {
  formId: string;
  publicId: string;
  name: string;
  publicUrl: string;
  status: "published";
  formStatus?: FormLifecycleStatus;
  closeAt?: string | null;
  responseLimit?: number | null;
}

export interface ApiErrorResponse {
  error: string;
  message?: string;
  retryAfter?: number;
}

// ============================================
// Tool Input Types
// ============================================

export interface CreateFormInput {
  description: string;
  style_preference?:
    | "modern"
    | "minimal"
    | "colorful"
    | "professional"
    | "default";
  idempotency_key: string;
}

export interface GetPreviewUrlInput {
  form_id: string;
}

export interface PublishFormInput {
  form_id: string;
  name?: string;
}

// ============================================
// MCP Tool Result Types
// ============================================

export interface ToolResult {
  content: Array<{
    type: "text";
    text: string;
  }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

// ============================================
// List Form Responses
// ============================================

export type ResponseStatusFilter =
  | "submitted"
  | "completed"
  | "incomplete"
  | "all";

export interface ListFormResponsesInput {
  form_id: string;
  status?: ResponseStatusFilter;
  limit?: number;
  cursor?: string;
  since?: string;
}

export interface FormResponseItem {
  id: string;
  status: string;
  formData: unknown;
  submittedAt: string | null;
  createdAt: string;
  metadata: unknown;
}

export interface ListFormResponsesResponse {
  success: true;
  responses: FormResponseItem[];
  nextCursor: string | null;
  total: number;
  fields?: Array<{ key: string; label: string }>;
  latestSubmittedAt?: string | null;
}

// ============================================
// v0.3 additions
// ============================================

export type FormLifecycleStatus = "draft" | "live" | "closed";

export const FIELD_TYPES = [
  "text",
  "textarea",
  "email",
  "number",
  "date",
  "time",
  "select",
  "radio",
  "checkboxes",
  "checkbox",
  "rating",
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export interface FieldSpec {
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
}

export interface CloseFormResponse {
  formId: string;
  status: "closed";
  closedAt: string;
}

export interface FormListItem {
  formId: string;
  publicId: string;
  name: string;
  status: FormLifecycleStatus;
  responseCount: number;
  publicUrl: string | null;
  closeAt: string | null;
  createdAt: string;
}

export interface ListFormsResponse {
  forms: FormListItem[];
  nextCursor: string | null;
}

export interface GetFormResponse {
  formId: string;
  publicId: string;
  name: string;
  status: FormLifecycleStatus;
  publicUrl: string | null;
  closeAt: string | null;
  responseLimit: number | null;
  oneResponsePerDevice: boolean;
  fields: Array<{
    key: string;
    label: string;
    type: string;
    widget?: string;
    required: boolean;
    options?: Array<{ value: string; label: string }>;
  }>;
}

export interface SummaryResponse {
  formId: string;
  name: string;
  status: FormLifecycleStatus;
  totals: { submitted: number; incomplete: number };
  fields: Array<{
    key: string;
    label: string;
    type: string;
    answered: number;
    counts?: Record<string, number>;
    min?: number;
    max?: number;
    avg?: number;
  }>;
}

export interface ExportResponse {
  formId: string;
  rowCount: number;
  csv: string | null;
  truncated: boolean;
  downloadUrl: string | null;
  expiresAt: string | null;
}
