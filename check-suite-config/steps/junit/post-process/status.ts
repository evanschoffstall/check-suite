import type { InlineTypeScriptPostProcessContext } from "@/types/index.ts";

import type {
  ConfigCheck,
  ConfigMessage,
  ConfigSection,
} from "../../../types.ts";

import {
  buildCommonCoverageState,
  collectLineCoverage,
} from "../../coverage/index.ts";

interface CoverageStatusInput {
  currentStatus: "fail" | "pass";
  data: Record<string, unknown>;
  existsSync: InlineTypeScriptPostProcessContext["existsSync"];
  extraChecks: ConfigCheck[];
  messages: ConfigMessage[];
  readFileSync: InlineTypeScriptPostProcessContext["readFileSync"];
  resolveTokenString: (value: string) => string;
}

interface ReportStatusInput {
  currentStatus: "fail" | "pass";
  failedTests: string[];
  messages: ConfigMessage[];
  reportExists: boolean;
  reportPath: string;
  sections: ConfigSection[];
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
    input.messages.push({
      text: `Report file not found: ${input.reportPath || "(unset)"}`,
      tone: "fail",
    });
    status = "fail";
  }

  if (
    appendJunitSections(
      input.reportExists,
      input.failedTests,
      input.skippedTests,
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
  messages: ConfigMessage[],
  extraChecks: ConfigCheck[],
): boolean {
  const { coverageLabel, coveragePath, coverageThreshold, totals } = input;
  if (!totals) {
    messages.push({
      text: `Coverage report not found: ${coveragePath || "(unset)"}`,
      tone: "fail",
    });
    extraChecks.push({
      details: `0.00% (0/0) · threshold ${coverageThreshold.toFixed(1)}%`,
      label: coverageLabel,
      status: "fail",
    });
    return true;
  }

  const coverageStatus: "fail" | "pass" =
    totals.found > 0 && totals.pct >= coverageThreshold ? "pass" : "fail";

  extraChecks.push({
    details: `${totals.pct.toFixed(2)}% (${totals.covered}/${totals.found}) · threshold ${coverageThreshold.toFixed(1)}%`,
    label: coverageLabel,
    status: coverageStatus,
  });

  if (totals.found === 0) {
    messages.push({
      text: "No executable lines found in coverage report",
      tone: "fail",
    });
  }

  return coverageStatus === "fail";
}

function appendJunitSections(
  reportExists: boolean,
  failedTests: string[],
  skippedTests: string[],
  sections: ConfigSection[],
): boolean {
  let failed = false;
  if (!reportExists) {
    return failed;
  }

  if (failedTests.length > 0) {
    sections.push({ items: failedTests, title: "Failed tests", tone: "fail" });
    failed = true;
  }

  if (skippedTests.length > 0) {
    sections.push({
      items: skippedTests,
      title: "Skipped tests",
      tone: "warn",
    });
  }

  return failed;
}
