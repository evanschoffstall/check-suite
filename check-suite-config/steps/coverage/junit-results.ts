import type { InlineTypeScriptPostProcessContext } from "../../../src/types/index.ts";

/** Parsed JUnit totals and expanded failing/skipped test labels. */
export interface JunitResults {
  failed: number;
  failedTests: string[];
  passed: number;
  skipped: number;
  skippedTests: string[];
}

export function parseJunitResults(
  reportPath: string,
  commandOutput: string,
  existsSync: InlineTypeScriptPostProcessContext["existsSync"],
  readFileSync: InlineTypeScriptPostProcessContext["readFileSync"],
): JunitResults {
  const parsePlaywrightCount = (label: string): number => {
    const match = commandOutput.match(
      new RegExp(`(?:^|\\n)\\s*(\\d+)\\s+${label}(?:\\s|$)`, "i"),
    );
    return match ? Number.parseInt(match[1] ?? "0", 10) : 0;
  };

  if (!reportPath || !existsSync(reportPath)) {
    return {
      failed: parsePlaywrightCount("failed"),
      failedTests: [],
      passed: parsePlaywrightCount("passed"),
      skipped: parsePlaywrightCount("skipped"),
      skippedTests: [],
    };
  }

  const report = readFileSync(reportPath, "utf8");
  const suitesAttributes = readXmlAttributes(
    report.match(/<testsuites\b([^>]*)>/)?.[1] ?? "",
  );
  const totalTests = Number.parseInt(suitesAttributes.tests ?? "0", 10);
  const failed = Number.parseInt(suitesAttributes.failures ?? "0", 10);
  const skipped = Number.parseInt(suitesAttributes.skipped ?? "0", 10);
  const passed = Math.max(0, totalTests - failed - skipped);
  const failedTests: string[] = [];
  const skippedTests: string[] = [];

  for (const match of report.matchAll(
    /<testcase\b([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase>)/g,
  )) {
    const test = readXmlAttributes(match[1] ?? "");
    const body = match[2] ?? "";
    if (
      !/<skipped\b/.test(body) &&
      !body.includes("<failure") &&
      !body.includes("<error")
    ) {
      continue;
    }

    const formatted = formatTestResult({
      file: test.file,
      line: test.line,
      message: readXmlAttributes(
        body.match(/<(?:failure|error)\b([^>]*)>/)?.[1] ?? "",
      ).message,
      name: test.name,
      suite: test.classname,
    });

    if (/<skipped\b/.test(body)) {
      skippedTests.push(formatted);
      continue;
    }

    failedTests.push(formatted);
  }

  return { failed, failedTests, passed, skipped, skippedTests };
}

function formatTestResult(test: {
  file?: string;
  line?: string;
  message?: string;
  name?: string;
  suite?: string;
}): string {
  return `${test.file ?? "unknown-file"}${test.line ? `:${test.line}` : ""} - ${test.suite ? `${test.suite} > ` : ""}${test.name ?? "(unnamed test)"}${test.message ? ` [${test.message}]` : ""}`;
}

function readXmlAttributes(raw: string): Record<string, string> {
  return Object.fromEntries(
    [...raw.matchAll(/(\w+)="([^"]*)"/g)].flatMap((match) =>
      match[1] ? [[match[1], match[2] ?? ""]] : [],
    ),
  );
}
