# meal-planner-harness

## What it proves

A deterministic harness wrapping LLM calls in code-controlled phases — demonstrating that reliability comes from the scaffolding, not from hoping the AI follows instructions. Uses Claude Code CLI (`claude -p`) as the LLM layer with zero API keys or SDKs.

## Concepts involved

- Harness engineering — deterministic code wrapping non-deterministic LLM calls
- Phase-based pipeline with artifact persistence (each phase reads/writes JSON)
- Parallel sub-agents via `Promise.all` on `claude -p` subprocess calls
- Context isolation — each LLM call gets its own subprocess with a scoped system prompt
- Structured output via `--json-schema` flag for validated JSON responses
- Validation loops — retry LLM calls that produce incomplete output
- Deterministic validation — code checks dietary compliance, protein variety, pantry consumption
- Dry-run mode with mock fixtures for token-free iteration
- Template-based deterministic output (the LLM never touches the final format)

## Mental model

A "skill" is a markdown file that tells an AI what to do and hopes it follows every step. A "harness" is code that guarantees the workflow runs correctly — the AI is just one component called at specific points with controlled inputs and validated outputs.

The key insight is that LLMs are unreliable at following multi-step procedures, but excellent at narrow, well-scoped tasks. A harness exploits this by breaking a complex workflow into phases where code handles orchestration and output formatting, while the LLM handles only classification and creative generation within tight constraints.

Claude Code's `-p` (print) mode makes each LLM call a fresh, isolated subprocess. The `--json-schema` flag forces structured output. The harness controls everything else.

## How to run

### Prerequisites

- Node.js 18+
- Claude Code CLI (`claude` on PATH), authenticated via `claude login`

### Install and build

```bash
cd meal-planner-harness
npm install
npm run build
```

### Dry-run (mock LLM, zero tokens)

Uses a 3-day mock input and pre-built mock responses — exercises the full pipeline without any LLM calls:

```bash
npm run dry-run
```

### Live run with sample input (7 days, full pantry)

```bash
npm run sample
```

### Live run with sparse pantry (5 days, 8 items)

Demonstrates the shopping list and consumption warnings:

```bash
npm run sparse-sample
```

### Custom input file

```bash
npm start -- --input my-pantry.json
```

### All options

```
--input <file>       Input JSON file with pantry items and preferences (required)
--dry-run            Use mock LLM responses from fixtures/
--workspace <dir>    Workspace directory (default: ./workspace)
--model <model>      Model for LLM calls (default: sonnet)
```

### Input file format

```json
{
  "pantryItems": [
    { "name": "chicken breast", "quantity": "2 lbs" },
    { "name": "rice", "quantity": "3 cups" }
  ],
  "dietaryPreferences": ["no shellfish"],
  "days": 3,
  "mealsPerDay": 3,
  "mealLabels": ["breakfast", "lunch", "dinner"]
}
```

## Harness phases

| # | Phase | LLM? | What it does |
|---|-------|------|-------------|
| 1 | Input | No | Loads and validates pantry items + preferences from JSON file |
| 2 | Classification | Single call | Classifies each ingredient into a category (protein, grain, vegetable, etc.) |
| 3 | Meal Generation | Parallel calls | One `claude -p` subprocess per day, all run concurrently |
| 4 | Validation | No | Checks protein variety, dietary compliance, pantry consumption, builds shopping list |
| 5 | Report | No | Generates meal plan + shopping list from deterministic templates |

## Interactive explanation

- [explain-harness-engineering.html](explain-harness-engineering.html) — Tabbed visualization covering skills vs harnesses (with reliability calculator), the phase pipeline, parallel sub-agents, validation loops, and the code-vs-LLM responsibility split

## Lessons learned

_Fill in after running live._
