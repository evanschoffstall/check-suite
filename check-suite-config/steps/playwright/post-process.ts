import type {
  InlineTypeScriptPostProcessContext,
  StepPostProcessResult,
} from "@/types/index.ts";

import type { ConfigCheck, ConfigMessage, ConfigSection } from "../../types.ts";

import {
  buildCommonCoverageState,
  collectLineCoverage,
  parseJunitResults,
} from "../coverage/index.ts";

/**
 * Post-processes the Playwright step by using console coverage totals when
 * available and falling back to LCOV totals when path filters are active or the
 * summary row is missing.
 */
export function playwrightPostProcess({
  command,
  data,
  displayOutput,
  existsSync,
  helpers,
  readFileSync,
  resolveTokenString,
}: InlineTypeScriptPostProcessContext): StepPostProcessResult {
  const messages: ConfigMessage[] = [];
  const sections: ConfigSection[] = [];
  const extraChecks: ConfigCheck[] = [];
  const coverageState = buildCommonCoverageState(data, resolveTokenString, 0);
  const junitResults = parseJunitResults(
    coverageState.reportPath,
    displayOutput,
    existsSync,
    readFileSync,
  );
  let status: "fail" | "pass" = command.exitCode === 0 ? "pass" : "fail";

  if (!coverageState.reportPath || !existsSync(coverageState.reportPath)) {
    if (
      junitResults.passed === 0 &&
      junitResults.failed === 0 &&
      junitResults.skipped === 0
    ) {
      messages.push({
        text: `Report file not found: ${coverageState.reportPath || "(unset)"}`,
        tone: "fail",
      });
      status = "fail";
    } else if (junitResults.failed > 0) {
      status = "fail";
    }
  } else {
    if (junitResults.failedTests.length > 0) {
      sections.push({
        items: junitResults.failedTests,
        title: "Failed tests",
        tone: "fail",
      });
      status = "fail";
    }
    if (junitResults.skippedTests.length > 0) {
      sections.push({
        items: junitResults.skippedTests,
        title: "Skipped tests",
        tone: "warn",
      });
    }
  }

  const consoleLineCoverageMatch = displayOutput.match(
    /(?:^|\n)\s*[│|]\s*Lines\s*[│|]\s*([\d.]+)\s*%\s*[│|]\s*([\d,]+)\s*[│|]\s*[\d,]+\s*[│|]\s*([\d,]+)\s*[│|]/u,
  );
  const consoleLineCoverage = consoleLineCoverageMatch
    ? {
        covered: Number.parseInt(
          (consoleLineCoverageMatch[2] ?? "0").replace(/,/g, ""),
          10,
        ),
        found: Number.parseInt(
          (consoleLineCoverageMatch[3] ?? "0").replace(/,/g, ""),
          10,
        ),
        pct: Number.parseFloat(consoleLineCoverageMatch[1] ?? "0"),
      }
    : null;
  const hasCoveragePathFilters =
    coverageState.coverageIncludedPaths.length > 0 ||
    coverageState.coverageExcludedFiles.size > 0 ||
    coverageState.coverageExcludedPaths.length > 0;

  if (consoleLineCoverage && !hasCoveragePathFilters) {
    const coverageStatus: "fail" | "pass" =
      consoleLineCoverage.found > 0 &&
      consoleLineCoverage.pct >= coverageState.coverageThreshold
        ? "pass"
        : "fail";
    extraChecks.push({
      details: `${consoleLineCoverage.pct.toFixed(2)}% (${consoleLineCoverage.covered}/${consoleLineCoverage.found}) · threshold ${coverageState.coverageThreshold.toFixed(1)}%`,
      label: coverageState.coverageLabel,
      status: coverageStatus,
    });
    if (coverageStatus === "fail") {
      status = "fail";
    }
  } else {
    if (!consoleLineCoverage) {
      messages.push({
        text: "Coverage summary row not found in Playwright output; falling back to LCOV artifact totals.",
        tone: "warn",
      });
    }

    const coverageTotals = collectLineCoverage({
      coveragePath: coverageState.coveragePath,
      excludedFiles: coverageState.coverageExcludedFiles,
      excludedPaths: coverageState.coverageExcludedPaths,
      existsSync,
      includedPaths: coverageState.coverageIncludedPaths,
      readFileSync,
    });

    if (!coverageTotals) {
      messages.push({
        text: `Coverage report not found: ${coverageState.coveragePath || "(unset)"}`,
        tone: "fail",
      });
      extraChecks.push({
        details: `0.00% (0/0) · threshold ${coverageState.coverageThreshold.toFixed(1)}%`,
        label: coverageState.coverageLabel,
        status: "fail",
      });
      status = "fail";
    } else {
      const coverageStatus: "fail" | "pass" =
        coverageTotals.found > 0 &&
        coverageTotals.pct >= coverageState.coverageThreshold
          ? "pass"
          : "fail";
      extraChecks.push({
        details: `${coverageTotals.pct.toFixed(2)}% (${coverageTotals.covered}/${coverageTotals.found}) · threshold ${coverageState.coverageThreshold.toFixed(1)}%`,
        label: coverageState.coverageLabel,
        status: coverageStatus,
      });
      if (coverageTotals.found === 0) {
        messages.push({
          text: "No executable lines found in coverage report",
          tone: "fail",
        });
      }
      if (coverageStatus === "fail") {
        status = "fail";
      }
    }
  }

  return {
    extraChecks,
    messages,
    output: helpers.compactDomAssertionNoise(displayOutput),
    sections,
    status,
    summary: `${junitResults.passed} passed · ${junitResults.failed} failed · ${junitResults.skipped} skipped${command.exitCode === 0 ? "" : ` · runner exit ${command.exitCode}`}`,
  };
}
