# mcp-ynab-server

## What it proves

Building a real MCP server that connects an AI assistant to YNAB (You Need A Budget) — exercising tools, resources, and prompts with a live external API.

## Concepts involved

- MCP server architecture (McpServer, StdioServerTransport)
- Defining tools with Zod input schemas
- Defining resources with custom URI schemes
- Defining prompts as reusable interaction templates
- JSON-RPC 2.0 over stdio transport
- YNAB REST API (personal access tokens, milliunits, budget/category/transaction endpoints)

## Mental model

An MCP server is a program that exposes capabilities over a standardized protocol. The MCP SDK handles all the JSON-RPC plumbing — you just register tools, resources, and prompts with their schemas and handlers. The host (Claude Desktop, Claude Code) launches the server as a subprocess and communicates over stdin/stdout.

This server wraps the YNAB API into MCP primitives:
- **Tools** let the LLM check budgets, search transactions, and move money between categories
- **Resources** provide account and category data as context
- **Prompts** offer structured workflows like "how's my budget doing?"

The `ynab` npm SDK handles API auth and typed responses. The MCP SDK handles protocol serialization. The server code is just the glue between them.

## How to run

### 1. Get a YNAB personal access token

Go to YNAB → Account Settings → Developer Settings → create a personal access token.

### 2. Install and build

```bash
cd mcp-ynab-server
npm install
npm run build
```

### 3. Connect to Claude Code

Register via CLI (recommended):

```bash
claude mcp add -s project -e YNAB_API_TOKEN=your-token-here ynab -- cmd /c node /absolute/path/to/mcp-ynab-server/dist/index.js
```

Or create `.mcp.json` at your project root:

```json
{
  "mcpServers": {
    "ynab": {
      "type": "stdio",
      "command": "cmd",
      "args": ["/c", "node", "C:/absolute/path/to/mcp-ynab-server/dist/index.js"],
      "env": {
        "YNAB_API_TOKEN": "your-token-here"
      }
    }
  }
}
```

Restart Claude Code after adding. Verify with `/mcp`.

### 4. Connect to Claude Desktop

Add to `%APPDATA%\Claude\claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ynab": {
      "type": "stdio",
      "command": "cmd",
      "args": ["/c", "node", "C:/absolute/path/to/mcp-ynab-server/dist/index.js"],
      "env": {
        "YNAB_API_TOKEN": "your-token-here"
      }
    }
  }
}
```

Restart Claude Desktop after editing.

## Available capabilities

### Tools

| Tool | Description |
|---|---|
| `get_budget_summary` | Income vs spending for a month, per-category breakdown, overspent categories |
| `get_category_balances` | All categories with budgeted/spent/remaining, optional group filter |
| `search_transactions` | Find transactions by payee, category, amount range, date |
| `move_money` | Move budgeted dollars from one category to another |

### Resources

| URI | Description |
|---|---|
| `ynab://accounts` | All accounts with balances |
| `ynab://categories` | All category groups with balances |

### Prompts

| Prompt | Description |
|---|---|
| `budget-check` | "How's my budget doing?" — income vs spending, overspent categories |
| `spending-review` | "Where's my money going?" — top categories, large transactions, suggestions |

## Interactive explanation

- [explain-mcp-runtime-flow.html](explain-mcp-runtime-flow.html) — Step-through visualization of what happens when you ask "How's my budget?" — traces the data from user prompt through JSON-RPC, stdin/stdout, YNAB API, and back to natural language answer

## Lessons learned

### MCP server registration is not in settings.json
MCP servers go in **`.mcp.json` at the project root** (for project scope) or are registered via `claude mcp add`. The `.claude/settings.local.json` file is for Claude Code settings (permissions, hooks, etc.), not server registration. These are completely separate systems despite both being JSON config.

### Windows needs `cmd /c` and has path-mangling gotchas
On Windows, MCP server commands must use `cmd /c node` instead of bare `node` — this matches how other stdio servers (like playwright) are configured. Additionally, the `claude mcp add` CLI running in Git Bash will mangle `/c` into `C:/` due to MSYS path conversion. You'll need to hand-edit the `.mcp.json` to fix it.

### The SDK API has moved to config objects
`server.tool()`, `server.resource()`, and `server.prompt()` are all deprecated. The current API uses `server.registerTool()`, `server.registerResource()`, and `server.registerPrompt()` with a config object as the second argument:
```typescript
// Old (deprecated)
server.tool("name", "description", { schema }, callback)

// Current
server.registerTool("name", { description, inputSchema: { schema } }, callback)
```

### Never console.log() in stdio servers
stdout is the JSON-RPC transport channel. Any `console.log()` call injects non-protocol text into the stream and breaks communication. Use `console.error()` for all logging — it writes to stderr, which the host ignores.

### YNAB amounts are in milliunits
YNAB represents all currency as integers in thousandths (1000 = $1.00), not cents. This avoids floating-point precision issues. Convert at the boundary when formatting for display.

### `"last-used"` simplifies single-budget setups
The YNAB API accepts `"last-used"` as a budget ID, which resolves to the most recently accessed budget. This eliminates a lookup call for users with one budget (which is most users).

## Notes

- YNAB rate limit is 200 requests/hour per token — the server doesn't cache, so be mindful with heavy use
- `move_money` checks available balance before moving and refuses if it would overspend the source category
