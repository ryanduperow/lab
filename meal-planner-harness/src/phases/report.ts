import type { HarnessOptions, ReportArtifact, MealsArtifact, ValidationArtifact } from "../types.js";
import { Workspace } from "../harness/workspace.js";
import { buildMealPlanMarkdown, buildShoppingListMarkdown } from "../templates/meal-plan.js";

export async function runReportPhase(workspace: Workspace, _options: HarnessOptions): Promise<void> {
  const meals = workspace.readArtifact<MealsArtifact>("03-meals.json");
  const validation = workspace.readArtifact<ValidationArtifact>("04-validation.json");

  const mealPlan = buildMealPlanMarkdown(meals, validation);
  workspace.writeText("05-meal-plan.md", mealPlan);
  console.log("  Generated: 05-meal-plan.md");

  const shoppingList = buildShoppingListMarkdown(validation);
  workspace.writeText("05-shopping-list.md", shoppingList);
  console.log("  Generated: 05-shopping-list.md");

  const artifact: ReportArtifact = {
    phase: "report",
    timestamp: new Date().toISOString(),
    mealPlanPath: workspace.resolve("05-meal-plan.md"),
    shoppingListPath: workspace.resolve("05-shopping-list.md"),
  };

  workspace.writeArtifact("05-report.json", artifact);
}
