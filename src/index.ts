#!/usr/bin/env node

/**
 * niceform MCP Server
 *
 * This server provides MCP tools for creating, previewing, and publishing
 * forms using the niceform.ai AI-powered form builder.
 *
 * Environment Variables:
 *   NICEFORM_API_KEY - Your niceform.ai API key (required)
 *   NICEFORM_API_URL - API base URL (optional, defaults to https://www.niceform.ai)
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { apiClient } from "./lib/api-client.js";
import { createNiceformServer } from "./server.js";

// Start the server
async function main() {
  // Check for API key
  if (!process.env.NICEFORM_API_KEY) {
    console.error(
      "Warning: NICEFORM_API_KEY environment variable is not set.\n" +
        "Tools will fail until a valid API key is provided.\n" +
        "Get your API key from: https://www.niceform.ai/dashboard/settings/api-keys\n",
    );
  }

  await createNiceformServer(apiClient).connect(new StdioServerTransport());

  // Log to stderr (stdout is reserved for MCP protocol)
  console.error("niceform MCP server started");
  console.error(
    "Available tools: create_form, publish_form, close_form, list_forms, get_form, get_preview_url, list_form_responses, summarize_responses, export_responses_csv",
  );
}

main().catch((error) => {
  console.error("Fatal error starting MCP server:", error);
  process.exit(1);
});
