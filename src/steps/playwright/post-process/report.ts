import type {
  InlineTypeScriptPostProcessContext,
  PostProcessMessage,
  PostProcessSection,
} from "@/types/index.ts";

import {
  appendMissingReportMessage,
  appendTestResultSections,
  buildCommonCoverageState,
  parseJunitResults,
} from "@/steps/coverage/index.ts";

/** Applies Playwright report-file and test-result status rules. */
export function applyPlaywrightReportStatus(input: {
  coverageState: ReturnType<typeof buildCommonCoverageState>;
  existsSync: InlineTypeScriptPostProcessContext["existsSync"];
  junitResults: ReturnType<typeof parseJunitResults>;
  messages: PostProcessMessage[];
  sections: PostProcessSection[];
  status: "fail" | "pass";
}): "fail" | "pass" {
  const reportExists =
    Boolean(input.coverageState.reportPath) &&
    input.existsSync(input.coverageState.reportPath);

  if (!reportExists) {
    return applyMissingReportStatus(input);
  }

  return appendPlaywrightResultSections(input);
}

function appendPlaywrightResultSections(input: {
  junitResults: ReturnType<typeof parseJunitResults>;
  sections: PostProcessSection[];
  status: "fail" | "pass";
}): "fail" | "pass" {
  return appendTestResultSections(true, input.junitResults, input.sections)
    ? "fail"
    : input.status;
}

function applyMissingReportStatus(input: {
  coverageState: ReturnType<typeof buildCommonCoverageState>;
  junitResults: ReturnType<typeof parseJunitResults>;
  messages: PostProcessMessage[];
  status: "fail" | "pass";
}): "fail" | "pass" {
  if (
    input.junitResults.passed === 0 &&
    input.junitResults.failed === 0 &&
    input.junitResults.skipped === 0
  ) {
    appendMissingReportMessage(input.messages, input.coverageState.reportPath);
    return "fail";
  }

  return input.junitResults.failed > 0 ? "fail" : input.status;
}
