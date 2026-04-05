import type { Command } from "@/types/index.ts";

const MAX_DEFAULT_ARG_LENGTH = 100_000;

const GIT_LS_FILES_ARGS = [
  "ls-files",
  "--cached",
  "--others",
  "--exclude-standard",
  "--full-name",
  "--",
  ".",
] as const;

/**
 * Runtime options for executing a command against every git-visible file in a
 * workspace without carrying any step-definition concerns.
 */
export interface GitFileScanOptions {
  /** Command to run, e.g. `"bunx"`. */
  command: string;
  /**
   * Args used when the working directory is not inside a git repository.
   * Defaults to `fileArgs` when omitted.
   */
  fallbackArgs?: readonly string[];
  /** Args prepended before each file-path batch, e.g. `["scanner", "--no-glob"]`. */
  fileArgs: readonly string[];
  /** Maximum combined argument length before splitting into a new batch. Defaults to 100 000. */
  maxArgLength?: number;
  /** Message written when the git-visible file set is empty. */
  noFilesMessage?: string;
}

type ResolvedGitFiles =
  | { exitCode: number; kind: "failure"; output: string }
  | { kind: "fallback" }
  | { kind: "resolved"; paths: string[] };

/**
 * Runs a command against the git-visible files in the target workspace and
 * falls back to a single non-git invocation when the workspace is not a git
 * repository.
 */
export function runGitFileScan(
  cwd: string,
  options: GitFileScanOptions,
): Command {
  const startedAt = Date.now();
  const gitFiles = resolveGitVisibleFiles(cwd);

  if (gitFiles.kind === "failure") {
    return buildTimedCommand(gitFiles.exitCode, gitFiles.output, startedAt);
  }

  if (gitFiles.kind === "fallback") {
    const result = spawnBuffered(cwd, options.command, [
      ...(options.fallbackArgs ?? options.fileArgs),
    ]);
    return buildTimedCommand(result.exitCode, result.output, startedAt);
  }

  if (gitFiles.paths.length === 0) {
    return buildTimedCommand(
      0,
      options.noFilesMessage ?? "No tracked or non-ignored files matched\n",
      startedAt,
    );
  }

  return runFileBatches(cwd, options, gitFiles.paths, startedAt);
}

/**
 * Discovers every git-tracked and untracked
 * non-ignored file in the workspace and runs
 * `command [fileArgs...] [batch...]` in chunks that stay within the OS argument
 * length limit.
 *
 * When the working directory is not inside a git repository the step falls back
 * to a single `command [fallbackArgs...]` invocation.
 *
 * @example
 * ```ts
 * runGitFileScan(process.cwd(), {
 *   command: "bunx",
 *   fileArgs: ["scanner", "--no-glob", "--config", "scanner.config.json"],
 *   fallbackArgs: ["scanner", "<workspace-glob>", "--config", "scanner.config.json"],
 * });
 * ```
 */
function buildTimedCommand(
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

function chunkPaths(
  paths: string[],
  baseArgs: readonly string[],
  maxLen: number,
): string[][] {
  const baseLen = baseArgs.reduce((total, arg) => total + arg.length + 1, 0);
  const batches: string[][] = [];
  let current: string[] = [];
  let currentLen = baseLen;

  for (const path of paths) {
    const pathLen = path.length + 1;
    if (current.length > 0 && currentLen + pathLen > maxLen) {
      batches.push(current);
      current = [];
      currentLen = baseLen;
    }
    current.push(path);
    currentLen += pathLen;
  }

  if (current.length > 0) {
    batches.push(current);
  }

  return batches;
}

function joinOutputs(parts: string[]): string {
  return parts.length === 0 ? "" : `${parts.join("\n\n")}\n`;
}

function resolveGitVisibleFiles(cwd: string): ResolvedGitFiles {
  const result = spawnBuffered(cwd, "git", [...GIT_LS_FILES_ARGS]);

  if (result.exitCode === 0) {
    const paths = result.output
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    return { kind: "resolved", paths };
  }

  if (/not a git repository/i.test(result.output)) {
    return { kind: "fallback" };
  }

  return { exitCode: result.exitCode, kind: "failure", output: result.output };
}

function runFileBatches(
  cwd: string,
  options: GitFileScanOptions,
  paths: string[],
  startedAt: number,
): Command {
  const maxLen = options.maxArgLength ?? MAX_DEFAULT_ARG_LENGTH;
  const outputParts: string[] = [];
  let finalExitCode = 0;

  for (const batch of chunkPaths(paths, options.fileArgs, maxLen)) {
    const result = spawnBuffered(cwd, options.command, [
      ...options.fileArgs,
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

    return buildTimedCommand(
      result.exitCode,
      joinOutputs(outputParts),
      startedAt,
    );
  }

  return buildTimedCommand(finalExitCode, joinOutputs(outputParts), startedAt);
}

function spawnBuffered(
  cwd: string,
  command: string,
  args: string[],
): { exitCode: number; output: string } {
  const result = Bun.spawnSync([command, ...args], {
    cwd,
    stderr: "pipe",
    stdin: "ignore",
    stdout: "pipe",
  });

  return {
    exitCode: result.exitCode,
    output: `${result.stdout.toString("utf8")}${result.stderr.toString("utf8")}`,
  };
}
