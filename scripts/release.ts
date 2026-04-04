/// <reference types="bun" />

import process from "node:process";
import { createInterface } from "node:readline/promises";

type Command = readonly [string, ...string[]];

interface CommandResult {
  durationInMilliseconds: number;
  exitCode: number;
}

interface ReleaseStep {
  command: Command;
  label: string;
}

/**
 * Emit a consistent release log line that is easy to scan in CI output.
 */
function logRelease(message: string): void {
  console.info(`[release] ${message}`);
}

/**
 * Run the release dry-run workflow only after the suite passes.
 *
 * The sequence intentionally mirrors the requested shell flow and exits
 * immediately on the first failing command.
 */
async function main(): Promise<void> {
  const validationSteps: readonly ReleaseStep[] = [
    {
      command: ["bun", "run", "check-suite"],
      label: "Run check-suite",
    },
    {
      command: ["git", "checkout", "main"],
      label: "Switch to main branch",
    },
    {
      command: ["git", "pull", "--ff-only", "origin", "main"],
      label: "Fast-forward main from origin",
    },
    {
      command: ["semantic-release", "--no-ci", "--dry-run"],
      label: "Run semantic-release dry-run",
    },
  ];

  for (const step of validationSteps) {
    await runStepOrExit(step);
  }

  if (!(await shouldProceedWithRelease())) {
    logRelease("Release cancelled by user.");
    return;
  }

  await runStepOrExit({
    command: ["semantic-release", "--no-ci"],
    label: "Run semantic-release",
  });
}

/**
 * Spawn a command with inherited stdio so the CI transcript matches the
 * equivalent shell script.
 */
async function runCommand(command: Command): Promise<CommandResult> {
  const [executable, ...arguments_] = command;
  const startedAt = Date.now();
  const child = Bun.spawn([executable, ...arguments_], {
    cwd: process.cwd(),
    env: process.env,
    stderr: "inherit",
    stdin: "inherit",
    stdout: "inherit",
  });

  const exitCode = await child.exited;
  return {
    durationInMilliseconds: Date.now() - startedAt,
    exitCode,
  };
}

/**
 * Run a release step and terminate the process immediately when it fails.
 */
async function runStepOrExit(step: ReleaseStep): Promise<void> {
  logRelease(`Starting: ${step.label}`);

  const result = await runCommand(step.command);
  if (result.exitCode !== 0) {
    logRelease(
      `Failed: ${step.label} (exit code ${result.exitCode} after ${result.durationInMilliseconds}ms)`,
    );
    process.exit(result.exitCode);
  }

  logRelease(`Completed: ${step.label} (${result.durationInMilliseconds}ms)`);
}

/**
 * Prompt for explicit confirmation before running the real release command.
 */
async function shouldProceedWithRelease(): Promise<boolean> {
  logRelease("Dry-run checks completed.");

  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const answer = await readline.question("Proceed? (y/n) ");
    const normalizedAnswer = answer.trim().toLowerCase();
    return normalizedAnswer === "y" || normalizedAnswer === "yes";
  } finally {
    readline.close();
  }
}

await main();
