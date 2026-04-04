import type { StepConfig } from "../types/index.ts";

import { CFG } from "../config/index.ts";

export function resolveSuiteFlagDirectStep(
  suiteFlags: string[],
  suiteStepArgs: string[],
  explicitSuiteStepArgs: string[],
  invalidSuiteFlags: string[],
  invalidSuiteExclusions: string[],
): null | { args: string[]; step: StepConfig } {
  if (invalidSuiteFlags.length > 0 || invalidSuiteExclusions.length > 0) {
    return null;
  }
  if (suiteFlags.length !== 1) return null;

  const selectedStep = CFG.steps.find(
    (step) => step.key === suiteFlags[0] && step.enabled !== false,
  );
  const directStepArgs = [...suiteStepArgs, ...explicitSuiteStepArgs];
  if (!selectedStep?.allowSuiteFlagArgs || directStepArgs.length === 0) {
    return null;
  }

  return { args: directStepArgs, step: selectedStep };
}
