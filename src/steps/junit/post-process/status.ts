import type {
  InlineTypeScriptPostProcessContext,
  PostProcessMessage,
  PostProcessSection,
  ProcessedCheck,
} from "@/types/index.ts";

import {
  appendCoverageCheckResult,
  appendMissingReportMessage,
  appendTestResultSections,
  buildCommonCoverageState,
  collectLineCoverage,
} from "@/steps/coverage/index.ts";

interface CoverageStatusInput {
  currentStatus: "fail" | "pass";
  data: Record<string, unknown>;
  existsSync: InlineTypeScriptPostProcessContext["existsSync"];
  extraChecks: ProcessedCheck[];
  messages: PostProcessMessage[];
  readFileSync: InlineTypeScriptPostProcessContext["readFileSync"];
  resolveTokenString: (value: string) => string;
}

interface ReportStatusInput {
  currentStatus: "fail" | "pass";
  failedTests: string[];
  messages: PostProcessMessage[];
  reportExists: boolean;
  reportPath: string;
  sections: PostProcessSection[];
  skippedTests: string[];
}

/** Applies coverage status and adds the derived extra check row. */
export function applyCoverageStatus(
  input: CoverageStatusInput,
): "fail" | "pass" {
  const coverageState = buildCommonCoverageState(
    input.data,
    input.resolveTokenString,
    85,
  );
  const coverageTotals = collectLineCoverage({
    coveragePath: coverageState.coveragePath,
    excludedFiles: coverageState.coverageExcludedFiles,
    excludedPaths: coverageState.coverageExcludedPaths,
    existsSync: input.existsSync,
    includedPaths: coverageState.coverageIncludedPaths,
    readFileSync: input.readFileSync,
  });

  return appendCoverageCheck(
    {
      coverageLabel: coverageState.coverageLabel,
      coveragePath: coverageState.coveragePath,
      coverageThreshold: coverageState.coverageThreshold,
      totals: coverageTotals,
    },
    input.messages,
    input.extraChecks,
  )
    ? "fail"
    : input.currentStatus;
}

/** Applies report-path and failed/skipped test status to the overall result. */
export function applyReportStatus(input: ReportStatusInput): "fail" | "pass" {
  let status = input.currentStatus;

  if (!input.reportExists) {
    appendMissingReportMessage(input.messages, input.reportPath);
    status = "fail";
  }

  if (
    appendTestResultSections(
      input.reportExists,
      { failedTests: input.failedTests, skippedTests: input.skippedTests },
      input.sections,
    )
  ) {
    status = "fail";
  }

  return status;
}

function appendCoverageCheck(
  input: {
    coverageLabel: string;
    coveragePath: string;
    coverageThreshold: number;
    totals: null | { covered: number; found: number; pct: number };
  },
  messages: PostProcessMessage[],
  extraChecks: ProcessedCheck[],
): boolean {
  return appendCoverageCheckResult(input, messages, extraChecks);
}
