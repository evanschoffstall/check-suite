import { availableParallelism, cpus } from "node:os";

import type { Command, LintConfig, StepConfig } from "@/types/index.ts";

import { run } from "@/process/index.ts";

// ---------------------------------------------------------------------------
// File counting
// ---------------------------------------------------------------------------

/** Runs ESLint via `bunx` with auto-derived concurrency and the configured args. */
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

// ---------------------------------------------------------------------------
// Concurrency
// ---------------------------------------------------------------------------

/** Counts TypeScript/JavaScript source files matching the lint config globs. */
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

// ---------------------------------------------------------------------------
// Lint step runner
// ---------------------------------------------------------------------------

/**
 * Derives the optimal ESLint worker concurrency from CPU count and file count.
 * Small projects get 1 worker to avoid parallelism overhead.
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
