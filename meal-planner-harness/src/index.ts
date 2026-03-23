import path from "node:path";
import { fileURLToPath } from "node:url";
import type { HarnessOptions } from "./types.js";
import { runHarness } from "./harness/runner.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");

function parseArgs(argv: string[]): HarnessOptions {
  const options: Partial<HarnessOptions> & { dryRun: boolean; model: string } = {
    dryRun: false,
    workspaceDir: path.join(PROJECT_ROOT, "workspace"),
    fixturesDir: path.join(PROJECT_ROOT, "fixtures"),
    model: "sonnet",
  };

  for (let i = 2; i < argv.length; i++) {
    switch (argv[i]) {
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--input":
        options.inputFile = argv[++i];
        break;
      case "--workspace":
        options.workspaceDir = argv[++i];
        break;
      case "--model":
        options.model = argv[++i];
        break;
      case "--help":
        printUsage();
        process.exit(0);
      default:
        console.error(`Unknown option: ${argv[i]}`);
        printUsage();
        process.exit(1);
    }
  }

  if (!options.inputFile) {
    console.error("Error: --input <file> is required\n");
    printUsage();
    process.exit(1);
  }

  return options as HarnessOptions;
}

function printUsage(): void {
  console.log(`
Usage: node dist/index.js --input <file> [options]

Options:
  --input <file>       Input JSON file with pantry items and preferences (required)
  --dry-run            Use mock LLM responses from fixtures/
  --workspace <dir>    Workspace directory (default: ./workspace)
  --model <model>      Model for LLM calls (default: sonnet)
  --help               Show this help

Examples:
  npm run dry-run                              # Full pipeline with mock data
  npm run sample                               # 7-day plan with real LLM
  npm run sparse-sample                        # Sparse pantry, 5-day plan
  npm start -- --input my-pantry.json          # Custom input file
`.trim());
}

const options = parseArgs(process.argv);

console.log(`
╔══════════════════════════════════════════╗
║        Meal Planner Harness              ║
╚══════════════════════════════════════════╝
`);

runHarness(options).catch((err) => {
  console.error("\nFatal error:", err);
  process.exit(1);
});
