import { mkdirSync } from "node:fs";
import { join } from "node:path";

import type { Command, LintConfig, StepConfig, StepRunner } from "./types.ts";

import { runInlineTypeScriptStep } from "./inline-ts.ts";
import { runLint } from "./lint.ts";
import { run } from "./process.ts";
import {
  getRemainingTimeoutMs,
  makeTimedOutCommand,
  parsePositiveTimeoutMs,
  withStepTimeout,
} from "./timeout.ts";
import { getStepTokens, resolveArgs, resolveTokenString } from "./tokens.ts";

// ---------------------------------------------------------------------------
// Step timeout resolution
// ---------------------------------------------------------------------------

function ensureStepDirectories(step: StepConfig): void {
  const tokens = getStepTokens(step);
  for (const entry of step.ensureDirs ?? []) {
    mkdirSync(resolveConfiguredPath(resolveTokenString(entry, tokens)), {
      recursive: true,
    });
  }
}

/**
 * Computes the effective timeout for a step — the lesser of the step-level
 * configured timeout and the remaining suite deadline.
 */
function getStepTimeoutMs(step: StepConfig, deadlineMs: number): number {
  const remainingMs = getRemainingTimeoutMs(deadlineMs);
  if (remainingMs <= 0) return 0;

  const configuredMs = resolveStepTimeoutMsValue(step);
  return configuredMs !== null
    ? Math.min(configuredMs, remainingMs)
    : remainingMs;
}

function resolveConfiguredPath(entry: string): string {
  return entry.startsWith("/") ? entry : join(process.cwd(), entry);
}

// ---------------------------------------------------------------------------
// Directory setup
// ---------------------------------------------------------------------------

function resolveStepTimeoutDrainMsValue(step: StepConfig): null | number {
  if (typeof step.timeoutDrainMs === "number")
    return parsePositiveTimeoutMs(step.timeoutDrainMs);
  if (typeof step.timeoutDrainMs !== "string") return null;
  return parsePositiveTimeoutMs(
    resolveTokenString(step.timeoutDrainMs, getStepTokens(step)),
  );
}

function resolveStepTimeoutMsValue(step: StepConfig): null | number {
  const envMs = step.timeoutEnvVar
    ? parsePositiveTimeoutMs(process.env[step.timeoutEnvVar])
    : null;
  if (envMs !== null) return envMs;
  if (typeof step.timeoutMs === "number")
    return parsePositiveTimeoutMs(step.timeoutMs);
  if (typeof step.timeoutMs !== "string") return null;
  return parsePositiveTimeoutMs(
    resolveTokenString(step.timeoutMs, getStepTokens(step)),
  );
}

// ---------------------------------------------------------------------------
// Handler registry
// ---------------------------------------------------------------------------

/** Built-in handler implementations keyed by the `handler` field value. */
const HANDLERS: Partial<Record<string, StepRunner>> = {
  "inline-ts": (step, timeoutMs) =>
    withStepTimeout(step.label, runInlineTypeScriptStep(step), timeoutMs),
  lint: (step, timeoutMs, extraArgs = []) =>
    runLint(step, step.config as LintConfig, extraArgs, timeoutMs),
};

// ---------------------------------------------------------------------------
// Step runner
// ---------------------------------------------------------------------------

/**
 * Runs a step only when the suite still has time budget remaining.
 *
 * This prevents late steps from spawning child processes or inline handlers
 * after a long pre-run phase has already consumed the suite timeout.
 */
export function runStepWithinDeadline(
  step: StepConfig,
  deadlineMs: number,
  extraArgs: string[] = [],
): Promise<Command> {
  const timeoutMs = getStepTimeoutMs(step, deadlineMs);
  if (timeoutMs <= 0) {
    return Promise.resolve(makeTimedOutCommand(step.label, 0));
  }

  return runStep(step, timeoutMs, extraArgs);
}

// ---------------------------------------------------------------------------
// Deadline-aware step execution
// ---------------------------------------------------------------------------

/**
 * Dispatches a step to its handler or spawns its configured command.
 * Applies directory setup, token substitution, and timeout drain limits.
 */
function runStep(
  step: StepConfig,
  timeoutMs?: number,
  extraArgs: string[] = [],
): Promise<Command> {
  if (step.handler) {
    const handler = HANDLERS[step.handler];
    if (!handler) {
      return Promise.resolve({
        exitCode: 1,
        output: `unknown handler: ${step.handler}`,
        timedOut: false,
      });
    }

    return handler(step, timeoutMs, extraArgs);
  }

  if (!step.cmd)
    return Promise.resolve({
      exitCode: 1,
      output: `step "${step.key}" missing cmd`,
      timedOut: false,
    });

  ensureStepDirectories(step);
  const tokens = getStepTokens(step);

  return run(
    step.cmd,
    [...resolveArgs(step.args ?? [], tokens), ...extraArgs],
    {
      label: step.label,
      timeoutDrainMs: resolveStepTimeoutDrainMsValue(step) ?? undefined,
      timeoutMs,
    },
  );
}
