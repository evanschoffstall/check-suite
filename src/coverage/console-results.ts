import type { JunitResults } from "./types";

/** Line coverage totals parsed from a tool's console output. */
export interface ConsoleCoverageTotals {
  covered: number;
  found: number;
  pct: number;
}

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

/**
 * Bun coverage table row, e.g.:
 * `│ Lines │ 87.50% │ 7 │ 7 │ 8 │`
 */
const BUN_CONSOLE_LINE_COVERAGE_PATTERN =
  /(?:^|\n)\s*[│|]\s*Lines\s*[│|]\s*([\d.]+)\s*%\s*[│|]\s*([\d,]+)\s*[│|]\s*[\d,]+\s*[│|]\s*([\d,]+)\s*[│|]/u;

/**
 * Parses the line coverage percentage, covered lines, and total lines from
 * bun's console coverage table output. Returns `null` when the table row is
 * absent.
 */
export function parseBunConsoleCoverage(
  displayOutput: string,
): ConsoleCoverageTotals | null {
  const match = BUN_CONSOLE_LINE_COVERAGE_PATTERN.exec(displayOutput);
  if (!match) return null;

  return {
    covered: Number.parseInt(match[2].replace(/,/g, ""), 10),
    found: Number.parseInt(match[3].replace(/,/g, ""), 10),
    pct: Number.parseFloat(match[1]),
  };
}
