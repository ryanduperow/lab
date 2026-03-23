import fs from "node:fs";
import type { HarnessInput, HarnessOptions, InputArtifact } from "../types.js";
import { Workspace } from "../harness/workspace.js";

function validateInput(input: HarnessInput): string | null {
  if (!input.pantryItems?.length) return "pantryItems must be a non-empty array";
  if (!input.days || input.days < 1) return "days must be >= 1";
  if (!input.mealsPerDay || input.mealsPerDay < 1) return "mealsPerDay must be >= 1";
  if (!input.mealLabels?.length) return "mealLabels must be a non-empty array";
  if (input.mealLabels.length !== input.mealsPerDay) return "mealLabels length must match mealsPerDay";
  return null;
}

export async function runInputPhase(workspace: Workspace, options: HarnessOptions): Promise<void> {
  console.log(`  Loading input from: ${options.inputFile}`);
  const raw = fs.readFileSync(options.inputFile, "utf-8");
  const input = JSON.parse(raw) as HarnessInput;

  const error = validateInput(input);
  if (error) {
    throw new Error(`Invalid input: ${error}`);
  }

  console.log(`  Pantry: ${input.pantryItems.length} items`);
  console.log(`  Preferences: ${input.dietaryPreferences.length ? input.dietaryPreferences.join(", ") : "none"}`);
  console.log(`  Plan: ${input.days} days, ${input.mealsPerDay} meals/day (${input.mealLabels.join(", ")})`);

  const artifact: InputArtifact = {
    phase: "input",
    timestamp: new Date().toISOString(),
    input,
  };

  workspace.writeArtifact("01-input.json", artifact);
}
