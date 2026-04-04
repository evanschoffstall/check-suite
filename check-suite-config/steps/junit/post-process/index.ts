import type {
  InlineTypeScriptPostProcessContext,
  StepPostProcessResult,
} from "@/types/index.ts";

import type {
  ConfigCheck,
  ConfigMessage,
  ConfigSection,
} from "../../../types.ts";

import {
  buildCommonCoverageState,
  parseJunitResults,
} from "../../coverage/index.ts";
import { applyCoverageStatus, applyReportStatus } from "./status.ts";

interface BuildJunitResultInput {
  displayOutput: string;
  exitCode: number;
  helpers: InlineTypeScriptPostProcessContext["helpers"];
  state: JunitState;
  status: "fail" | "pass";
}

interface CoverageCheckInput {
  coverageLabel: string;
  coveragePath: string;
  coverageThreshold: number;
  totals: null | { covered: number; found: number; pct: number };
}

interface JunitState {
  coverageState: ReturnType<typeof buildCommonCoverageState>;
  extraChecks: ConfigCheck[];
  junitResults: ReturnType<typeof parseJunitResults>;
  messages: ConfigMessage[];
  reportExists: boolean;
  sections: ConfigSection[];
}

export function junitPostProcess({
  command,
  data,
  displayOutput,
  existsSync,
  helpers,
  readFileSync,
  resolveTokenString,
}: InlineTypeScriptPostProcessContext): StepPostProcessResult {
  const state = buildJunitState(
    data,
    resolveTokenString,
    displayOutput,
    existsSync,
    readFileSync,
  );
  let status: "fail" | "pass" = command.exitCode === 0 ? "pass" : "fail";
  status = resolveJunitStatus(
    { data, existsSync, readFileSync, resolveTokenString },
    status,
    state,
  );

  return buildJunitResult({
    displayOutput,
    exitCode: command.exitCode,
    helpers,
    state,
    status,
  });
}

function appendCoverageCheck(
  input: CoverageCheckInput,
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
  if (!reportExists) return failed;

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

function applyCoverageStatus(
  data: Record<string, unknown>,
  resolveTokenString: (value: string) => string,
  existsSync: InlineTypeScriptPostProcessContext["existsSync"],
  readFileSync: InlineTypeScriptPostProcessContext["readFileSync"],
  messages: ConfigMessage[],
  extraChecks: ConfigCheck[],
  currentStatus: "fail" | "pass",
): "fail" | "pass" {
  const coverageState = buildCommonCoverageState(data, resolveTokenString, 85);
  const coverageTotals = collectLineCoverage({
    coveragePath: coverageState.coveragePath,
    excludedFiles: coverageState.coverageExcludedFiles,
    excludedPaths: coverageState.coverageExcludedPaths,
    existsSync,
    includedPaths: coverageState.coverageIncludedPaths,
    readFileSync,
  });

  return appendCoverageCheck(
    {
      coverageLabel: coverageState.coverageLabel,
      coveragePath: coverageState.coveragePath,
      coverageThreshold: coverageState.coverageThreshold,
      totals: coverageTotals,
    },
    messages,
    extraChecks,
  )
    ? "fail"
    : currentStatus;
}

function applyReportStatus(
  reportExists: boolean,
  reportPath: string,
  failedTests: string[],
  skippedTests: string[],
  messages: ConfigMessage[],
  sections: ConfigSection[],
  currentStatus: "fail" | "pass",
): "fail" | "pass" {
  let status = currentStatus;

  if (!reportExists) {
    messages.push({
      text: `Report file not found: ${reportPath || "(unset)"}`,
      tone: "fail",
    });
    status = "fail";
  }

  if (appendJunitSections(reportExists, failedTests, skippedTests, sections)) {
    status = "fail";
  }

  return status;
}

function buildJunitResult(input: BuildJunitResultInput): StepPostProcessResult {
  const { displayOutput, exitCode, helpers, state, status } = input;

  return {
    extraChecks: state.extraChecks,
    messages: state.messages,
    output: helpers.compactDomAssertionNoise(displayOutput),
    sections: state.sections,
    status,
    summary: `${state.junitResults.passed} passed · ${state.junitResults.failed} failed · ${state.junitResults.skipped} skipped${exitCode === 0 ? "" : ` · runner exit ${exitCode}`}`,
  };
}

function buildJunitState(
  data: Record<string, unknown>,
  resolveTokenString: InlineTypeScriptPostProcessContext["resolveTokenString"],
  displayOutput: string,
  existsSync: InlineTypeScriptPostProcessContext["existsSync"],
  readFileSync: InlineTypeScriptPostProcessContext["readFileSync"],
): JunitState {
  const coverageState = buildCommonCoverageState(data, resolveTokenString, 85);
  const junitResults = parseJunitResults(
    coverageState.reportPath,
    displayOutput,
    existsSync,
    readFileSync,
  );

  return {
    coverageState,
    extraChecks: [],
    junitResults,
    messages: [],
    reportExists:
      Boolean(coverageState.reportPath) && existsSync(coverageState.reportPath),
    sections: [],
  };
}

function resolveJunitStatus(
  context: Pick<
    InlineTypeScriptPostProcessContext,
    "data" | "existsSync" | "readFileSync" | "resolveTokenString"
  >,
  status: "fail" | "pass",
  state: ReturnType<typeof buildJunitState>,
): "fail" | "pass" {
  const { data, existsSync, readFileSync, resolveTokenString } = context;

  let resolvedStatus = applyReportStatus(
    state.reportExists,
    state.coverageState.reportPath,
    state.junitResults.failedTests,
    state.junitResults.skippedTests,
    state.messages,
    state.sections,
    status,
  );

  resolvedStatus = applyCoverageStatus(
    data,
    resolveTokenString,
    existsSync,
    readFileSync,
    state.messages,
    state.extraChecks,
    resolvedStatus,
  );

  return resolvedStatus;
}
