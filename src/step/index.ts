import { mkdirSync } from "node:fs";
import { join } from "node:path";

import type { Command, StepConfig } from "../types/index.ts";

import { runInlineTypeScriptStep } from "../inline-ts/runner.ts";
import { runLint } from "../lint.ts";
import { run } from "../process/runner.ts";
import {
  getRemainingTimeoutMs,
  makeTimedOutCommand,
  parsePositiveTimeoutMs,
  withStepTimeout,
} from "../timeout.ts";
import { getStepTokens, resolveArgs, resolveTokenString } from "../tokens.ts";

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

function runStep(
  step: StepConfig,
  timeoutMs?: number,
  extraArgs: string[] = [],
): Promise<Command> {
  if (step.handler) {
    return runHandledStep(step, timeoutMs, extraArgs);
  }

  return runCommandStep(step, timeoutMs, extraArgs);
}

const HANDLERS: Partial<Record<string, typeof runStep>> = {
  "inline-ts": (step, timeoutMs) =>
    withStepTimeout(step.label, runInlineTypeScriptStep(step), timeoutMs),
  lint: (step, timeoutMs, extraArgs = []) =>
    runLint(
      step,
      step.config as NonNullable<StepConfig["config"]> & {
        args: string[];
        globExtensions: string[];
        maxFiles: number;
        skipDirs: string[];
      },
      extraArgs,
      timeoutMs,
    ),
};

function ensureStepDirectories(step: StepConfig): void {
  const tokens = getStepTokens(step);
  for (const entry of step.ensureDirs ?? []) {
    mkdirSync(resolveConfiguredPath(resolveTokenString(entry, tokens)), {
      recursive: true,
    });
  }
}

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

function resolveStepTimeoutDrainMsValue(step: StepConfig): null | number {
  if (typeof step.timeoutDrainMs === "number") {
    return parsePositiveTimeoutMs(step.timeoutDrainMs);
  }
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
  if (typeof step.timeoutMs === "number") {
    return parsePositiveTimeoutMs(step.timeoutMs);
  }
  if (typeof step.timeoutMs !== "string") return null;
  return parsePositiveTimeoutMs(
    resolveTokenString(step.timeoutMs, getStepTokens(step)),
  );
}

function runCommandStep(
  step: StepConfig,
  timeoutMs?: number,
  extraArgs: string[] = [],
): Promise<Command> {
  if (!step.cmd) {
    return Promise.resolve({
      exitCode: 1,
      output: `step "${step.key}" missing cmd`,
      timedOut: false,
    });
  }

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

function runHandledStep(
  step: StepConfig,
  timeoutMs?: number,
  extraArgs: string[] = [],
): Promise<Command> {
  const handler = HANDLERS[step.handler ?? ""];
  return handler
    ? handler(step, timeoutMs, extraArgs)
    : Promise.resolve({
        exitCode: 1,
        output: `unknown handler: ${step.handler ?? ""}`,
        timedOut: false,
      });
}
