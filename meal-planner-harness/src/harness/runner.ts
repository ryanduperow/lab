import type { HarnessOptions } from "../types.js";
import { Workspace } from "./workspace.js";
import { runInputPhase } from "../phases/input.js";
import { runClassifyPhase } from "../phases/classify.js";
import { runGeneratePhase } from "../phases/generate.js";
import { runValidatePhase } from "../phases/validate.js";
import { runReportPhase } from "../phases/report.js";

interface PhaseDefinition {
  name: string;
  label: string;
  artifactFile: string;
  execute: (workspace: Workspace, options: HarnessOptions) => Promise<void>;
}

const PHASES: PhaseDefinition[] = [
  { name: "input", label: "Input Collection", artifactFile: "01-input.json", execute: runInputPhase },
  { name: "classification", label: "Ingredient Classification", artifactFile: "02-classification.json", execute: runClassifyPhase },
  { name: "meals", label: "Meal Generation", artifactFile: "03-meals.json", execute: runGeneratePhase },
  { name: "validation", label: "Validation", artifactFile: "04-validation.json", execute: runValidatePhase },
  { name: "report", label: "Report Generation", artifactFile: "05-report.json", execute: runReportPhase },
];

function printBanner(phaseNum: number, total: number, label: string): void {
  console.log(`\n${"═".repeat(50)}`);
  console.log(`  Phase ${phaseNum}/${total}: ${label}`);
  console.log(`${"═".repeat(50)}`);
}

export async function runHarness(options: HarnessOptions): Promise<void> {
  const workspace = new Workspace(options.workspaceDir);

  console.log(`Mode: ${options.dryRun ? "DRY RUN (mock LLM responses)" : "LIVE (real LLM calls)"}`);
  console.log(`Model: ${options.model}`);
  console.log(`Workspace: ${options.workspaceDir}`);

  for (let i = 0; i < PHASES.length; i++) {
    const phase = PHASES[i];
    printBanner(i + 1, PHASES.length, phase.label);

    try {
      await phase.execute(workspace, options);
      console.log(`✓ Phase complete → ${phase.artifactFile}`);
    } catch (err) {
      console.error(`\n✗ Phase "${phase.label}" failed: ${err}`);
      process.exit(1);
    }
  }

  console.log(`\n${"═".repeat(50)}`);
  console.log("  Harness complete!");
  console.log(`${"═".repeat(50)}`);
  console.log(`\nOutputs:`);
  console.log(`  Meal plan:     ${workspace.resolve("05-meal-plan.md")}`);
  console.log(`  Shopping list:  ${workspace.resolve("05-shopping-list.md")}`);
}
