# Walkthrough

A linear walkthrough of the YNAB MCP server, file by file in reading order.

## package.json

Sets up the project as an ES module (`"type": "module"`) with three runtime dependencies:

- **`@modelcontextprotocol/sdk`** — The MCP protocol SDK. Provides `McpServer` for registering tools/resources/prompts and `StdioServerTransport` for communicating over stdin/stdout.
- **`ynab`** — Official YNAB JavaScript SDK. Wraps the REST API with typed methods so you call `api.months.getBudgetMonth(...)` instead of raw `fetch`.
- **`zod`** — Schema validation library. The MCP SDK uses Zod schemas to define and validate tool input parameters at runtime.

The `build` script just runs `tsc` — the output goes to `dist/` and that's what Claude Code actually executes.

## tsconfig.json

Two settings worth noting:

- **`"module": "Node16"`** — This is TypeScript's module resolution strategy, not a Node.js version. It's the recommended setting for ES modules because it correctly handles `.js` extensions in import paths (which the MCP SDK requires).
- **`"declaration": true`** — Generates `.d.ts` type definition files alongside the compiled JS. Not strictly needed for a standalone server, but useful if you ever want to import types from this project.

## src/index.ts

The entire server lives in one file. It has five sections: configuration, helpers, tools, resources, and prompts.

### Configuration (lines 1–15)

```typescript
const token = process.env.YNAB_API_TOKEN;
const api = new ynab.API(token);
const BUDGET_ID = "last-used";
```

The YNAB API token comes from an environment variable, set in `.mcp.json` when registering the server. The token is passed through Claude Code to the spawned Node process via the `env` config field.

`"last-used"` is a special YNAB API value that resolves to whichever budget you opened most recently. This avoids a separate API call to list budgets — a worthwhile shortcut since most YNAB users have exactly one budget.

### Helpers (lines 17–48)

Five utility functions that handle recurring conversions:

- **`formatCurrency(milliunits)`** — YNAB stores all amounts as integers in thousandths of a dollar (3906180 = $3,906.18). This converts to a display string. Using integers avoids floating-point precision issues that plague financial software.
- **`toMilliunits(dollars)`** — The reverse conversion, used when the LLM provides dollar amounts (e.g., for `move_money`).
- **`getCurrentMonth()`** — Returns the first of the current month in `YYYY-MM-DD` format, which is what the YNAB API expects for month-based queries.
- **`daysAgo(n)`** — Returns a date string N days in the past. Used by `search_transactions` to default to the last 30 days.
- **`findCategoryByName(name)`** — Looks up a category by name (case-insensitive) across all category groups. Used by `move_money` so the LLM can reference categories by name rather than opaque UUIDs. Makes two nested loops because YNAB organizes categories into groups.

### Tools (lines 57–328)

Tools are the core of an MCP server — they're the actions the LLM can decide to invoke. Each tool is registered with `server.registerTool(name, config, handler)` where:

- `name` — what the LLM sees in its tool list
- `config.description` — natural language description that helps the LLM decide when to use it
- `config.inputSchema` — Zod schema that defines and validates the input parameters
- `handler` — async function that receives validated input and returns an MCP content result

**`get_budget_summary`** (lines 62–114) — The most-used tool. Calls `api.months.getBudgetMonth()` to get a single month's data including income, budgeted totals, spending (called "activity" in YNAB), and all categories. Filters out hidden/deleted categories and flags any that are overspent (balance < 0). The result is a JSON string inside the MCP content format — the LLM parses this and synthesizes a natural language answer.

**`get_category_balances`** (lines 117–160) — Similar to budget summary but organized by category group. Accepts an optional `group` filter (partial match) so the LLM can ask for just "Bills" or "Fun Money" without pulling everything. Useful for follow-up questions after seeing the budget summary.

**`search_transactions`** (lines 163–252) — Fetches transactions from the YNAB API and filters client-side by category, payee, and amount range. The API itself only supports filtering by date and account, so finer filtering happens in the handler. Results are reversed (most recent first) and limited to 25 by default. Each transaction includes date, payee, category, amount, memo, cleared status, and account name — enough for the LLM to answer questions like "what did I spend at Amazon this month?"

**`move_money`** (lines 255–328) — The one write operation. Moves budgeted dollars from one category to another by updating each category's `budgeted` amount via `api.categories.updateMonthCategory()`. This is a two-step process: decrease the source, increase the destination. Three safety checks happen before the write:

1. Source category must exist (looked up by name)
2. Destination category must exist
3. Source category must have enough available balance (prevents accidental overspending)

If any check fails, the tool returns an error message instead of making changes.

### Resources (lines 330–392)

Resources provide read-only data that can be pulled into context. They're registered with `server.registerResource(name, uri, metadata, handler)`.

Unlike tools, the LLM doesn't "call" resources — the client application decides when to load them. They're useful for providing background context that multiple tool calls might reference.

- **`ynab://accounts`** — Lists all non-closed accounts with their balances (total, cleared, uncleared). The custom `ynab://` URI scheme is arbitrary — resources just need a unique URI.
- **`ynab://categories`** — Lists all category groups and their categories with balances. Similar data to `get_category_balances` but exposed as a resource rather than a tool, so it can be loaded as context without the LLM explicitly requesting it.

### Prompts (lines 394–445)

Prompts are reusable message templates that guide the LLM toward structured workflows. Registered with `server.registerPrompt(name, config, handler)`.

- **`budget-check`** — Zero-argument prompt that generates a user message asking for a budget overview. When a client activates this prompt, it injects a pre-written request that the LLM responds to using the available tools. This ensures consistent, thorough budget checks every time.
- **`spending-review`** — Takes an optional `period` argument (e.g., "last 2 weeks"). Generates a user message asking for spending analysis. The `argsSchema` uses Zod so clients can present argument inputs to the user.

### Server Startup (lines 447–460)

```typescript
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("YNAB MCP server running on stdio");
```

Creates a stdio transport and connects the server to it. From this point, the server reads JSON-RPC messages from stdin and writes responses to stdout. The startup message goes to `console.error()` (stderr) — never `console.log()` (stdout), because stdout is the protocol channel.

## .mcp.json

Project-scoped MCP server registration (lives at the project root, not in `.claude/`). This is how Claude Code discovers and launches the server:

```json
{
  "mcpServers": {
    "ynab": {
      "type": "stdio",
      "command": "cmd",
      "args": ["/c", "node", "path/to/dist/index.js"],
      "env": { "YNAB_API_TOKEN": "..." }
    }
  }
}
```

On Windows, the command must use `cmd /c node` rather than bare `node`. The `env` field passes the YNAB token to the spawned process. This file should be gitignored since it contains the token.

## explain-mcp-runtime-flow.html

Interactive visualization that traces a single tool call through the full system. A 10-step walkthrough showing what happens when you ask "How's my budget?" — from natural language prompt through JSON-RPC serialization, stdin pipe, Zod validation, YNAB API call, milliunit conversion, stdout response, and back to a natural language answer. Open directly in a browser, no build step needed.
