import type { CliArguments, StepConfig } from "../types/index.ts";

import { CFG } from "../config/index.ts";

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
