# niceform-mcp-server

MCP (Model Context Protocol) server for [niceform.ai](https://niceform.ai) - Create AI-powered forms from any MCP-compatible client: Claude Desktop, Claude Code, Cursor, VS Code (GitHub Copilot), Windsurf, OpenAI Codex, Gemini CLI, and more.

## Features

Nine tools, so an agent can run a form end to end:

- **create_form** - Generate a form from a natural language description
- **publish_form** - Make a form live and publicly accessible
- **close_form** - Stop accepting responses
- **list_forms** - List your forms
- **get_form** - Get a form's fields and status
- **get_preview_url** - Preview a form before publishing
- **list_form_responses** - Retrieve paginated submissions for forms you own
- **summarize_responses** - Summarize the responses to a form
- **export_responses_csv** - Export responses as CSV

## Connect by URL (no install)

niceform.ai also hosts this server at `https://www.niceform.ai/api/mcp` (streamable HTTP). Send your API key as `Authorization: Bearer <API key>`.

```bash
claude mcp add --transport http niceform https://www.niceform.ai/api/mcp --header "Authorization: Bearer nf_live_your_api_key_here"
```

Cursor (`~/.cursor/mcp.json`):

```json
{ "mcpServers": { "niceform": { "url": "https://www.niceform.ai/api/mcp", "headers": { "Authorization": "Bearer nf_live_your_api_key_here" } } } }
```

VS Code (`.vscode/mcp.json`):

```json
{ "servers": { "niceform": { "type": "http", "url": "https://www.niceform.ai/api/mcp", "headers": { "Authorization": "Bearer nf_live_your_api_key_here" } } } }
```

Claude Desktop: use the npx setup below. More: https://www.niceform.ai/mcp

## Requirements

- Node.js 18 or newer (the server runs locally through `npx`, so there's nothing else to install)
- A niceform.ai API key
- An MCP client that supports local (stdio) servers. See [Supported clients](#supported-clients).

## Get an API Key

1. Sign in to [niceform.ai](https://www.niceform.ai)
2. Go to **Settings** → **API Keys**
3. Create a new API key
4. Copy the key. It's only shown once.

## Environment Variables

| Variable           | Required | Description                                          |
| ------------------ | -------- | ---------------------------------------------------- |
| `NICEFORM_API_KEY` | Yes      | Your niceform.ai API key (`nf_live_...`)             |
| `NICEFORM_API_URL` | No       | API base URL (defaults to `https://www.niceform.ai`) |

## Supported Clients

The server works with any MCP client that can run a local command, whichever LLM that client uses. In every example below, replace `nf_live_your_api_key_here` with your key.

| Client                     | Models                         | Config                                |
| -------------------------- | ------------------------------ | ------------------------------------- |
| Claude Desktop             | Claude                         | `claude_desktop_config.json`          |
| Claude Code                | Claude                         | `claude mcp add` command              |
| Cursor                     | GPT, Claude, Gemini and others | `~/.cursor/mcp.json`                  |
| VS Code (GitHub Copilot)   | GPT, Claude, Gemini            | `.vscode/mcp.json`                    |
| Windsurf                   | GPT, Claude, Gemini and others | `~/.codeium/windsurf/mcp_config.json` |
| Codex CLI / IDE (OpenAI)   | OpenAI GPT                     | `~/.codex/config.toml`                |
| Gemini CLI                 | Google Gemini                  | `~/.gemini/settings.json`             |
| Cline, Zed, Continue, etc. | Any                            | Standard `mcpServers` JSON            |

> **Browser-only apps** (chatgpt.com, claude.ai, gemini.google.com) can't run local MCP servers. Use one of the desktop, editor, or terminal apps above.

### Claude Desktop

Edit the config file, or open it from **Settings → Developer → Edit Config**:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "niceform": {
      "command": "npx",
      "args": ["-y", "niceform-mcp-server"],
      "env": {
        "NICEFORM_API_KEY": "nf_live_your_api_key_here"
      }
    }
  }
}
```

Restart Claude Desktop afterwards.

### Claude Code

```bash
claude mcp add niceform --scope user -e NICEFORM_API_KEY=nf_live_your_api_key_here -- npx -y niceform-mcp-server
```

Run `/mcp` inside Claude Code to confirm it's connected.

### Cursor

Add the same `mcpServers` JSON as Claude Desktop to `~/.cursor/mcp.json` (all projects) or `.cursor/mcp.json` (one project). It works with whichever model you pick in Cursor.

### VS Code (GitHub Copilot)

Create `.vscode/mcp.json` in your workspace. VS Code uses a `servers` key, not `mcpServers`:

```json
{
  "servers": {
    "niceform": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "niceform-mcp-server"],
      "env": {
        "NICEFORM_API_KEY": "nf_live_your_api_key_here"
      }
    }
  }
}
```

Then use Copilot Chat in **Agent** mode.

### Windsurf

Add the same `mcpServers` JSON as Claude Desktop to `~/.codeium/windsurf/mcp_config.json`, then refresh Cascade.

### Codex (OpenAI)

Add to `~/.codex/config.toml`. The Codex CLI and IDE extension both use this file.

```toml
[mcp_servers.niceform]
command = "npx"
args = ["-y", "niceform-mcp-server"]
env = { NICEFORM_API_KEY = "nf_live_your_api_key_here" }
```

### Gemini CLI

Merge the same `mcpServers` JSON as Claude Desktop into `~/.gemini/settings.json` (all projects) or `.gemini/settings.json` (one project).

### Other MCP clients

Any client that supports local (stdio) servers works. Most accept the `mcpServers` JSON above. Otherwise, use these values:

| Setting   | Value                                        |
| --------- | -------------------------------------------- |
| Command   | `npx`                                        |
| Arguments | `-y niceform-mcp-server`                     |
| Env       | `NICEFORM_API_KEY=nf_live_your_api_key_here` |

### Global install (optional)

If you'd rather not use `npx`:

```bash
npm install -g niceform-mcp-server
```

Then use `niceform-mcp` as the command, with no arguments, in any of the configs above.

### From source

```bash
git clone https://github.com/Shirish-Singh/niceform-mcp && cd niceform-mcp && npm install && npm run build
```

Then point your client at `node /absolute/path/to/niceform-mcp-server/dist/index.js`.

## Available Tools

### create_form

Create a new form from a natural language description.

**Parameters:**

- `description` (required): Natural language description of the form
- `idempotency_key` (required): A unique caller-generated key, preferably a UUID; reuse it when retrying the same creation
- `style_preference` (optional): One of `modern`, `minimal`, `colorful`, `professional`, `default`

**Example:**

```
Create a customer feedback form for a coffee shop with:
- Overall rating (1-5 stars)
- Service quality rating
- Coffee quality rating
- Free text comments
- Optional email for follow-up
```

### get_preview_url

Get the preview URL for a form to see how it looks.

**Parameters:**

- `form_id` (required): The form ID from create_form

### publish_form

Publish a form to make it publicly accessible.

**Parameters:**

- `form_id` (required): The form ID to publish
- `name` (optional): Override the form name

### list_form_responses

Retrieve submissions for a form you own. Responses may contain personal data, so only request and expose fields needed for the user's task.

**Parameters:**

- `form_id` (required): The form UUID or public ID
- `status` (optional): `submitted`, `completed`, `incomplete`, or `all`; defaults to `submitted`
- `limit` (optional): Integer page size from 1 to 100; defaults to 25
- `cursor` (optional): Opaque cursor returned by the preceding page
- `since` (optional): ISO 8601 timestamp with offset; returns only responses submitted after it. Reuse the returned `latestSubmittedAt` to poll.

### close_form

Stop accepting responses. **Parameters:** `form_id` (required).

### list_forms

List the forms you own. **Parameters (all optional):** `query` (filter by name), `limit` (page size), `cursor` (from the previous page).

### get_form

Get a form's fields and status. **Parameters:** `form_id` (required).

### summarize_responses

Summarize the responses to a form: totals, per-field answer counts, option counts and min/max/avg. **Parameters:** `form_id` (required).

### export_responses_csv

Export a form's responses as CSV. **Parameters:** `form_id` (required); `status` (optional): `submitted`, `completed`, `incomplete`, or `all`; defaults to `submitted`.

## Example Workflow

```
You: Create a simple contact form with name, email, and message fields

Assistant: [Uses create_form tool]
           Form created! Preview URL: https://www.niceform.ai/forms/abc123

You: Looks good, publish it

Assistant: [Uses publish_form tool]
           Published! Share this URL: https://www.niceform.ai/forms/abc123
```

## Development

```bash
# Watch mode (auto-rebuild on changes)
npm run mcp:dev

# Build once
npm run mcp:build

# Run the server directly
npm run mcp:start
```

## Troubleshooting

### "NICEFORM_API_KEY is not set"

Make sure `NICEFORM_API_KEY` is set in the `env` block of your client's MCP config. The key should start with `nf_live_` or `nf_test_`.

### "Invalid API key"

Your API key may have been revoked or expired. Generate a new one from the niceform.ai dashboard.

### "Rate limit exceeded"

You've made too many requests. Wait for the retry period indicated in the error message.

### Tools not appearing in your client

1. Restart the client (or reload its MCP servers) after editing the config
2. Check the config file syntax. JSON must be valid, with no trailing commas.
3. Make sure Node.js 18+ is installed and `npx` is on your `PATH`. Some GUI apps don't inherit your shell's `PATH`. If yours doesn't, use the full path to `npx` (find it with `which npx`).
4. VS Code: use the `servers` key, not `mcpServers`

## License

MIT

## Links

- [niceform.ai](https://niceform.ai) - AI-powered form builder
- [MCP Documentation](https://modelcontextprotocol.io) - Model Context Protocol
- [MCP clients](https://modelcontextprotocol.io/clients) - Apps that support MCP
