/**
 * Shared MCP server factory: used by the stdio binary and the hosted HTTP endpoint.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
} from "@modelcontextprotocol/sdk/types.js";

import type { APIClient } from "./lib/api-client.js";
import {
  createFormTool,
  handleCreateForm,
  getPreviewUrlTool,
  handleGetPreviewUrl,
  publishFormTool,
  handlePublishForm,
  listFormResponsesTool,
  handleListFormResponses,
  closeFormTool,
  handleCloseForm,
  listFormsTool,
  handleListForms,
  getFormTool,
  handleGetForm,
  summarizeResponsesTool,
  handleSummarizeResponses,
  exportResponsesCsvTool,
  handleExportResponsesCsv,
} from "./tools/index.js";

export { APIClient } from "./lib/api-client.js";

export function createNiceformServer(client: APIClient): Server {
  const server = new Server(
    { name: "niceform-mcp-server", version: "0.3.0" },
    { capabilities: { tools: {} } },
  );

  // Handler: List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        createFormTool,
        getPreviewUrlTool,
        publishFormTool,
        listFormResponsesTool,
        closeFormTool,
        listFormsTool,
        getFormTool,
        summarizeResponsesTool,
        exportResponsesCsvTool,
      ],
    };
  });

  // Handler: Execute tool calls
  server.setRequestHandler(
    CallToolRequestSchema,
    async (request, extra): Promise<CallToolResult> => {
      const { name, arguments: args } = request.params;

      let result;
      let progress = 0;
      let progressTimer: ReturnType<typeof setInterval> | undefined;
      const progressToken = request.params._meta?.progressToken;

      if (name === "create_form" && progressToken !== undefined) {
        await extra.sendNotification({
          method: "notifications/progress",
          params: {
            progressToken,
            progress,
            message: "Starting form generation",
          },
        });
        progressTimer = setInterval(() => {
          progress += 1;
          void extra
            .sendNotification({
              method: "notifications/progress",
              params: {
                progressToken,
                progress,
                message: "Form generation is still in progress",
              },
            })
            .catch(() => {
              // The client may have disconnected or cancelled; the abort signal handles cancellation.
            });
        }, 15000);
      }

      try {
        switch (name) {
          case "create_form":
            result = await handleCreateForm(args ?? {}, client, extra.signal);
            break;

          case "get_preview_url":
            result = await handleGetPreviewUrl(
              args ?? {},
              client,
              extra.signal,
            );
            break;

          case "publish_form":
            result = await handlePublishForm(args ?? {}, client, extra.signal);
            break;

          case "list_form_responses":
            result = await handleListFormResponses(
              args ?? {},
              client,
              extra.signal,
            );
            break;

          case "close_form":
            result = await handleCloseForm(args ?? {}, client, extra.signal);
            break;

          case "list_forms":
            result = await handleListForms(args ?? {}, client, extra.signal);
            break;

          case "get_form":
            result = await handleGetForm(args ?? {}, client, extra.signal);
            break;

          case "summarize_responses":
            result = await handleSummarizeResponses(
              args ?? {},
              client,
              extra.signal,
            );
            break;

          case "export_responses_csv":
            result = await handleExportResponsesCsv(
              args ?? {},
              client,
              extra.signal,
            );
            break;

          default:
            result = {
              content: [
                {
                  type: "text" as const,
                  text: `Unknown tool: ${name}. Available tools: create_form, get_preview_url, publish_form, list_form_responses, close_form, list_forms, get_form, summarize_responses, export_responses_csv`,
                },
              ],
              isError: true,
            };
        }
      } finally {
        if (progressTimer) clearInterval(progressTimer);
      }

      if (
        name === "create_form" &&
        progressToken !== undefined &&
        !result.isError
      ) {
        progress += 1;
        await extra.sendNotification({
          method: "notifications/progress",
          params: {
            progressToken,
            progress,
            message: "Form generation complete",
          },
        });
      }

      return result as CallToolResult;
    },
  );

  return server;
}
