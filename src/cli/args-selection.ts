import type { CliArguments } from "../types/index.ts";

import { createDirectStepArguments } from "./args-direct.ts";
import { collectSelectionState } from "./args-selection-state.ts";
import { resolveSuiteFlagDirectStep } from "./args-suite-flag.ts";

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
