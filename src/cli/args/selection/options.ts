import type { SuiteOutputMode, SuiteRenderMode } from "@/types/index.ts";

const FAILURE_LINE_OPTION_PREFIX = "--fail-lines=";
const FORMAT_OPTION_PREFIX = "--format=";
const OUTPUT_OPTION_PREFIX = "--output=";

/**
 * Extracts reserved CLI options from suite arguments and returns the remaining
 * suite-selection arguments unchanged.
 */
export function parseCliOptions(selectionArgs: string[]): {
  failureOutputLineLimit: null | number;
  invalidOptions: string[];
  outputMode: SuiteOutputMode;
  renderMode: SuiteRenderMode;
  selectionArgs: string[];
} {
  let failureOutputLineLimit: null | number = null;
  const invalidOptions: string[] = [];
  const remainingSelectionArgs: string[] = [];
  let outputMode: SuiteOutputMode = "failures-only";
  let renderMode: SuiteRenderMode = "styled";

  for (const argument of selectionArgs) {
    const failureLineLimit = parseFailureLineOption(argument);
    if (failureLineLimit !== undefined) {
      if (failureLineLimit === null) {
        invalidOptions.push(argument);
      } else {
        failureOutputLineLimit = failureLineLimit;
      }
      continue;
    }

    const requestedRenderMode = parseRenderModeOption(argument);
    if (requestedRenderMode !== undefined) {
      if (requestedRenderMode === null) {
        invalidOptions.push(argument);
      } else {
        renderMode = requestedRenderMode;
      }
      continue;
    }

    const requestedOutputMode = parseOutputModeOption(argument);
    if (requestedOutputMode !== undefined) {
      if (requestedOutputMode === null) {
        invalidOptions.push(argument);
      } else {
        outputMode = requestedOutputMode;
      }
      continue;
    }

    remainingSelectionArgs.push(argument);
  }

  return {
    failureOutputLineLimit,
    invalidOptions,
    outputMode,
    renderMode,
    selectionArgs: remainingSelectionArgs,
  };
}

/** Parses the failure-line option and distinguishes invalid values from absent ones. */
function parseFailureLineOption(argument: string): null | number | undefined {
  if (!argument.startsWith(FAILURE_LINE_OPTION_PREFIX)) {
    return undefined;
  }

  const requestedLineLimit = Number(argument.slice(FAILURE_LINE_OPTION_PREFIX.length));
  return Number.isInteger(requestedLineLimit) && requestedLineLimit > 0
    ? requestedLineLimit
    : null;
}

/** Parses the suite-output option into the internal output-mode enum. */
function parseOutputModeOption(
  argument: string,
): null | SuiteOutputMode | undefined {
  if (!argument.startsWith(OUTPUT_OPTION_PREFIX)) {
    return undefined;
  }

  const requestedOutputMode = argument.slice(OUTPUT_OPTION_PREFIX.length);
  if (requestedOutputMode === "all") {
    return "all";
  }

  return requestedOutputMode === "failures" ? "failures-only" : null;
}

/** Parses the render-mode option and normalizes legacy plain-text aliases. */
function parseRenderModeOption(
  argument: string,
): null | SuiteRenderMode | undefined {
  if (!argument.startsWith(FORMAT_OPTION_PREFIX)) {
    return undefined;
  }

  const requestedRenderMode = argument.slice(FORMAT_OPTION_PREFIX.length);
  if (
    requestedRenderMode === "headless"
    || requestedRenderMode === "plain"
    || requestedRenderMode === "safe"
  ) {
    return "plain";
  }

  return requestedRenderMode === "styled" ? "styled" : null;
}