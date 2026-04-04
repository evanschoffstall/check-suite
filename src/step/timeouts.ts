import type { StepConfig } from "@/types/index.ts";

import {
  getRemainingTimeoutMs,
  parsePositiveTimeoutMs,
} from "@/timeout/index.ts";
import { getStepTokens, resolveTokenString } from "@/tokens.ts";

export function getStepTimeoutMs(step: StepConfig, deadlineMs: number): number {
  const remainingMs = getRemainingTimeoutMs(deadlineMs);
  if (remainingMs <= 0) return 0;

  const configuredMs = resolveStepTimeoutMsValue(step);
  return configuredMs !== null
    ? Math.min(configuredMs, remainingMs)
    : remainingMs;
}

export function resolveStepTimeoutDrainMsValue(
  step: StepConfig,
): null | number {
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
