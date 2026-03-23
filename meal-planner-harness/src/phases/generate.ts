import path from "node:path";
import type {
  ClassificationArtifact,
  DayPlan,
  HarnessOptions,
  InputArtifact,
  Meal,
  MealsArtifact,
} from "../types.js";
import { Workspace } from "../harness/workspace.js";
import { callClaudeAsync, loadMock } from "../harness/claude.js";

const MEAL_SCHEMA = {
  type: "object",
  properties: {
    meals: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          name: { type: "string" },
          ingredients: { type: "array", items: { type: "string" } },
          briefDescription: { type: "string" },
        },
        required: ["label", "name", "ingredients", "briefDescription"],
      },
    },
  },
  required: ["meals"],
};

function buildPrompt(
  day: number,
  totalDays: number,
  mealLabels: string[],
  ingredients: string,
  preferences: string[],
): string {
  const prefText = preferences.length ? `Dietary restrictions: ${preferences.join(", ")}` : "No dietary restrictions.";
  return `Plan meals for Day ${day} of ${totalDays}.

Available ingredients:
${ingredients}

${prefText}

Create exactly ${mealLabels.length} meal(s) with these labels: ${mealLabels.join(", ")}.
Use ingredients from the available list as the foundation, but feel free to include additional ingredients that would make the meals better — the shopping list will catch anything not already in the pantry.
Focus on practical, home-cooked meals. Vary the protein and cooking style across meals.
Day ${day} should feel distinct from other days — vary cuisines and techniques.`;
}

const SYSTEM_PROMPT = "You are a practical home meal planner. Create simple, delicious meals built around the available ingredients. You can suggest additional ingredients beyond what's listed — a good meal sometimes needs a few extra items. Keep descriptions to one sentence.";

async function generateDay(
  day: number,
  totalDays: number,
  mealLabels: string[],
  ingredientList: string,
  preferences: string[],
  options: HarnessOptions,
): Promise<DayPlan> {
  const prompt = buildPrompt(day, totalDays, mealLabels, ingredientList, preferences);

  let result;
  if (options.dryRun) {
    result = loadMock(path.join(options.fixturesDir, `mock-generate-day${day}.json`));
  } else {
    result = await callClaudeAsync({
      prompt,
      systemPrompt: SYSTEM_PROMPT,
      jsonSchema: MEAL_SCHEMA,
      model: options.model,
    });
  }

  const data = result.structuredOutput as { meals: Meal[] };

  if (!options.dryRun) {
    console.log(`  Day ${day}: done ($${result.costUsd.toFixed(4)}, ${(result.durationMs / 1000).toFixed(1)}s)`);
  } else {
    console.log(`  Day ${day}: done (mock)`);
  }

  return { day, meals: data.meals };
}

export async function runGeneratePhase(workspace: Workspace, options: HarnessOptions): Promise<void> {
  const { input } = workspace.readArtifact<InputArtifact>("01-input.json");
  const classification = workspace.readArtifact<ClassificationArtifact>("02-classification.json");

  const ingredientList = classification.ingredients
    .map((i) => `- ${i.name} (${i.quantity}) [${i.category}]`)
    .join("\n");

  console.log(`  Generating meals for ${input.days} days (parallel sub-agents)...`);

  const dayPromises = Array.from({ length: input.days }, (_, i) =>
    generateDay(
      i + 1,
      input.days,
      input.mealLabels,
      ingredientList,
      input.dietaryPreferences,
      options,
    ),
  );

  const days = await Promise.all(dayPromises);
  days.sort((a, b) => a.day - b.day);

  const artifact: MealsArtifact = {
    phase: "meals",
    timestamp: new Date().toISOString(),
    days,
  };

  workspace.writeArtifact("03-meals.json", artifact);
}
