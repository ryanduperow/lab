import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as ynab from "ynab";

// --- Configuration ---

const token = process.env.YNAB_API_TOKEN;
if (!token) {
  console.error("YNAB_API_TOKEN environment variable is required");
  process.exit(1);
}

const api = new ynab.API(token);
const BUDGET_ID = "last-used";

// --- Helpers ---

function formatCurrency(milliunits: number): string {
  return "$" + (milliunits / 1000).toFixed(2);
}

function toMilliunits(dollars: number): number {
  return Math.round(dollars * 1000);
}

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

async function findCategoryByName(name: string) {
  const response = await api.categories.getCategories(BUDGET_ID);
  for (const group of response.data.category_groups) {
    for (const cat of group.categories) {
      if (cat.name.toLowerCase() === name.toLowerCase()) {
        return cat;
      }
    }
  }
  return null;
}

// --- Server ---

const server = new McpServer({
  name: "ynab-server",
  version: "1.0.0",
});

// =====================
//        TOOLS
// =====================

// 1. Budget summary — income vs spending for a month
server.registerTool(
  "get_budget_summary",
  {
    description:
      "Get budget overview for a month — income, total spending, amount left to budget, and per-category breakdown",
    inputSchema: {
      month: z
        .string()
        .optional()
        .describe("Month in YYYY-MM-DD format, e.g. 2026-03-01 (defaults to current month)"),
    },
  },
  async ({ month }) => {
    const targetMonth = month || getCurrentMonth();

    const response = await api.months.getBudgetMonth(BUDGET_ID, targetMonth);
    const m = response.data.month;

    const categories = m.categories
      ?.filter((c) => !c.hidden && !c.deleted)
      .map((c) => ({
        name: c.name,
        budgeted: formatCurrency(c.budgeted),
        spent: formatCurrency(c.activity),
        balance: formatCurrency(c.balance),
        overspent: c.balance < 0,
      }));

    const overspent = categories?.filter((c) => c.overspent) || [];

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              month: targetMonth,
              income: formatCurrency(m.income),
              budgeted: formatCurrency(m.budgeted),
              total_spending: formatCurrency(m.activity),
              to_be_budgeted: formatCurrency(m.to_be_budgeted),
              age_of_money: m.age_of_money,
              overspent_categories: overspent,
              all_categories: categories,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// 2. Category balances — drill into specific groups or see all
server.registerTool(
  "get_category_balances",
  {
    description:
      "List budget categories with budgeted amounts, spending, and remaining balances. Optionally filter by category group.",
    inputSchema: {
      group: z
        .string()
        .optional()
        .describe(
          "Filter to a specific category group name, e.g. 'Bills' or 'Fun Money' (partial match, case-insensitive)"
        ),
    },
  },
  async ({ group }) => {
    const response = await api.categories.getCategories(BUDGET_ID);
    let groups = response.data.category_groups.filter(
      (g) => !g.hidden && !g.deleted
    );

    if (group) {
      groups = groups.filter((g) =>
        g.name.toLowerCase().includes(group.toLowerCase())
      );
    }

    const result = groups.map((g) => ({
      group: g.name,
      categories: g.categories
        .filter((c) => !c.hidden && !c.deleted)
        .map((c) => ({
          name: c.name,
          budgeted: formatCurrency(c.budgeted),
          spent: formatCurrency(c.activity),
          balance: formatCurrency(c.balance),
          overspent: c.balance < 0,
        })),
    }));

    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  }
);

// 3. Search transactions — find charges by payee, category, amount, date
server.registerTool(
  "search_transactions",
  {
    description:
      "Search recent transactions with optional filters for payee, category, amount range, and date",
    inputSchema: {
      since_date: z
        .string()
        .optional()
        .describe("Only transactions on or after this date, YYYY-MM-DD (defaults to last 30 days)"),
      category: z
        .string()
        .optional()
        .describe("Filter by category name (partial match, case-insensitive)"),
      payee: z
        .string()
        .optional()
        .describe("Filter by payee name (partial match, case-insensitive)"),
      min_amount: z
        .number()
        .optional()
        .describe("Minimum amount in dollars (use negative for expenses, e.g. -50)"),
      max_amount: z
        .number()
        .optional()
        .describe("Maximum amount in dollars"),
      limit: z
        .number()
        .optional()
        .default(25)
        .describe("Max transactions to return (default 25)"),
    },
  },
  async ({ since_date, category, payee, min_amount, max_amount, limit }) => {
    const sinceDate = since_date || daysAgo(30);

    const response = await api.transactions.getTransactions(BUDGET_ID, sinceDate);
    let txns = response.data.transactions.filter((t) => !t.deleted);

    if (category) {
      txns = txns.filter((t) =>
        t.category_name?.toLowerCase().includes(category.toLowerCase())
      );
    }

    if (payee) {
      txns = txns.filter((t) =>
        t.payee_name?.toLowerCase().includes(payee.toLowerCase())
      );
    }

    if (min_amount !== undefined) {
      txns = txns.filter((t) => t.amount >= toMilliunits(min_amount));
    }

    if (max_amount !== undefined) {
      txns = txns.filter((t) => t.amount <= toMilliunits(max_amount));
    }

    // Most recent first, then limit
    const limited = txns.reverse().slice(0, limit);

    const result = limited.map((t) => ({
      date: t.date,
      payee: t.payee_name,
      category: t.category_name,
      amount: formatCurrency(t.amount),
      memo: t.memo || null,
      cleared: t.cleared,
      account: t.account_name,
    }));

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              total_matched: txns.length,
              showing: limited.length,
              transactions: result,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// 4. Move money — reassign budgeted dollars between categories
server.registerTool(
  "move_money",
  {
    description:
      "Move budgeted money from one category to another in the current month. Both categories are specified by name.",
    inputSchema: {
      from_category: z.string().describe("Source category name to take money from"),
      to_category: z.string().describe("Destination category name to add money to"),
      amount: z.number().positive().describe("Amount in dollars to move"),
    },
  },
  async ({ from_category, to_category, amount }) => {
    const month = getCurrentMonth();
    const milliunits = toMilliunits(amount);

    const fromCat = await findCategoryByName(from_category);
    const toCat = await findCategoryByName(to_category);

    if (!fromCat) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Category "${from_category}" not found. Use get_category_balances to see available categories.`,
          },
        ],
      };
    }
    if (!toCat) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Category "${to_category}" not found. Use get_category_balances to see available categories.`,
          },
        ],
      };
    }

    if (fromCat.balance < milliunits) {
      return {
        content: [
          {
            type: "text" as const,
            text:
              `"${from_category}" only has ${formatCurrency(fromCat.balance)} available. ` +
              `Can't move $${amount.toFixed(2)} without overspending that category.`,
          },
        ],
      };
    }

    // Decrease source budget, increase destination budget
    await api.categories.updateMonthCategory(BUDGET_ID, month, fromCat.id, {
      category: { budgeted: fromCat.budgeted - milliunits },
    });

    await api.categories.updateMonthCategory(BUDGET_ID, month, toCat.id, {
      category: { budgeted: toCat.budgeted + milliunits },
    });

    return {
      content: [
        {
          type: "text" as const,
          text:
            `Moved $${amount.toFixed(2)} from "${from_category}" to "${to_category}".\n\n` +
            `${from_category}: now ${formatCurrency(fromCat.budgeted - milliunits)} budgeted (was ${formatCurrency(fromCat.budgeted)})\n` +
            `${to_category}: now ${formatCurrency(toCat.budgeted + milliunits)} budgeted (was ${formatCurrency(toCat.budgeted)})`,
        },
      ],
    };
  }
);

// =====================
//      RESOURCES
// =====================

server.registerResource(
  "accounts",
  "ynab://accounts",
  { description: "All YNAB accounts with current balances" },
  async (uri) => {
    const response = await api.accounts.getAccounts(BUDGET_ID);
    const accounts = response.data.accounts
      .filter((a) => !a.closed && !a.deleted)
      .map((a) => ({
        name: a.name,
        type: a.type,
        balance: formatCurrency(a.balance),
        cleared_balance: formatCurrency(a.cleared_balance),
        uncleared_balance: formatCurrency(a.uncleared_balance),
      }));

    return {
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(accounts, null, 2),
        },
      ],
    };
  }
);

server.registerResource(
  "categories",
  "ynab://categories",
  { description: "All budget categories grouped with current balances" },
  async (uri) => {
    const response = await api.categories.getCategories(BUDGET_ID);
    const groups = response.data.category_groups
      .filter((g) => !g.hidden && !g.deleted)
      .map((g) => ({
        group: g.name,
        categories: g.categories
          .filter((c) => !c.hidden && !c.deleted)
          .map((c) => ({
            name: c.name,
            budgeted: formatCurrency(c.budgeted),
            spent: formatCurrency(c.activity),
            balance: formatCurrency(c.balance),
          })),
      }));

    return {
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(groups, null, 2),
        },
      ],
    };
  }
);

// =====================
//       PROMPTS
// =====================

server.registerPrompt(
  "budget-check",
  {
    description: "Check how your budget is doing this month — income vs spending, overspent categories",
  },
  async () => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text:
            "Check my YNAB budget for this month. Show me:\n" +
            "1. Total income vs total spending so far\n" +
            "2. How much is left to budget (unassigned dollars)\n" +
            "3. Any categories that are overspent or getting close to zero\n" +
            "4. A brief overall assessment of where I stand this month",
        },
      },
    ],
  })
);

server.registerPrompt(
  "spending-review",
  {
    description: "Analyze where your money is going — top spending categories and patterns",
    argsSchema: {
      period: z.string().optional().describe("Time period, e.g. 'this month', 'last 2 weeks'"),
    },
  },
  async ({ period }) => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text:
            `Review my spending${period ? ` for ${period}` : " for this month"}. I want to understand:\n` +
            "1. Top categories by spending amount\n" +
            "2. Any unusually large transactions\n" +
            "3. How actual spending compares to budgeted amounts\n" +
            "4. Areas where I could potentially cut back",
        },
      },
    ],
  })
);

// =====================
//     START SERVER
// =====================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("YNAB MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
