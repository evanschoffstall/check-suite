import type { Command, StepConfig } from "@/types/index.ts";

import { makeTimedOutCommand } from "@/timeout/index.ts";

import { runHandledStep } from "./handlers.ts";
import { runCommandStep } from "./run-command.ts";
import { getStepTimeoutMs } from "./timeouts.ts";

export function runStepWithinDeadline(
  step: StepConfig,
  deadlineMs: number,
  extraArgs: string[] = [],
  onOutput?: (output: string) => void,
): Promise<Command> {
  const timeoutMs = getStepTimeoutMs(step, deadlineMs);
  if (timeoutMs <= 0) {
    return Promise.resolve(makeTimedOutCommand(step.label, 0));
  }

  if (step.handler) {
    return runHandledStep(step, timeoutMs, extraArgs, onOutput);
  }

  return runCommandStep(step, timeoutMs, extraArgs, onOutput);
}
