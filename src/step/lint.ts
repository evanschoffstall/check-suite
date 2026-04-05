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
  /** Linter CLI args passed to `bunx`. Must include the tool name as the first element. The runner appends `--concurrency N` automatically. */
  args: readonly string[];
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
 * The platform runner appends `--concurrency N` after `args` and before any
 * suite-flag extra args, derived automatically from CPU count and file count.
 *
 * @example
 * ```ts
 * defineLintStep({ args: ["eslint", ".", "--cache", "--fix", "--concurrency"] });
 * defineLintStep({ args: ["biome", "check", "--write"], label: "biome" });
 * ```
 */
export function defineLintStep(options: LintStepOptions): StepConfig {
  const lintConfig: LintConfig = {
    args: [...options.args],
    globExtensions: [...(options.globExtensions ?? DEFAULT_GLOB_EXTENSIONS)],
    maxFiles: options.maxFiles ?? DEFAULT_MAX_FILES,
    skipDirs: [...(options.skipDirs ?? STANDARD_LINT_SKIP_DIRS)],
  };

  return {
    config: lintConfig,
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

/** Runs the linter subprocess with auto-derived worker concurrency appended to `cfg.args`. */
export async function runLint(
  step: StepConfig,
  cfg: LintConfig,
  extraArgs: string[],
  timeoutMs?: number,
): Promise<Command> {
  const envC = process.env.ESLINT_CONCURRENCY;
  const fileCount = await estLintFiles(cfg);
  const concurrency =
    envC && /^\d+$/.test(envC)
      ? Number.parseInt(envC, 10)
      : getConcurrency(fileCount);
  return run("bunx", [...cfg.args, String(concurrency), ...extraArgs], {
    label: step.label,
    timeoutMs,
  });
}

/** Counts JS/TS source files matching the lint config's glob extensions. */
async function estLintFiles(cfg: LintConfig): Promise<number> {
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

/**
 * Derives the optimal ESLint worker count from CPU count and file count.
 * Small projects use 1 worker to avoid parallelism overhead.
 */
function getConcurrency(n: number): number {
  if (n < 50) return 1;
  const c =
    typeof availableParallelism === "function"
      ? availableParallelism()
      : cpus().length;
  return c <= 4
    ? Math.max(2, c)
    : c <= 8
      ? c - 1
      : Math.min(8, Math.max(4, Math.ceil(c / 2)));
}
