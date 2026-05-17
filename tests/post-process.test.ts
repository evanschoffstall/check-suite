import { describe, expect, test } from "bun:test";

import type { InlineTypeScriptPostProcessContext } from "../src/types/index.ts";

import {
  collectLineHitRatioTotals,
  createExecutionMetricPostProcess,
  createLineHitRatioResolver,
  parseSummaryTableTotals,
  parseTestSuitesXmlReport,
} from "../src/post-process/index.ts";

const readXmlReport = ((..._args) =>
  '<testsuites tests="3" failures="1" skipped="1"><testsuite><testcase file="a.ts" line="4" classname="suite" name="fails"><failure message="boom"></failure></testcase><testcase file="b.ts" line="8" classname="suite" name="skip"><skipped/></testcase><testcase file="c.ts" line="12" classname="suite" name="pass"/></testsuite></testsuites>') as InlineTypeScriptPostProcessContext["readFileSync"];

const readLcovReport = ((..._args) =>
  [
    "SF:src/keep.ts",
    "DA:1,1",
    "DA:2,0",
    "SF:src/skip.ts",
    "DA:1,1",
    "SF:src/excluded/file.ts",
    "DA:1,1",
  ].join("\n")) as InlineTypeScriptPostProcessContext["readFileSync"];

describe("post-process helpers", () => {
  test("parses test-suites xml reports into a normalized execution summary", () => {
    const report = parseTestSuitesXmlReport(
      "report.xml",
      "",
      (filePath) => filePath === "report.xml",
      readXmlReport,
    );

    expect(report).toEqual({
      failed: 1,
      failedItems: ["a.ts:4 - suite > fails [boom]"],
      passed: 1,
      skipped: 1,
      skippedItems: ["b.ts:8 - suite > skip"],
    });
  });

  test("parses line-coverage totals from a summary row", () => {
    const totals = parseSummaryTableTotals(
      "| Lines | 82.50 % | 33 | 7 | 40 |",
      /\|\s*Lines\s*\|\s*([\d.]+)\s*%\s*\|\s*([\d,]+)\s*\|\s*[\d,]+\s*\|\s*([\d,]+)\s*\|/u,
    );

    expect(totals).toEqual({ covered: 33, found: 40, pct: 82.5 });
  });

  test("aggregates LCOV totals while honoring include and exclude filters", () => {
    const totals = collectLineHitRatioTotals({
      artifactPath: "coverage/lcov.info",
      excludedFiles: new Set(["src/skip.ts"]),
      excludedPaths: ["src/excluded"],
      existsSync: (filePath) => filePath === "coverage/lcov.info",
      includedPaths: ["src"],
      readFileSync: readLcovReport,
    });

    expect(totals).toEqual({ covered: 1, found: 2, pct: 50 });
  });

  test("composes a generic execution report with a thresholded metric resolver", async () => {
    const postProcess = createExecutionMetricPostProcess({
      metricLabel: "line metric",
      metricPath: "coverage/lcov.info",
      reportPath: "report.xml",
      resolveMetric: createLineHitRatioResolver({ includedPaths: ["src"] }),
      threshold: 50,
    });
    const runPostProcess = postProcess.source as Exclude<
      typeof postProcess.source,
      string
    >;

    const result = await runPostProcess({
      command: { exitCode: 0, output: "", timedOut: false },
      cwd: process.cwd(),
      data: postProcess.data ?? {},
      displayOutput: "",
      existsSync: ((filePath) =>
        String(filePath) === "report.xml" ||
        String(filePath) ===
          "coverage/lcov.info") as InlineTypeScriptPostProcessContext["existsSync"],
      helpers: {
        compactDomAssertionNoise: (output: string) => output,
        stripAnsi: (value: string) => value,
      },
      join: (...parts: string[]) => parts.join("/"),
      readFileSync: ((filePath) =>
        filePath === "report.xml"
          ? '<testsuites tests="1" failures="0" skipped="0"><testsuite><testcase file="src/keep.ts" line="1" classname="suite" name="passes"/></testsuite></testsuites>'
          : ["SF:src/keep.ts", "DA:1,1", "DA:2,0"].join(
              "\n",
            )) as InlineTypeScriptPostProcessContext["readFileSync"],
      resolveTokenString: (value: string) => value,
      step: {},
      tokens: {},
    });

    expect(result.status).toBe("pass");
    expect(result.summary).toBe("1 passed · 0 failed · 0 skipped");
    expect(result.extraChecks).toEqual([
      {
        details: "50.00% (1/2) · threshold 50.0%",
        label: "line metric",
        status: "pass",
      },
    ]);
  });
});
