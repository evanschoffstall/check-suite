import { availableParallelism, cpus } from "node:os";

import type { Command, LintConfig, StepConfig, Summary } from "@/types/index.ts";

import { run } from "@/process/index.ts";

// ---------------------------------------------------------------------------
// Platform defaults
// ---------------------------------------------------------------------------

/**
 * Directories unconditionally excluded from lint file-counting and globbing.
 * Covers Node.js artefacts, common framework output folders, and tool caches.
 * Any linter step using the `"lint"` handler can reference this list.
 */
export const STANDARD_LINT_SKIP_DIRS: readonly string[] = [
  ".cache",
  ".next",
  ".nuxt",
  ".output",
  ".svelte-kit",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "out",
  "tmp",
];

const DEFAULT_GLOB_EXTENSIONS: readonly string[] = [
  "js", "mjs", "cjs", "ts", "jsx", "tsx",
];
const DEFAULT_MAX_FILES = 5000;

// ---------------------------------------------------------------------------
// defineLintStep factory
// ---------------------------------------------------------------------------

/**
 * Options accepted by {@link defineLintStep}.
 *
 * `args` is required because it must name the linter command — the platform
 * engine has zero knowledge of which linter the project uses.
 */
export interface LintStepOptions {
  /** Linter CLI args passed to `bunx`. Must include the tool name as the first element. */
  args: readonly string[];
  /** Optional arg prefix inserted before the derived worker count, for example `["--concurrency"]`. */
  concurrencyArgs?: readonly string[];
  /** Optional env var that overrides the derived worker count. Defaults to `CHECK_SUITE_LINT_CONCURRENCY`. */
  concurrencyEnvVar?: string;
  enabled?: boolean;
  failMsg?: string;
  /** File extensions counted when estimating worker concurrency. Defaults to all JS/TS families. */
  globExtensions?: readonly string[];
  /** Step key used for filtering and output. Defaults to `"lint"`. */
  key?: string;
  /** Display label. Defaults to `"lint"`. */
  label?: string;
  /** Upper file-count bound for concurrency estimation. Defaults to 5000. */
  maxFiles?: number;
  passMsg?: string;
  /** Directories excluded from file-counting globs. Defaults to {@link STANDARD_LINT_SKIP_DIRS}. */
  skipDirs?: readonly string[];
  /** Output summary pattern. Defaults to `{ type: "simple" }`. */
  summary?: Summary;
}

/**
 * Assembles a `handler: "lint"` {@link StepConfig} from user-supplied linter
 * args, wiring the platform's auto-concurrency runner without encoding any
 * knowledge of which linter is being run.
 *
 * When `concurrencyArgs` is provided, the platform runner appends
 * `...[concurrencyArgs, derivedWorkerCount]` after `args` and before any
 * suite-flag extra args, with the worker count derived from CPU count and file
 * count.
 *
 * @example
 * ```ts
 * defineLintStep({
 *   args: ["repo-lint", ".", "--fix"],
 *   concurrencyArgs: ["--workers"],
 *   label: "repo-lint",
 * });
 * defineLintStep({ args: ["biome", "check", "--write"], label: "biome" });
 * ```
 */
export function defineLintStep(options: LintStepOptions): StepConfig {
  return {
    config: createLintConfig(options),
    enabled: options.enabled ?? true,
    failMsg: options.failMsg ?? "lint failed",
    handler: "lint",
    key: options.key ?? "lint",
    label: options.label ?? "lint",
    passMsg: options.passMsg ?? "",
    summary: options.summary ?? { type: "simple" },
  };
}

// ---------------------------------------------------------------------------
// Runtime — called by the platform handler, not by config consumers
// ---------------------------------------------------------------------------

/** Runs the linter subprocess with optional auto-derived worker concurrency appended to `cfg.args`. */
export async function runLint(
  step: StepConfig,
  cfg: LintConfig,
  extraArgs: string[],
  timeoutMs?: number,
  onOutput?: (output: string) => void,
): Promise<Command> {
  const concurrencyArgs = await buildConcurrencyArgs(cfg);
  return run("bunx", [...cfg.args, ...concurrencyArgs, ...extraArgs], {
    label: step.label,
    onOutput,
    timeoutMs,
  });
}

async function buildConcurrencyArgs(cfg: LintConfig): Promise<string[]> {
  if (!cfg.concurrencyArgs || cfg.concurrencyArgs.length === 0) {
    return [];
  }

  const overrideEnvVar = cfg.concurrencyEnvVar ?? "CHECK_SUITE_LINT_CONCURRENCY";
  const overrideValue = process.env[overrideEnvVar];
  const concurrency =
    overrideValue && /^\d+$/.test(overrideValue)
      ? Number.parseInt(overrideValue, 10)
      : await getConcurrencyFromFileCount(cfg);

  return [...cfg.concurrencyArgs, String(concurrency)];
}

/** Counts JS/TS source files matching the lint config's glob extensions. */
async function countLintFiles(cfg: LintConfig): Promise<number> {
  const glob = new Bun.Glob(`**/*.{${cfg.globExtensions.join(",")}}`);
  let count = 0;
  for await (const fp of glob.scan({ absolute: false, cwd: process.cwd() })) {
    if (
      cfg.skipDirs.some((d) => fp.startsWith(`${d}/`) || fp.includes(`/${d}/`))
    )
      continue;
    if (++count >= cfg.maxFiles) return count;
  }
  return count;
}

function createLintConfig(options: LintStepOptions): LintConfig {
  return {
    args: [...options.args],
    concurrencyArgs: options.concurrencyArgs
      ? [...options.concurrencyArgs]
      : undefined,
    concurrencyEnvVar: options.concurrencyEnvVar,
    globExtensions: [...(options.globExtensions ?? DEFAULT_GLOB_EXTENSIONS)],
    maxFiles: options.maxFiles ?? DEFAULT_MAX_FILES,
    skipDirs: [...(options.skipDirs ?? STANDARD_LINT_SKIP_DIRS)],
  };
}

/**
 * Derives a worker count from CPU count and file count.
 * Small projects use 1 worker to avoid parallelism overhead.
 */
function getConcurrency(fileCount: number): number {
  if (fileCount < 50) return 1;
  const cpuCount =
    typeof availableParallelism === "function"
      ? availableParallelism()
      : cpus().length;
  return cpuCount <= 4
    ? Math.max(2, cpuCount)
    : cpuCount <= 8
      ? cpuCount - 1
      : Math.min(8, Math.max(4, Math.ceil(cpuCount / 2)));
}

async function getConcurrencyFromFileCount(cfg: LintConfig): Promise<number> {
  return getConcurrency(await countLintFiles(cfg));
}
