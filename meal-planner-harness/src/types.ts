// --- Input types ---

export interface PantryItem {
  name: string;
  quantity: string;
}

export interface HarnessInput {
  pantryItems: PantryItem[];
  dietaryPreferences: string[];
  days: number;
  mealsPerDay: number;
  mealLabels: string[];
}

// --- Phase 1 artifact ---

export interface InputArtifact {
  phase: "input";
  timestamp: string;
  input: HarnessInput;
}

// --- Phase 2 artifact ---

export type IngredientCategory =
  | "protein"
  | "grain"
  | "vegetable"
  | "fruit"
  | "dairy"
  | "fat"
  | "spice"
  | "condiment"
  | "other";

export interface ClassifiedIngredient {
  name: string;
  quantity: string;
  category: IngredientCategory;
}

export interface ClassificationArtifact {
  phase: "classification";
  timestamp: string;
  ingredients: ClassifiedIngredient[];
}

// --- Phase 3 artifact ---

export interface Meal {
  label: string;
  name: string;
  ingredients: string[];
  briefDescription: string;
}

export interface DayPlan {
  day: number;
  meals: Meal[];
}

export interface MealsArtifact {
  phase: "meals";
  timestamp: string;
  days: DayPlan[];
}

// --- Phase 4 artifact ---

export interface ValidationIssue {
  severity: "error" | "warning";
  message: string;
  day?: number;
  meal?: string;
}

export interface ValidationArtifact {
  phase: "validation";
  timestamp: string;
  passed: boolean;
  issues: ValidationIssue[];
  varietyScore: number;
  shoppingList: ShoppingItem[];
}

export interface ShoppingItem {
  name: string;
  category: IngredientCategory;
  neededFor: string[];
}

// --- Phase 5 artifact ---

export interface ReportArtifact {
  phase: "report";
  timestamp: string;
  mealPlanPath: string;
  shoppingListPath: string;
}

// --- Claude CLI response shape ---

export interface ClaudeResponse {
  result: string;
  is_error: boolean;
  total_cost_usd: number;
  duration_ms: number;
  structured_output?: unknown;
}

// --- Harness options ---

export interface HarnessOptions {
  dryRun: boolean;
  inputFile: string;
  workspaceDir: string;
  fixturesDir: string;
  model: string;
}
