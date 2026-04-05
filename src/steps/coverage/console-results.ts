import type { JunitResults } from "./types";

const PLAYWRIGHT_COUNT_PATTERNS = {
  failed: /(?:^|\n)\s*(\d+)\s+failed(?:\s|$)/i,
  passed: /(?:^|\n)\s*(\d+)\s+passed(?:\s|$)/i,
  skipped: /(?:^|\n)\s*(\d+)\s+skipped(?:\s|$)/i,
} as const;

/** Builds a JUnit-like result object from console summary counts alone. */
export function buildConsoleOnlyJunitResults(
  commandOutput: string,
): JunitResults {
  return {
    failed: parsePlaywrightCount(commandOutput, "failed"),
    failedTests: [],
    passed: parsePlaywrightCount(commandOutput, "passed"),
    skipped: parsePlaywrightCount(commandOutput, "skipped"),
    skippedTests: [],
  };
}

function parsePlaywrightCount(
  commandOutput: string,
  label: keyof typeof PLAYWRIGHT_COUNT_PATTERNS,
): number {
  const match = PLAYWRIGHT_COUNT_PATTERNS[label].exec(commandOutput);

  return match ? Number.parseInt(match[1], 10) : 0;
}
