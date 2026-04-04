import type { CliArguments, StepConfig } from "@/types/index.ts";

import { CFG } from "@/config/index.ts";

import { splitSuiteArguments } from "./split.ts";
import {
  collectSelectionState,
  resolveSuiteFlagDirectStep,
} from "./state.ts";

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
