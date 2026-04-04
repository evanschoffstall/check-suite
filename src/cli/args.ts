import type { CliArguments } from "../types.ts";

import { CFG } from "../config.ts";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUITE_EXCLUSION_PREFIX = "---no=";

// ---------------------------------------------------------------------------
// Step key helpers
// ---------------------------------------------------------------------------

/** Returns keys for all enabled steps, including pre-run steps. */
export function getConfiguredStepKeys(): string[] {
  return CFG.steps
    .filter((step) => step.enabled !== false)
    .map((step) => step.key);
}

/** Splits CLI arguments into a command, step filters, and exclusions. */
export function parseCliArguments(argv: string[]): CliArguments {
  const command = argv[2];

  if (command === "keys") {
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

  const isSummaryCommand = command === "summary";
  const suiteCommand: CliArguments["command"] = isSummaryCommand
    ? "summary"
    : "run-suite";
  const suiteArgStartIndex = isSummaryCommand ? 3 : 2;
  const suiteCommandCandidate = argv[suiteArgStartIndex];

  const directStep =
    !isSummaryCommand &&
    suiteCommandCandidate &&
    !suiteCommandCandidate.startsWith("--")
      ? CFG.steps.find(
          (step) =>
            step.key === suiteCommandCandidate && step.enabled !== false,
        )
      : undefined;

  if (directStep) {
    return {
      command: suiteCommand,
      directStep,
      directStepArgs: argv.slice(suiteArgStartIndex + 1),
      excludedKeys: new Set<string>(),
      invalidSuiteExclusions: [],
      invalidSuiteFlags: [],
      keyFilter: null,
    };
  }

  const suiteArguments = argv.slice(suiteArgStartIndex);
  const passthroughSeparatorIndex = suiteArguments.indexOf("--");
  const suiteSelectionArguments =
    passthroughSeparatorIndex >= 0
      ? suiteArguments.slice(0, passthroughSeparatorIndex)
      : suiteArguments;
  const explicitSuiteStepArgs =
    passthroughSeparatorIndex >= 0
      ? suiteArguments.slice(passthroughSeparatorIndex + 1)
      : [];

  const runnableSuiteStepKeys = getRunnableSuiteStepKeys();
  const { exclusions, invalidExclusions } = parseSuiteExclusions(
    suiteSelectionArguments,
  );

  const suiteFlags = suiteSelectionArguments
    .filter(
      (argument) =>
        argument.startsWith("--") &&
        !argument.startsWith(SUITE_EXCLUSION_PREFIX),
    )
    .map((argument) => argument.slice(2));

  const suiteStepArgs = suiteSelectionArguments.filter(
    (argument) =>
      !argument.startsWith("--") &&
      !argument.startsWith(SUITE_EXCLUSION_PREFIX),
  );

  const invalidSuiteFlags = suiteFlags.filter(
    (flag) => !runnableSuiteStepKeys.has(flag),
  );
  const invalidSuiteExclusions = [
    ...invalidExclusions,
    ...exclusions.filter((flag) => !runnableSuiteStepKeys.has(flag)),
  ];

  if (
    invalidSuiteFlags.length === 0 &&
    invalidSuiteExclusions.length === 0 &&
    suiteFlags.length === 1
  ) {
    const selectedStep = CFG.steps.find(
      (step) => step.key === suiteFlags[0] && step.enabled !== false,
    );
    const directStepArgs = [...suiteStepArgs, ...explicitSuiteStepArgs];

    if (selectedStep?.allowSuiteFlagArgs && directStepArgs.length > 0) {
      return {
        command: suiteCommand,
        directStep: selectedStep,
        directStepArgs,
        excludedKeys: new Set<string>(),
        invalidSuiteExclusions: [],
        invalidSuiteFlags: [],
        keyFilter: null,
      };
    }
  }

  return {
    command: suiteCommand,
    directStep: undefined,
    directStepArgs: [],
    excludedKeys: new Set<string>(exclusions),
    invalidSuiteExclusions,
    invalidSuiteFlags,
    keyFilter: suiteFlags.length > 0 ? new Set(suiteFlags) : null,
  };
}

// ---------------------------------------------------------------------------
// Exclusion parsing
// ---------------------------------------------------------------------------

/** Returns the enabled non-pre-run step keys available for direct selection. */
function getRunnableSuiteStepKeys(): Set<string> {
  return new Set(
    CFG.steps
      .filter((step) => !step.preRun && step.enabled !== false)
      .map((step) => step.key),
  );
}

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

/** Extracts configured step exclusions from suite CLI argument tokens. */
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
