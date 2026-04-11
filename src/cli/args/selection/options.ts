import type { SuiteOutputMode } from "@/types/index.ts";

const FAILURE_LINE_OPTION_PREFIX = "--fail-lines=";
const OUTPUT_OPTION_PREFIX = "--output=";

/**
 * Extracts reserved CLI options from suite arguments and returns the remaining
 * suite-selection arguments unchanged.
 */
export function parseCliOptions(selectionArgs: string[]): {
  failureOutputLineLimit: null | number;
  invalidOptions: string[];
  outputMode: SuiteOutputMode;
  selectionArgs: string[];
} {
  let failureOutputLineLimit: null | number = null;
  const invalidOptions: string[] = [];
  const remainingSelectionArgs: string[] = [];
  let outputMode: SuiteOutputMode = "failures-only";

  for (const argument of selectionArgs) {
    if (argument.startsWith(FAILURE_LINE_OPTION_PREFIX)) {
      const requestedLineLimit = Number(argument.slice(FAILURE_LINE_OPTION_PREFIX.length));
      if (Number.isInteger(requestedLineLimit) && requestedLineLimit > 0) {
        failureOutputLineLimit = requestedLineLimit;
        continue;
      }

      invalidOptions.push(argument);
      continue;
    }

    if (!argument.startsWith(OUTPUT_OPTION_PREFIX)) {
      remainingSelectionArgs.push(argument);
      continue;
    }

    const requestedOutputMode = argument.slice(OUTPUT_OPTION_PREFIX.length);
    if (requestedOutputMode === "all") {
      outputMode = "all";
      continue;
    }
    if (requestedOutputMode === "failures") {
      outputMode = "failures-only";
      continue;
    }

    invalidOptions.push(argument);
  }

  return {
    failureOutputLineLimit,
    invalidOptions,
    outputMode,
    selectionArgs: remainingSelectionArgs,
  };
}