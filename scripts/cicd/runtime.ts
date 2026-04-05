import process from "node:process";
import { createInterface } from "node:readline/promises";

export type Command = readonly [string, ...string[]];

export interface ReleaseCommandOptions {
  cwd?: string;
}

export interface ReleaseStep {
  command: Command;
  label: string;
}

interface CommandResult {
  durationInMilliseconds: number;
  exitCode: number;
  stderr: string;
  stdout: string;
}

type OutputMode = "capture" | "inherit";

export class ReleaseWorkflowError extends Error {
  readonly exitCode: number;

  constructor(message: string, exitCode = 1) {
    super(message);
    this.exitCode = exitCode;
    this.name = "ReleaseWorkflowError";
  }
}

/**
 * Prompt for explicit confirmation before mutating repository state.
 */
export async function askYesNo(question: string): Promise<boolean> {
  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const answer = await readline.question(question);
    const normalizedAnswer = answer.trim().toLowerCase();
    return normalizedAnswer === "y" || normalizedAnswer === "yes";
  } finally {
    readline.close();
  }
}

/**
 * Fail the workflow immediately with a deterministic error message.
 */
export function failRelease(message: string): never {
  logRelease(message);
  throw new ReleaseWorkflowError(message);
}

/**
 * Emit a consistent CI/CD log line that is easy to scan in terminal output.
 */
export function logRelease(message: string): void {
  console.info(`[cicd] ${message}`);
}

/**
 * Spawn a command with either inherited stdio for operator-facing steps or
 * captured output for git-state validation.
 */
export async function runCommand(
  command: Command,
  outputMode: OutputMode = "inherit",
  options?: ReleaseCommandOptions,
): Promise<CommandResult> {
  const [executable, ...arguments_] = command;
  const startedAt = Date.now();
  const shouldCaptureOutput = outputMode === "capture";
  const child = Bun.spawn([executable, ...arguments_], {
    cwd: options?.cwd ?? process.cwd(),
    env: process.env,
    stderr: shouldCaptureOutput ? "pipe" : "inherit",
    stdin: shouldCaptureOutput ? "ignore" : "inherit",
    stdout: shouldCaptureOutput ? "pipe" : "inherit",
  });

  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    shouldCaptureOutput ? readProcessStream(child.stdout) : Promise.resolve(""),
    shouldCaptureOutput ? readProcessStream(child.stderr) : Promise.resolve(""),
  ]);

  return {
    durationInMilliseconds: Date.now() - startedAt,
    exitCode,
    stderr,
    stdout,
  };
}

/**
 * Run a workflow step and terminate the process immediately when it fails.
 */
export async function runStepOrExit(
  step: ReleaseStep,
  options?: ReleaseCommandOptions,
): Promise<void> {
  logRelease(`Starting: ${step.label}`);

  const result = await runCommand(step.command, "inherit", options);
  if (result.exitCode !== 0) {
    logRelease(
      `Failed: ${step.label} (exit code ${result.exitCode} after ${result.durationInMilliseconds}ms)`,
    );
    throw new ReleaseWorkflowError(step.label, result.exitCode);
  }

  logRelease(`Completed: ${step.label} (${result.durationInMilliseconds}ms)`);
}

/**
 * Resolve a process stream into text when a command is executed in capture mode.
 */
async function readProcessStream(
  stream: null | ReadableStream<Uint8Array> | undefined,
): Promise<string> {
  if (stream === undefined || stream === null) {
    return "";
  }

  return await new Response(stream).text();
}
