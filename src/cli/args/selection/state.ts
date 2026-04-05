import type { StepConfig } from "@/types/index.ts";

import { CFG } from "@/runtime-config/index.ts";

const SUITE_EXCLUSION_PREFIX = "---no=";

export interface SuiteSelectionState {
  exclusions: string[];
  invalidSuiteExclusions: string[];
  invalidSuiteFlags: string[];
  suiteFlags: string[];
  suiteStepArgs: string[];
}

export function collectSelectionState(
  selectionArgs: string[],
): SuiteSelectionState {
  const runnableSuiteStepKeys = new Set(
    CFG.steps
      .filter((step) => !step.preRun && step.enabled !== false)
      .map((step) => step.key),
  );
  const { exclusions, invalidExclusions } = parseSuiteExclusions(selectionArgs);
  const suiteFlags = selectionArgs
    .filter(
      (argument) =>
        argument.startsWith("--") &&
        !argument.startsWith(SUITE_EXCLUSION_PREFIX),
    )
    .map((argument) => argument.slice(2));
  const suiteStepArgs = selectionArgs.filter(
    (argument) =>
      !argument.startsWith("--") &&
      !argument.startsWith(SUITE_EXCLUSION_PREFIX),
  );

  return {
    exclusions,
    invalidSuiteExclusions: [
      ...invalidExclusions,
      ...exclusions.filter((flag) => !runnableSuiteStepKeys.has(flag)),
    ],
    invalidSuiteFlags: suiteFlags.filter(
      (flag) => !runnableSuiteStepKeys.has(flag),
    ),
    suiteFlags,
    suiteStepArgs,
  };
}

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

function parseSuiteExclusions(suiteArguments: string[]): {
  exclusions: string[];
  invalidExclusions: string[];
} {
  const exclusions: string[] = [];
  const invalidExclusions: string[] = [];

  for (const argument of suiteArguments) {
    if (!argument.startsWith(SUITE_EXCLUSION_PREFIX)) continue;

    const excludedKey = argument.slice(SUITE_EXCLUSION_PREFIX.length);
    if (excludedKey.length === 0) {
      invalidExclusions.push(argument);
      continue;
    }

    exclusions.push(excludedKey);
  }

  return { exclusions, invalidExclusions };
}
