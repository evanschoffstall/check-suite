import type {
  Command,
  InlineTypeScriptContext,
  StepConfig,
} from "@/types/index.ts";

const GIT_VISIBLE_FILES_ARGS = [
  "ls-files",
  "--cached",
  "--others",
  "--exclude-standard",
  "--full-name",
  "--",
  ".",
] as const;
const MAX_PROCESS_ARGUMENT_LENGTH = 100_000;
const NO_VISIBLE_FILES_OUTPUT =
  "No tracked or non-ignored files matched for secretlint\n";
const SECRETLINT_FILE_ARGS = [
  "secretlint",
  "--no-glob",
  "--secretlintignore",
  ".secretlintignore",
] as const;
const SECRETLINT_GLOB_ARGS = [
  "secretlint",
  "**/*",
  "--secretlintignore",
  ".secretlintignore",
] as const;

type GitVisibleFiles =
  | { exitCode: number; kind: "failure"; output: string }
  | { kind: "fallback" }
  | { kind: "resolved"; paths: string[] };

/** Secret scanning powered by Secretlint. */
export const secretlintStep: StepConfig = {
  config: {
    source: runSecretlintStep,
  },
  enabled: true,
  failMsg: "secretlint failed",
  handler: "inline-ts",
  key: "secretlint",
  label: "secretlint",
  passMsg: "",
  summary: {
    type: "simple",
  },
};

function buildCommand(
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

function chunkPaths(paths: readonly string[]): string[][] {
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

function getArgumentLength(arguments_: readonly string[]): number {
  return arguments_.reduce(
    (totalLength, argument) => totalLength + argument.length + 1,
    0,
  );
}

function joinOutputs(outputs: readonly string[]): string {
  return outputs.length === 0 ? "" : `${outputs.join("\n\n")}\n`;
}

function parseFileList(output: string): string[] {
  return output
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function resolveGitVisibleFiles(cwd: string): GitVisibleFiles {
  const result = runBufferedCommand(cwd, "git", [...GIT_VISIBLE_FILES_ARGS]);

  if (result.exitCode === 0) {
    return { kind: "resolved", paths: parseFileList(result.output) };
  }

  if (/not a git repository/i.test(result.output)) {
    return { kind: "fallback" };
  }

  return { exitCode: result.exitCode, kind: "failure", output: result.output };
}

function runBufferedCommand(
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

function runSecretlintBatches(
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

async function runSecretlintStep({
  cwd,
}: InlineTypeScriptContext): Promise<Command> {
  const startedAt = Date.now();
  const gitVisibleFiles = resolveGitVisibleFiles(cwd);

  if (gitVisibleFiles.kind === "failure") {
    return buildCommand(
      gitVisibleFiles.exitCode,
      gitVisibleFiles.output,
      startedAt,
    );
  }

  if (gitVisibleFiles.kind === "fallback") {
    const result = runBufferedCommand(cwd, "bunx", [...SECRETLINT_GLOB_ARGS]);
    return buildCommand(result.exitCode, result.output, startedAt);
  }

  if (gitVisibleFiles.paths.length === 0) {
    return buildCommand(0, NO_VISIBLE_FILES_OUTPUT, startedAt);
  }

  return runSecretlintBatches(cwd, gitVisibleFiles.paths, startedAt);
}
