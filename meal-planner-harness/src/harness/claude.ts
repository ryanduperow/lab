import { execFileSync } from "node:child_process";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import type { ClaudeResponse } from "../types.js";

const execFileAsync = promisify(execFile);

export interface ClaudeCallOptions {
  prompt: string;
  jsonSchema?: object;
  systemPrompt?: string;
  model?: string;
}

export interface ClaudeResult {
  result: string;
  structuredOutput?: unknown;
  costUsd: number;
  durationMs: number;
}

function parseResponse(stdout: string): ClaudeResult {
  const response = JSON.parse(stdout) as ClaudeResponse;
  if (response.is_error) {
    throw new Error(`Claude call failed: ${response.result}`);
  }
  return {
    result: response.result,
    structuredOutput: response.structured_output,
    costUsd: response.total_cost_usd,
    durationMs: response.duration_ms,
  };
}

function buildArgs(options: ClaudeCallOptions): string[] {
  const args = [
    "-p", options.prompt,
    "--output-format", "json",
    "--no-session-persistence",
  ];
  if (options.jsonSchema) {
    args.push("--json-schema", JSON.stringify(options.jsonSchema));
  }
  if (options.model) {
    args.push("--model", options.model);
  }
  if (options.systemPrompt) {
    args.push("--system-prompt", options.systemPrompt);
  }
  return args;
}

export function callClaudeSync(options: ClaudeCallOptions): ClaudeResult {
  const args = buildArgs(options);
  const stdout = execFileSync("claude", args, {
    encoding: "utf-8",
    timeout: 120_000,
    maxBuffer: 10 * 1024 * 1024,
  });
  return parseResponse(stdout);
}

export async function callClaudeAsync(options: ClaudeCallOptions): Promise<ClaudeResult> {
  const args = buildArgs(options);
  const { stdout } = await execFileAsync("claude", args, {
    encoding: "utf-8",
    timeout: 120_000,
    maxBuffer: 10 * 1024 * 1024,
  });
  return parseResponse(stdout);
}

export function loadMock(mockFile: string): ClaudeResult {
  const data = JSON.parse(fs.readFileSync(mockFile, "utf-8"));
  return {
    result: JSON.stringify(data),
    structuredOutput: data,
    costUsd: 0,
    durationMs: 0,
  };
}

export async function callWithRetry(
  callFn: () => Promise<ClaudeResult> | ClaudeResult,
  validate: (result: ClaudeResult) => string | null,
  maxAttempts = 2,
): Promise<ClaudeResult> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await callFn();
    const error = validate(result);
    if (!error) return result;
    if (attempt === maxAttempts) {
      throw new Error(`Validation failed after ${maxAttempts} attempts: ${error}`);
    }
    console.log(`  Retry ${attempt}/${maxAttempts}: ${error}`);
  }
  throw new Error("Unreachable");
}
