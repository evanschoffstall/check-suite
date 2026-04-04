import type { Command, StepConfig } from "../types/index.ts";

import { makeTimedOutCommand } from "../timeout.ts";
import { runCommandStep } from "./command.ts";
import { runHandledStep } from "./handlers.ts";
import { getStepTimeoutMs } from "./timeouts.ts";

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
