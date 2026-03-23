import path from "node:path";
import type { ClassificationArtifact, ClassifiedIngredient, HarnessOptions, InputArtifact } from "../types.js";
import { Workspace } from "../harness/workspace.js";
import { callClaudeSync, callWithRetry, loadMock } from "../harness/claude.js";

const CLASSIFICATION_SCHEMA = {
  type: "object",
  properties: {
    ingredients: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          quantity: { type: "string" },
          category: {
            type: "string",
            enum: ["protein", "grain", "vegetable", "fruit", "dairy", "fat", "spice", "condiment", "other"],
          },
        },
        required: ["name", "quantity", "category"],
      },
    },
  },
  required: ["ingredients"],
};

const SYSTEM_PROMPT = `You are a food ingredient classification system. Classify each ingredient into exactly one category. Preserve the original name and quantity exactly as provided. Categories:
- protein: meat, poultry, fish, eggs, tofu, legumes/beans
- grain: rice, pasta, bread, tortillas, oats, flour
- vegetable: any vegetable or leafy green
- fruit: any fruit
- dairy: milk, cheese, butter, yogurt, cream
- fat: cooking oils, lard
- spice: herbs, spices, salt, pepper
- condiment: sauces, vinegars, dressings
- other: anything that doesn't fit above`;

export async function runClassifyPhase(workspace: Workspace, options: HarnessOptions): Promise<void> {
  const { input } = workspace.readArtifact<InputArtifact>("01-input.json");

  const itemList = input.pantryItems
    .map((item) => `- ${item.name} (${item.quantity})`)
    .join("\n");

  const prompt = `Classify these pantry items:\n${itemList}`;
  const expectedNames = new Set(input.pantryItems.map((i) => i.name.toLowerCase()));

  const result = await callWithRetry(
    () => {
      if (options.dryRun) {
        return loadMock(path.join(options.fixturesDir, "mock-classify.json"));
      }
      return callClaudeSync({
        prompt,
        systemPrompt: SYSTEM_PROMPT,
        jsonSchema: CLASSIFICATION_SCHEMA,
        model: options.model,
      });
    },
    (res) => {
      const data = res.structuredOutput as { ingredients: ClassifiedIngredient[] } | undefined;
      if (!data?.ingredients) return "Missing ingredients array in response";
      const returnedNames = new Set(data.ingredients.map((i) => i.name.toLowerCase()));
      const missing = [...expectedNames].filter((n) => !returnedNames.has(n));
      if (missing.length > 0) return `Missing items: ${missing.join(", ")}`;
      return null;
    },
  );

  const data = result.structuredOutput as { ingredients: ClassifiedIngredient[] };
  console.log(`  Classified ${data.ingredients.length} ingredients`);
  if (!options.dryRun) {
    console.log(`  Cost: $${result.costUsd.toFixed(4)} | Time: ${(result.durationMs / 1000).toFixed(1)}s`);
  }

  const artifact: ClassificationArtifact = {
    phase: "classification",
    timestamp: new Date().toISOString(),
    ingredients: data.ingredients,
  };

  workspace.writeArtifact("02-classification.json", artifact);
}
