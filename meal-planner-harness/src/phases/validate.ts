import type {
  ClassificationArtifact,
  HarnessOptions,
  MealsArtifact,
  ShoppingItem,
  ValidationArtifact,
  ValidationIssue,
  InputArtifact,
  IngredientCategory,
} from "../types.js";
import { Workspace } from "../harness/workspace.js";

function normalize(s: string): string {
  return s.toLowerCase().trim();
}

export async function runValidatePhase(workspace: Workspace, _options: HarnessOptions): Promise<void> {
  const { input } = workspace.readArtifact<InputArtifact>("01-input.json");
  const classification = workspace.readArtifact<ClassificationArtifact>("02-classification.json");
  const meals = workspace.readArtifact<MealsArtifact>("03-meals.json");

  const issues: ValidationIssue[] = [];
  const pantryNames = new Set(classification.ingredients.map((i) => normalize(i.name)));
  const categoryMap = new Map(classification.ingredients.map((i) => [normalize(i.name), i.category]));

  // Check 1: Meal count per day
  for (const day of meals.days) {
    if (day.meals.length !== input.mealsPerDay) {
      issues.push({
        severity: "error",
        message: `Day ${day.day} has ${day.meals.length} meals, expected ${input.mealsPerDay}`,
        day: day.day,
      });
    }
  }

  // Check 2: No duplicate main proteins on consecutive days
  function getDayProteins(dayIndex: number): string[] {
    const day = meals.days[dayIndex];
    const proteins: string[] = [];
    for (const meal of day.meals) {
      for (const ing of meal.ingredients) {
        if (categoryMap.get(normalize(ing)) === "protein") {
          proteins.push(normalize(ing));
        }
      }
    }
    return [...new Set(proteins)];
  }

  for (let i = 0; i < meals.days.length - 1; i++) {
    const todayProteins = getDayProteins(i);
    const tomorrowProteins = getDayProteins(i + 1);
    const overlap = todayProteins.filter((p) => tomorrowProteins.includes(p));
    if (overlap.length > 0) {
      issues.push({
        severity: "warning",
        message: `Days ${i + 1} and ${i + 2} share protein: ${overlap.join(", ")}`,
        day: i + 1,
      });
    }
  }

  // Check 3: Dietary compliance
  const meatKeywords = ["chicken", "beef", "pork", "turkey", "lamb", "bacon", "sausage", "ham", "steak", "ground beef"];
  const fishKeywords = ["fish", "salmon", "tuna", "shrimp", "cod", "tilapia", "shellfish", "crab", "lobster"];
  const isVegetarian = input.dietaryPreferences.some((p) => normalize(p).includes("vegetarian"));
  const noShellfish = input.dietaryPreferences.some((p) => normalize(p).includes("shellfish"));

  for (const day of meals.days) {
    for (const meal of day.meals) {
      for (const ing of meal.ingredients) {
        const ingLower = normalize(ing);
        if (isVegetarian) {
          if (meatKeywords.some((k) => ingLower.includes(k)) || fishKeywords.some((k) => ingLower.includes(k))) {
            issues.push({
              severity: "error",
              message: `"${ing}" in ${meal.name} violates vegetarian preference`,
              day: day.day,
              meal: meal.label,
            });
          }
        }
        if (noShellfish && fishKeywords.filter((k) => ["shrimp", "crab", "lobster", "shellfish"].includes(k)).some((k) => ingLower.includes(k))) {
          issues.push({
            severity: "error",
            message: `"${ing}" in ${meal.name} violates no-shellfish preference`,
            day: day.day,
            meal: meal.label,
          });
        }
      }
    }
  }

  // Check 4: Shopping list — ingredients used but not in pantry
  const shoppingMap = new Map<string, { category: IngredientCategory; neededFor: Set<string> }>();
  const commonStaples = new Set(["salt", "pepper", "water", "ice"]);

  for (const day of meals.days) {
    for (const meal of day.meals) {
      for (const ing of meal.ingredients) {
        const ingLower = normalize(ing);
        if (commonStaples.has(ingLower)) continue;
        if (!pantryNames.has(ingLower)) {
          const existing = shoppingMap.get(ingLower);
          if (existing) {
            existing.neededFor.add(`Day ${day.day} ${meal.label}`);
          } else {
            shoppingMap.set(ingLower, {
              category: categoryMap.get(ingLower) ?? "other",
              neededFor: new Set([`Day ${day.day} ${meal.label}`]),
            });
          }
        }
      }
    }
  }

  // Check 5: Pantry consumption — flag ingredients used more times than plausibly available
  const usageCount = new Map<string, number>();
  for (const day of meals.days) {
    for (const meal of day.meals) {
      for (const ing of meal.ingredients) {
        const ingLower = normalize(ing);
        if (commonStaples.has(ingLower)) continue;
        if (pantryNames.has(ingLower)) {
          usageCount.set(ingLower, (usageCount.get(ingLower) ?? 0) + 1);
        }
      }
    }
  }

  const pantryQuantityMap = new Map(input.pantryItems.map((i) => [normalize(i.name), i.quantity]));
  for (const [name, count] of usageCount) {
    const quantity = pantryQuantityMap.get(name) ?? "unknown";
    const bulkIndicators = ["bottle", "bag", "box", "pack", "head", "dozen", "loaf"];
    const isBulk = bulkIndicators.some((b) => quantity.toLowerCase().includes(b));
    const threshold = isBulk ? meals.days.length * 2 : meals.days.length;
    if (count > threshold) {
      issues.push({
        severity: "warning",
        message: `"${name}" (${quantity}) used in ${count} meals across ${meals.days.length} days — may run out`,
      });
    }

    const numMatch = quantity.match(/^(\d+)\s/);
    if (numMatch) {
      const available = parseInt(numMatch[1], 10);
      if (available <= 12 && !isBulk && count > available) {
        issues.push({
          severity: "warning",
          message: `"${name}" — have ${quantity} but used in ${count} meals (likely need more)`,
        });
        const existing = shoppingMap.get(name);
        if (!existing) {
          shoppingMap.set(name, {
            category: categoryMap.get(name) ?? "other",
            neededFor: new Set([`Need more — have ${quantity}, used ${count}x`]),
          });
        }
      }
    }
  }

  const shoppingList: ShoppingItem[] = [...shoppingMap.entries()].map(([name, info]) => ({
    name,
    category: info.category,
    neededFor: [...info.neededFor],
  }));

  // Check 6: Variety score
  const allMealNames = meals.days.flatMap((d) => d.meals.map((m) => normalize(m.name)));
  const uniqueNames = new Set(allMealNames);
  const varietyScore = Math.round((uniqueNames.size / allMealNames.length) * 100);

  if (varietyScore < 70) {
    issues.push({
      severity: "warning",
      message: `Low variety score: ${varietyScore}% (${uniqueNames.size} unique meals out of ${allMealNames.length})`,
    });
  }

  const passed = !issues.some((i) => i.severity === "error");

  console.log(`  Variety score: ${varietyScore}%`);
  console.log(`  Shopping items needed: ${shoppingList.length}`);
  console.log(`  Issues: ${issues.filter((i) => i.severity === "error").length} errors, ${issues.filter((i) => i.severity === "warning").length} warnings`);
  console.log(`  Result: ${passed ? "PASSED" : "FAILED"}`);

  if (issues.length > 0) {
    for (const issue of issues) {
      const prefix = issue.severity === "error" ? "  ✗" : "  ⚠";
      console.log(`${prefix} ${issue.message}`);
    }
  }

  const artifact: ValidationArtifact = {
    phase: "validation",
    timestamp: new Date().toISOString(),
    passed,
    issues,
    varietyScore,
    shoppingList,
  };

  workspace.writeArtifact("04-validation.json", artifact);
}
