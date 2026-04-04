import type { Command, StepConfig } from "@/types/index.ts";

import { runInlineTypeScriptStep } from "@/inline-ts/index.ts";
import { runLint } from "@/lint.ts";
import { withStepTimeout } from "@/timeout/index.ts";

type StepRunner = (
  step: StepConfig,
  timeoutMs?: number,
  extraArgs?: string[],
) => Promise<Command>;

export const HANDLERS: Partial<Record<string, StepRunner>> = {
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
