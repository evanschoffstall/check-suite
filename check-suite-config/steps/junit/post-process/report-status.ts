import type {
  ConfigMessage,
  ConfigSection,
} from "../../../types.ts";

export function applyReportStatus(
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
