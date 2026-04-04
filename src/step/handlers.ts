import type {
  Command,
  LintConfig,
  StepConfig,
  StepRunner,
} from "../types/index.ts";

import { runInlineTypeScriptStep } from "../inline-ts/index.ts";
import { runLint } from "../lint.ts";
import { withStepTimeout } from "../timeout.ts";

const HANDLERS: Partial<Record<string, StepRunner>> = {
  "inline-ts": (step, timeoutMs) =>
    withStepTimeout(step.label, runInlineTypeScriptStep(step), timeoutMs),
  lint: (step, timeoutMs, extraArgs = []) =>
    runLint(step, step.config as LintConfig, extraArgs, timeoutMs),
};

export function runHandledStep(
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
