import type { InlineTypeScriptPostProcessContext } from "@/types/index.ts";

import type { JunitResults } from "./types.ts";

import { buildConsoleOnlyJunitResults } from "./console-results.ts";
import { formatTestResult, readXmlAttributes } from "./xml.ts";

/** Parses JUnit XML when present and falls back to console counts when absent. */
export function parseJunitResults(
  reportPath: string,
  commandOutput: string,
  existsSync: InlineTypeScriptPostProcessContext["existsSync"],
  readFileSync: InlineTypeScriptPostProcessContext["readFileSync"],
): JunitResults {
  if (!reportPath || !existsSync(reportPath)) {
    return buildConsoleOnlyJunitResults(commandOutput);
  }

  const report = readFileSync(reportPath, "utf8");
  const { failed, passed, skipped } = parseReportSummary(report);

  return {
    failed,
    failedTests: collectCaseResults(report, "failed"),
    passed,
    skipped,
    skippedTests: collectCaseResults(report, "skipped"),
  };
}

function collectCaseResults(
  report: string,
  resultType: "failed" | "skipped",
): string[] {
  const collectedResults: string[] = [];

  for (const match of report.matchAll(
    /<testcase\b([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase>)/g,
  )) {
    const body = match[2] ?? "";
    if (!matchesResultType(body, resultType)) {
      continue;
    }

    collectedResults.push(formatCaseResult(match, body));
  }

  return collectedResults;
}

function formatCaseResult(match: RegExpMatchArray, body: string): string {
  const test = readXmlAttributes(match[1] ?? "");

  return formatTestResult({
    file: test.file,
    line: test.line,
    message: readXmlAttributes(
      body.match(/<(?:failure|error)\b([^>]*)>/)?.[1] ?? "",
    ).message,
    name: test.name,
    suite: test.classname,
  });
}

function matchesResultType(
  body: string,
  resultType: "failed" | "skipped",
): boolean {
  return resultType === "skipped"
    ? /<skipped\b/.test(body)
    : !/<skipped\b/.test(body) &&
        (body.includes("<failure") || body.includes("<error"));
}

function parseReportSummary(report: string): {
  failed: number;
  passed: number;
  skipped: number;
} {
  const suitesAttributes = readXmlAttributes(
    report.match(/<testsuites\b([^>]*)>/)?.[1] ?? "",
  );
  const totalTests = Number.parseInt(suitesAttributes.tests ?? "0", 10);
  const failed = Number.parseInt(suitesAttributes.failures ?? "0", 10);
  const skipped = Number.parseInt(suitesAttributes.skipped ?? "0", 10);

  return {
    failed,
    passed: Math.max(0, totalTests - failed - skipped),
    skipped,
  };
}
