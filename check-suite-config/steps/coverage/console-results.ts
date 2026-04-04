import type { JunitResults } from "./types.ts";

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

function parsePlaywrightCount(commandOutput: string, label: string): number {
  const match = commandOutput.match(
    new RegExp(`(?:^|\\n)\\s*(\\d+)\\s+${label}(?:\\s|$)`, "i"),
  );

  return match ? Number.parseInt(match[1] ?? "0", 10) : 0;
}
