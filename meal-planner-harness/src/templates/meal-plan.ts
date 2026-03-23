import type { MealsArtifact, ValidationArtifact, ShoppingItem, IngredientCategory } from "../types.js";

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function buildMealPlanMarkdown(meals: MealsArtifact, validation: ValidationArtifact): string {
  const lines: string[] = [];
  const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const totalMeals = meals.days.reduce((sum, d) => sum + d.meals.length, 0);

  lines.push("# Meal Plan");
  lines.push("");
  lines.push(`Generated: ${date}`);
  lines.push(`Days: ${meals.days.length} | Meals: ${totalMeals} | Variety: ${validation.varietyScore}%`);
  lines.push("");

  for (const day of meals.days) {
    const dayName = DAY_NAMES[(day.day - 1) % 7];
    lines.push("---");
    lines.push("");
    lines.push(`## Day ${day.day} — ${dayName}`);
    lines.push("");

    for (const meal of day.meals) {
      lines.push(`### ${capitalize(meal.label)}: ${meal.name}`);
      lines.push("");
      lines.push(`**Ingredients:** ${meal.ingredients.join(", ")}`);
      lines.push("");
      lines.push(`> ${meal.briefDescription}`);
      lines.push("");
    }
  }

  if (validation.issues.length > 0) {
    lines.push("---");
    lines.push("");
    lines.push("## Validation Notes");
    lines.push("");
    for (const issue of validation.issues) {
      const icon = issue.severity === "error" ? "x" : "!";
      lines.push(`- [${icon}] ${issue.message}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

export function buildShoppingListMarkdown(validation: ValidationArtifact): string {
  const lines: string[] = [];
  const { shoppingList } = validation;

  lines.push("# Shopping List");
  lines.push("");

  if (shoppingList.length === 0) {
    lines.push("Everything you need is already in your pantry!");
    return lines.join("\n");
  }

  lines.push(`${shoppingList.length} item(s) needed for this meal plan.`);
  lines.push("");

  const grouped = new Map<IngredientCategory, ShoppingItem[]>();
  for (const item of shoppingList) {
    const list = grouped.get(item.category) ?? [];
    list.push(item);
    grouped.set(item.category, list);
  }

  const categoryOrder: IngredientCategory[] = [
    "protein", "vegetable", "fruit", "grain", "dairy", "fat", "spice", "condiment", "other",
  ];

  for (const cat of categoryOrder) {
    const items = grouped.get(cat);
    if (!items) continue;
    lines.push(`## ${capitalize(cat)}`);
    lines.push("");
    for (const item of items) {
      lines.push(`- [ ] ${item.name} _(${item.neededFor.join(", ")})_`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
