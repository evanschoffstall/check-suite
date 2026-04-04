import type { InlineTypeScriptPostProcessContext } from "@/types/index.ts";

import type { ConfigMessage, ConfigSection } from "../../types.ts";

import {
  buildCommonCoverageState,
  parseJunitResults,
} from "../coverage/index.ts";

/** Applies Playwright report-file and test-result status rules. */
export function applyPlaywrightReportStatus(input: {
  coverageState: ReturnType<typeof buildCommonCoverageState>;
  existsSync: InlineTypeScriptPostProcessContext["existsSync"];
  junitResults: ReturnType<typeof parseJunitResults>;
  messages: ConfigMessage[];
  sections: ConfigSection[];
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
  sections: ConfigSection[];
  status: "fail" | "pass";
}): "fail" | "pass" {
  let status = input.status;

  if (input.junitResults.failedTests.length > 0) {
    input.sections.push({
      items: input.junitResults.failedTests,
      title: "Failed tests",
      tone: "fail",
    });
    status = "fail";
  }

  if (input.junitResults.skippedTests.length > 0) {
    input.sections.push({
      items: input.junitResults.skippedTests,
      title: "Skipped tests",
      tone: "warn",
    });
  }

  return status;
}

function applyMissingReportStatus(input: {
  coverageState: ReturnType<typeof buildCommonCoverageState>;
  junitResults: ReturnType<typeof parseJunitResults>;
  messages: ConfigMessage[];
  status: "fail" | "pass";
}): "fail" | "pass" {
  if (
    input.junitResults.passed === 0 &&
    input.junitResults.failed === 0 &&
    input.junitResults.skipped === 0
  ) {
    input.messages.push({
      text: `Report file not found: ${input.coverageState.reportPath || "(unset)"}`,
      tone: "fail",
    });
    return "fail";
  }

  return input.junitResults.failed > 0 ? "fail" : input.status;
}
