import type {
  PostProcessMessage,
  PostProcessSection,
  ProcessedCheck,
} from "@/types/index.ts";

import type { JunitResults } from "./types";

/** Shared numeric coverage totals derived from LCOV or console summaries. */
export interface CoverageTotals {
  covered: number;
  found: number;
  pct: number;
}

/** Appends a coverage check row and returns whether the coverage status failed. */
export function appendCoverageCheckResult(
  input: {
    coverageLabel: string;
    coveragePath?: string;
    coverageThreshold: number;
    totals: CoverageTotals | null;
  },
  messages: PostProcessMessage[],
  extraChecks: ProcessedCheck[],
): boolean {
  if (!input.totals) {
    messages.push({
      text: `Coverage report not found: ${input.coveragePath ?? "(unset)"}`,
      tone: "fail",
    });
    extraChecks.push({
      details: `0.00% (0/0) · threshold ${input.coverageThreshold.toFixed(1)}%`,
      label: input.coverageLabel,
      status: "fail",
    });
    return true;
  }

  const coverageStatus: "fail" | "pass" =
    input.totals.found > 0 && input.totals.pct >= input.coverageThreshold
      ? "pass"
      : "fail";

  extraChecks.push({
    details: `${input.totals.pct.toFixed(2)}% (${input.totals.covered}/${input.totals.found}) · threshold ${input.coverageThreshold.toFixed(1)}%`,
    label: input.coverageLabel,
    status: coverageStatus,
  });

  if (input.totals.found === 0) {
    messages.push({
      text: "No executable lines found in coverage report",
      tone: "fail",
    });
  }

  return coverageStatus === "fail";
}

/** Appends a report-missing message using the repository's standard wording. */
export function appendMissingReportMessage(
  messages: PostProcessMessage[],
  reportPath?: string,
): void {
  messages.push({
    text: `Report file not found: ${reportPath ?? "(unset)"}`,
    tone: "fail",
  });
}

/** Appends failed and skipped test sections and returns whether failures were found. */
export function appendTestResultSections(
  reportExists: boolean,
  junitResults: Pick<JunitResults, "failedTests" | "skippedTests">,
  sections: PostProcessSection[],
): boolean {
  if (!reportExists) {
    return false;
  }

  let hasFailures = false;

  if (junitResults.failedTests.length > 0) {
    sections.push({
      items: junitResults.failedTests,
      title: "Failed tests",
      tone: "fail",
    });
    hasFailures = true;
  }

  if (junitResults.skippedTests.length > 0) {
    sections.push({
      items: junitResults.skippedTests,
      title: "Skipped tests",
      tone: "warn",
    });
  }

  return hasFailures;
}

/** Builds the normalized summary string used by test-report post-processors. */
export function buildTestSummary(
  junitResults: Pick<JunitResults, "failed" | "passed" | "skipped">,
  exitCode: number,
): string {
  return `${junitResults.passed} passed · ${junitResults.failed} failed · ${junitResults.skipped} skipped${exitCode === 0 ? "" : ` · runner exit ${exitCode}`}`;
}
