import type { Command } from "@/types/index.ts";

const MAX_PROCESS_ARGUMENT_LENGTH = 100_000;
const SECRETLINT_FILE_ARGS = [
  "secretlint",
  "--no-glob",
  "--secretlintignore",
  ".secretlintignore",
] as const;

export function buildCommand(
  exitCode: number,
  output: string,
  startedAt: number,
): Command {
  return {
    durationMs: Date.now() - startedAt,
    exitCode,
    output,
    timedOut: false,
  };
}

export function chunkPaths(paths: readonly string[]): string[][] {
  const batches: string[][] = [];
  let currentBatch: string[] = [];
  let currentLength = getArgumentLength(SECRETLINT_FILE_ARGS);

  for (const path of paths) {
    const pathLength = path.length + 1;
    if (
      currentBatch.length > 0 &&
      currentLength + pathLength > MAX_PROCESS_ARGUMENT_LENGTH
    ) {
      batches.push(currentBatch);
      currentBatch = [];
      currentLength = getArgumentLength(SECRETLINT_FILE_ARGS);
    }

    currentBatch.push(path);
    currentLength += pathLength;
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}

export function joinOutputs(outputs: readonly string[]): string {
  return outputs.length === 0 ? "" : `${outputs.join("\n\n")}\n`;
}

export function runBufferedCommand(
  cwd: string,
  command: string,
  arguments_: string[],
): { exitCode: number; output: string } {
  const result = Bun.spawnSync([command, ...arguments_], {
    cwd,
    stderr: "pipe",
    stdin: "ignore",
    stdout: "pipe",
  });

  return {
    exitCode: result.exitCode ?? 1,
    output: `${result.stdout.toString("utf8")}${result.stderr.toString("utf8")}`,
  };
}

export function runSecretlintBatches(
  cwd: string,
  paths: readonly string[],
  startedAt: number,
): Command {
  const outputParts: string[] = [];
  let finalExitCode = 0;

  for (const batch of chunkPaths(paths)) {
    const result = runBufferedCommand(cwd, "bunx", [
      ...SECRETLINT_FILE_ARGS,
      ...batch,
    ]);

    if (result.output.trim().length > 0) {
      outputParts.push(result.output.trimEnd());
    }

    if (result.exitCode === 0) {
      continue;
    }

    if (result.exitCode === 1) {
      finalExitCode = 1;
      continue;
    }

    return buildCommand(result.exitCode, joinOutputs(outputParts), startedAt);
  }

  return buildCommand(finalExitCode, joinOutputs(outputParts), startedAt);
}

function getArgumentLength(arguments_: readonly string[]): number {
  return arguments_.reduce(
    (totalLength, argument) => totalLength + argument.length + 1,
    0,
  );
}
