import type { SuiteOutputMode } from "@/types/index.ts";

const OUTPUT_OPTION_PREFIX = "--output=";

/**
 * Extracts reserved CLI options from suite arguments and returns the remaining
 * suite-selection arguments unchanged.
 */
export function parseCliOptions(selectionArgs: string[]): {
  invalidOptions: string[];
  outputMode: SuiteOutputMode;
  selectionArgs: string[];
} {
  const invalidOptions: string[] = [];
  const remainingSelectionArgs: string[] = [];
  let outputMode: SuiteOutputMode = "failures-only";

  for (const argument of selectionArgs) {
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
    invalidOptions,
    outputMode,
    selectionArgs: remainingSelectionArgs,
  };
}