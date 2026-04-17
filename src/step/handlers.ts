import type { Command, StepConfig } from "@/types/index.ts";

import { runInlineTypeScriptStep } from "@/inline-ts/index.ts";
import { withStepTimeout } from "@/timeout/index.ts";

import { runLint } from "./lint.ts";

type StepRunner = (
  step: StepConfig,
  timeoutMs?: number,
  extraArgs?: string[],
  onOutput?: (output: string) => void,
) => Promise<Command>;

export const HANDLERS: Partial<Record<string, StepRunner>> = {
  "inline-ts": (step, timeoutMs, _extraArgs, onOutput) => {
    const abortController = new AbortController();

    return withStepTimeout(
      step.label,
      runInlineTypeScriptStep(step, {
        onOutput,
        signal: abortController.signal,
      }),
      timeoutMs,
      {
        onTimeout: () => {
          abortController.abort();
        },
      },
    );
  },
  lint: (step, timeoutMs, extraArgs = [], onOutput) =>
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
      onOutput,
    ),
};

export function runHandledStep(
  step: StepConfig,
  timeoutMs?: number,
  extraArgs: string[] = [],
  onOutput?: (output: string) => void,
): Promise<Command> {
  const handler = HANDLERS[step.handler ?? ""];
  return handler
    ? handler(step, timeoutMs, extraArgs, onOutput)
    : Promise.resolve({
        exitCode: 1,
        output: `unknown handler: ${step.handler ?? ""}`,
        timedOut: false,
      });
}
