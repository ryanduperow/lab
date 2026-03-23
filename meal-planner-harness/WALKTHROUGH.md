# Walkthrough

File-by-file in reading order. Each section explains what the file does, why it exists, and how it connects to the rest.

## package.json

Project manifest with zero runtime dependencies — only TypeScript and `@types/node` as dev deps. The `"type": "module"` enables ES module imports. Four npm scripts:

- `build` — compiles TypeScript to `dist/`
- `dry-run` — full pipeline with mock data (zero tokens)
- `sample` — 7-day plan with real LLM calls
- `sparse-sample` — 5-day plan with only 8 pantry items (stresses shopping list)

## tsconfig.json

Matches the lab's TypeScript convention: `ES2022` target, `Node16` module resolution, strict mode. `rootDir: ./src` and `outDir: ./dist` keep source and output separate.

## src/types.ts

Every data shape used in the harness. This is the contract between phases — each phase reads its predecessor's artifact type and writes its own.

Key types:
- `HarnessInput` — pantry items, dietary preferences, day count, meal labels
- `ClassifiedIngredient` — ingredient with a category enum (protein, grain, vegetable, etc.)
- `Meal` / `DayPlan` — a meal with label, name, ingredients, and description
- `ValidationIssue` / `ShoppingItem` — validation results and missing ingredients
- `ClaudeResponse` — the shape of `claude -p --output-format json` output
- `HarnessOptions` — CLI flags (dry-run, input file, model)

Each phase has its own artifact type (e.g., `InputArtifact`, `ClassificationArtifact`) that wraps the data with a `phase` discriminator and `timestamp`.

## src/harness/workspace.ts

Filesystem abstraction for the workspace scratchpad. Each phase writes a numbered JSON artifact (e.g., `01-input.json`, `02-classification.json`) to this folder.

Methods: `readArtifact<T>()`, `writeArtifact()`, `writeText()`. No caching — every read goes to disk, which means phases are truly independent.

## src/harness/claude.ts

The core abstraction that makes the harness possible. Wraps the Claude Code CLI (`claude -p`) as a subprocess call.

**`buildArgs()`** constructs the argument array for every LLM call with these flags:
- `--no-session-persistence` — no session saved to disk (sub-agents don't need history)
- `--output-format json` — machine-readable response with cost/timing metadata
- `--json-schema` — when provided, forces structured output validated against the schema
- `--model` — defaults to `sonnet` for cost efficiency on narrow tasks
- `--system-prompt` — scoped context for each phase (classification vs. meal planning)

**`callClaudeSync()`** uses `execFileSync` (not `execSync`) for single calls. `execFileSync` bypasses the shell, passing args as an array — this prevents prompt injection if pantry items contain shell metacharacters.

**`callClaudeAsync()`** uses promisified `execFile` for parallel calls. Phase 3 (meal generation) uses this with `Promise.all` to run one subprocess per day concurrently.

**`loadMock()`** reads a fixture JSON file and wraps it in the same `ClaudeResult` shape. This is what dry-run mode uses instead of calling Claude.

**`callWithRetry()`** takes a call function and a validator. If the validator returns an error string, it retries once. Phase 2 uses this to ensure all pantry items appear in the classification output.

## src/harness/runner.ts

The phase runner — a flat sequential loop over a `PHASES` array. Each entry has a `name`, display `label`, `artifactFile`, and `execute` function.

The loop iterates through all 5 phases, printing a banner before each and catching errors. This is the "deterministic rails" — the LLM has no say in which phase runs next or whether to skip a step.

## src/phases/input.ts

Phase 1 — purely deterministic, no LLM. Reads the JSON input file, validates the shape (pantry non-empty, days >= 1, meal labels match count), writes `01-input.json`.

## src/phases/classify.ts

Phase 2 — single LLM call. Reads `01-input.json`, sends the pantry list to Claude with a system prompt defining each category and a JSON schema enforcing the `ClassifiedIngredient` structure.

The `callWithRetry` wrapper validates that every pantry item appears in the response (by name). If the LLM omits any items, it retries once. This is the validation loop pattern — code catches the LLM's mistake and forces a correction.

In dry-run mode, reads `fixtures/mock-classify.json` instead. Writes `02-classification.json`.

## src/phases/generate.ts

Phase 3 — parallel sub-agents. This is the key harness pattern. Reads both `01-input.json` and `02-classification.json`, then spawns one `claude -p` subprocess per day using `callClaudeAsync()` + `Promise.all`.

Each sub-agent gets a focused prompt with the classified ingredient list, dietary preferences, its day number, and a JSON schema enforcing the `Meal[]` structure. The prompt encourages the LLM to suggest additional ingredients beyond the pantry — the validation phase will catch these for the shopping list.

Because each subprocess is a separate process, they have isolated context windows — no shared state, no context pollution. The harness assembles results afterward.

In dry-run mode, reads `fixtures/mock-generate-day{N}.json` per day. Writes `03-meals.json`.

## src/phases/validate.ts

Phase 4 — purely deterministic, no LLM. The most complex phase, running six checks:

1. **Meal count** — each day has the expected number of meals
2. **Protein variety** — no identical main proteins on consecutive days (uses classification to identify protein ingredients)
3. **Dietary compliance** — keyword-based check for vegetarian/shellfish violations
4. **Shopping list** — diffs meal ingredients against pantry, groups missing items by category
5. **Pantry consumption** — flags ingredients used more times than plausibly available based on stated quantities (e.g., "have 2 cans, used in 6 meals")
6. **Variety score** — unique meal names / total meals as a percentage

Writes `04-validation.json` including the shopping list.

## src/phases/report.ts

Phase 5 — deterministic template output, no LLM. Reads `03-meals.json` and `04-validation.json`, calls the template builders, writes two markdown files.

This is the reliability guarantee: the LLM never touches the final format. Whether you run the harness 1 or 100 times, the output structure is identical — only the data inside changes.

Writes `05-meal-plan.md`, `05-shopping-list.md`, and `05-report.json`.

## src/templates/meal-plan.ts

Two template builder functions that produce markdown from typed data:

**`buildMealPlanMarkdown()`** — day-by-day meal cards with ingredients and descriptions, plus validation notes.

**`buildShoppingListMarkdown()`** — missing ingredients grouped by category with checkboxes and annotations showing which meals need each item.

Both build an array of lines and join them. No string interpolation on LLM output — all formatting is in the template code.

## src/index.ts

CLI entry point. Parses `process.argv` into `HarnessOptions`, requires `--input`, prints a banner, and calls `runHarness()`.

## fixtures/

- **`mock-input.json`** — 3-day, 18-item pantry used by dry-run (matches the 3 mock day files)
- **`sample-input.json`** — 7-day, 18-item pantry for live testing
- **`sparse-pantry.json`** — 5-day, 8-item pantry for stressing the shopping list
- **`mock-classify.json`** — pre-built classification of the 18 mock ingredients
- **`mock-generate-day{1,2,3}.json`** — pre-built meal plans per day for dry-run

## Data flow

```
input.json
     ↓
Phase 1: Input         → 01-input.json
     ↓
Phase 2: Classify (LLM)  → 02-classification.json
     ↓
Phase 3: Generate (LLM×N) → 03-meals.json
     ↓
Phase 4: Validate (code)  → 04-validation.json
     ↓
Phase 5: Report (template) → 05-meal-plan.md + 05-shopping-list.md
```
