import type { Command, StepConfig } from "../types/index.ts";

import { run } from "../process/index.ts";
import { getStepTokens, resolveArgs } from "../tokens.ts";
import { ensureStepDirectories } from "./paths.ts";
import { resolveStepTimeoutDrainMsValue } from "./timeouts.ts";

export function runCommandStep(
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
