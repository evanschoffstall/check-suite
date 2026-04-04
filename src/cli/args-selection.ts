import type { CliArguments, StepConfig } from "@/types/index.ts";

import { CFG } from "@/config/index.ts";

const SUITE_EXCLUSION_PREFIX = "---no=";

interface SuiteSelectionState {
  exclusions: string[];
  invalidSuiteExclusions: string[];
  invalidSuiteFlags: string[];
  suiteFlags: string[];
  suiteStepArgs: string[];
}

export function createDirectStepArguments(
  command: CliArguments["command"],
  directStep: StepConfig,
  directStepArgs: string[],
): CliArguments {
  return {
    command,
    directStep,
    directStepArgs,
    excludedKeys: new Set<string>(),
    invalidSuiteExclusions: [],
    invalidSuiteFlags: [],
    keyFilter: null,
  };
}

export function createKeysArguments(): CliArguments {
  return {
    command: "keys",
    directStep: undefined,
    directStepArgs: [],
    excludedKeys: new Set<string>(),
    invalidSuiteExclusions: [],
    invalidSuiteFlags: [],
    keyFilter: null,
  };
}

export function getConfiguredStepKeys(): string[] {
  return CFG.steps
    .filter((step) => step.enabled !== false)
    .map((step) => step.key);
}

export function parseSuiteSelectionArguments(
  argv: string[],
  suiteArgStartIndex: number,
  suiteCommand: CliArguments["command"],
): CliArguments {
  const parsedArguments = splitSuiteArguments(argv, suiteArgStartIndex);
  const selectionState = collectSelectionState(parsedArguments.selectionArgs);

  const directStep = resolveSuiteFlagDirectStep(
    selectionState.suiteFlags,
    selectionState.suiteStepArgs,
    parsedArguments.explicitStepArgs,
    selectionState.invalidSuiteFlags,
    selectionState.invalidSuiteExclusions,
  );
  if (directStep) {
    return createDirectStepArguments(
      suiteCommand,
      directStep.step,
      directStep.args,
    );
  }

  return {
    command: suiteCommand,
    directStep: undefined,
    directStepArgs: [],
    excludedKeys: new Set<string>(selectionState.exclusions),
    invalidSuiteExclusions: selectionState.invalidSuiteExclusions,
    invalidSuiteFlags: selectionState.invalidSuiteFlags,
    keyFilter:
      selectionState.suiteFlags.length > 0
        ? new Set(selectionState.suiteFlags)
        : null,
  };
}

export function resolveDirectStepFromArg(
  argv: string[],
  isSummaryCommand: boolean,
  suiteArgStartIndex: number,
): StepConfig | undefined {
  const suiteCommandCandidate = argv[suiteArgStartIndex];
  if (isSummaryCommand) return undefined;
  if (!suiteCommandCandidate || suiteCommandCandidate.startsWith("--")) {
    return undefined;
  }
  return CFG.steps.find(
    (step) => step.key === suiteCommandCandidate && step.enabled !== false,
  );
}

function collectSelectionState(selectionArgs: string[]): SuiteSelectionState {
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

function resolveSuiteFlagDirectStep(
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

function splitSuiteArguments(
  argv: string[],
  suiteArgStartIndex: number,
): {
  explicitStepArgs: string[];
  selectionArgs: string[];
} {
  const suiteArguments = argv.slice(suiteArgStartIndex);
  const passthroughSeparatorIndex = suiteArguments.indexOf("--");

  return {
    explicitStepArgs:
      passthroughSeparatorIndex >= 0
        ? suiteArguments.slice(passthroughSeparatorIndex + 1)
        : [],
    selectionArgs:
      passthroughSeparatorIndex >= 0
        ? suiteArguments.slice(0, passthroughSeparatorIndex)
        : suiteArguments,
  };
}
