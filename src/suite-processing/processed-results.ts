import type { Command, StepConfig } from "../types/index.ts";
import type { ProcessedResultEntry } from "./types.ts";

import { runStepPostProcess } from "../post-process-runner/index.ts";
import { applyOutputFilter } from "../process/output.ts";

export async function buildProcessedResults(
  allExecutedSteps: StepConfig[],
  runs: Record<string, Command>,
  suiteExpiredBeforeOutput: boolean,
): Promise<Record<string, ProcessedResultEntry>> {
  const entries = await Promise.all(
    allExecutedSteps.map(
      async (step) =>
        [
          step.key,
          {
            displayOutput: getStepDisplayOutput(step, runs[step.key].output),
            postProcess: suiteExpiredBeforeOutput
              ? null
              : await runStepPostProcess(
                  step,
                  runs[step.key],
                  getStepDisplayOutput(step, runs[step.key].output),
                ),
          },
        ] as const,
    ),
  );

  return Object.fromEntries(entries);
}

export function collectMissingSteps(
  allExecutedSteps: StepConfig[],
  runs: Record<string, Command>,
): string[] {
  return allExecutedSteps
    .filter((step) => runs[step.key].notFound)
    .map((step) => step.label);
}

function getStepDisplayOutput(step: StepConfig, output: string): string {
  return step.outputFilter
    ? applyOutputFilter(step.outputFilter, output)
    : output;
}
