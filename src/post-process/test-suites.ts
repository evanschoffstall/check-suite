import type { InlineTypeScriptPostProcessContext } from "@/types/index.ts";

/**
 * Normalized execution summary parsed from a test-suites style XML report or
 * reconstructed from console output when no report artifact exists.
 */
export interface TestSuitesExecutionReport {
  failed: number;
  failedItems: string[];
  passed: number;
  skipped: number;
  skippedItems: string[];
}

/** Builds a compact human-readable summary for a normalized execution report. */
export function buildExecutionReportSummary(
  report: Pick<TestSuitesExecutionReport, "failed" | "passed" | "skipped">,
  exitCode: number,
): string {
  return `${report.passed} passed · ${report.failed} failed · ${report.skipped} skipped${exitCode === 0 ? "" : ` · runner exit ${exitCode}`}`;
}

/**
 * Parses a `<testsuites>` XML report into a normalized execution summary.
 * When the report file is absent, it falls back to extracting counts from the
 * command output so callers can still summarize runner results.
 */
export function parseTestSuitesXmlReport(
  reportPath: string,
  commandOutput: string,
  existsSync: InlineTypeScriptPostProcessContext["existsSync"],
  readFileSync: InlineTypeScriptPostProcessContext["readFileSync"],
): TestSuitesExecutionReport {
  if (!reportPath || !existsSync(reportPath)) {
    return buildConsoleOnlyReport(commandOutput);
  }

  const report = readFileSync(reportPath, "utf8");
  const suites = readXmlAttributes(
    /<testsuites\b([^>]*)>/.exec(report)?.[1] ?? "",
  );
  const failed = Number.parseInt(suites.failures ?? "0", 10);
  const skipped = Number.parseInt(suites.skipped ?? "0", 10);
  const totalTests = Number.parseInt(suites.tests ?? "0", 10);

  return {
    failed,
    failedItems: collectCaseResults(report, "failed"),
    passed: Math.max(0, totalTests - failed - skipped),
    skipped,
    skippedItems: collectCaseResults(report, "skipped"),
  };
}

function buildConsoleOnlyReport(
  commandOutput: string,
): TestSuitesExecutionReport {
  return {
    failed: parseConsoleCount(commandOutput, "failed"),
    failedItems: [],
    passed: parseConsoleCount(commandOutput, "passed"),
    skipped: parseConsoleCount(commandOutput, "skipped"),
    skippedItems: [],
  };
}

function collectCaseResults(
  report: string,
  resultType: "failed" | "skipped",
): string[] {
  return [
    ...report.matchAll(/<testcase\b([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase>)/g),
  ].flatMap((match) => {
    const body = match[0].endsWith("/>") ? "" : match[2];
    const include =
      resultType === "skipped"
        ? /<skipped\b/.test(body)
        : !/<skipped\b/.test(body) &&
          (body.includes("<failure") || body.includes("<error"));
    if (!include) {
      return [];
    }

    const failure = readXmlAttributes(
      /<(?:failure|error)\b([^>]*)>/.exec(body)?.[1] ?? "",
    );
    const test = readXmlAttributes(match[1]);
    return [
      `${test.file ?? "unknown-file"}${test.line ? `:${test.line}` : ""} - ${test.classname ? `${test.classname} > ` : ""}${test.name ?? "(unnamed test)"}${failure.message ? ` [${failure.message}]` : ""}`,
    ];
  });
}

function parseConsoleCount(
  commandOutput: string,
  label: "failed" | "passed" | "skipped",
): number {
  const match = (
    {
      failed: /(?:^|\n)\s*(\d+)\s+failed(?:\s|$)/i,
      passed: /(?:^|\n)\s*(\d+)\s+passed(?:\s|$)/i,
      skipped: /(?:^|\n)\s*(\d+)\s+skipped(?:\s|$)/i,
    } as const
  )[label].exec(commandOutput);

  return match ? Number.parseInt(match[1], 10) : 0;
}

function readXmlAttributes(raw: string): Partial<Record<string, string>> {
  return Object.fromEntries(
    [...raw.matchAll(/(\w+)="([^"]*)"/g)].map((match) => [match[1], match[2]]),
  );
}
