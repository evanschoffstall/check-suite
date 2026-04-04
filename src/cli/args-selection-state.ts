import {
  getRunnableSuiteStepKeys,
  parseSuiteExclusions,
  SUITE_EXCLUSION_PREFIX,
} from "./args-helpers.ts";

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
  const runnableSuiteStepKeys = getRunnableSuiteStepKeys();
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
