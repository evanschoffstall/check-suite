import type { ConsoleCoverageTotals } from "@/quality/line-metrics/index.ts";
import type {
  InlineTypeScriptPostProcessContext,
  InlineTypeScriptPostProcessor,
  StepPostProcessResult,
} from "@/types/index.ts";

import {
  appendCoverageCheckResult,
  appendMissingReportMessage,
  appendTestResultSections,
  buildCommonCoverageState,
  buildTestSummary,
  collectLineCoverage,
  parseJunitResults,
} from "@/quality/line-metrics/index.ts";

/** Options for {@link buildTestCoveragePostProcess}. */
export interface TestCoveragePostProcessOptions {
  /**
   * Fallback coverage threshold when none is provided in the step data. The
   * step data value (if present) always takes precedence.
   */
  defaultThreshold: number;
  /**
   * If provided, the post-processor attempts to read coverage totals from the
   * test runner's console output before falling back to the LCOV file.
   * When `null` is returned the post-processor logs a warning and falls back.
   *
   * Useful for test runners that print a coverage summary table, e.g. bun's
   * built-in coverage reporter.
   */
  parseConsoleCoverage?: (
    displayOutput: string,
  ) => ConsoleCoverageTotals | null;
}

/**
 * Returns an {@link InlineTypeScriptPostProcessor} that handles JUnit XML
 * test results and LCOV line coverage for a generic test step.
 *
 * Pass `parseConsoleCoverage` (e.g. {@link parseBunConsoleCoverage}) to enable
 * the playwright/bun coverage-table path: the post-processor will use console
 * totals when no path filters are active, and fall back to the LCOV artifact
 * when path filters are set or the table row is absent.
 *
 * Without `parseConsoleCoverage` the post-processor uses the LCOV file only
 * and always fails when the JUnit report is missing.
 *
 * @example
 * ```ts
 * // junit — LCOV only, strict report requirement
 * const junitPostProcess = buildTestCoveragePostProcess({ defaultThreshold: 85 });
 *
 * // playwright — console coverage preferred, lenient missing-report handling
 * const playwrightPostProcess = buildTestCoveragePostProcess({
 *   defaultThreshold: 55,
 *   parseConsoleCoverage: parseBunConsoleCoverage,
 * });
 * ```
 */
export function buildTestCoveragePostProcess(
  options: TestCoveragePostProcessOptions,
): InlineTypeScriptPostProcessor {
  return ({
    command,
    data,
    displayOutput,
    existsSync,
    helpers,
    readFileSync,
    resolveTokenString,
  }: InlineTypeScriptPostProcessContext): StepPostProcessResult => {
    const coverageState = buildCommonCoverageState(
      data,
      resolveTokenString,
      options.defaultThreshold,
    );
    const junitResults = parseJunitResults(
      coverageState.reportPath,
      displayOutput,
      existsSync,
      readFileSync,
    );
    const reportExists =
      Boolean(coverageState.reportPath) && existsSync(coverageState.reportPath);

    const extraChecks: NonNullable<StepPostProcessResult["extraChecks"]> = [];
    const messages: NonNullable<StepPostProcessResult["messages"]> = [];
    const sections: NonNullable<StepPostProcessResult["sections"]> = [];
    let status: "fail" | "pass" = command.exitCode === 0 ? "pass" : "fail";

    // Report + test result status
    if (!reportExists) {
      status = resolveMissingReportStatus(
        options,
        junitResults,
        messages,
        coverageState.reportPath,
        status,
      );
    } else if (appendTestResultSections(true, junitResults, sections)) {
      status = "fail";
    }

    // Coverage status
    const coverageTotals = resolveCoverageTotals(
      options,
      coverageState,
      displayOutput,
      messages,
      existsSync,
      readFileSync,
    );

    if (
      appendCoverageCheckResult(
        {
          coverageLabel: coverageState.coverageLabel,
          coveragePath: coverageState.coveragePath,
          coverageThreshold: coverageState.coverageThreshold,
          totals: coverageTotals,
        },
        messages,
        extraChecks,
      )
    ) {
      status = "fail";
    }

    return {
      extraChecks,
      messages,
      output: helpers.compactDomAssertionNoise(displayOutput),
      sections,
      status,
      summary: buildTestSummary(junitResults, command.exitCode),
    };
  };
}

function resolveCoverageTotals(
  options: TestCoveragePostProcessOptions,
  coverageState: ReturnType<typeof buildCommonCoverageState>,
  displayOutput: string,
  messages: NonNullable<StepPostProcessResult["messages"]>,
  existsSync: InlineTypeScriptPostProcessContext["existsSync"],
  readFileSync: InlineTypeScriptPostProcessContext["readFileSync"],
): ConsoleCoverageTotals | null {
  if (options.parseConsoleCoverage) {
    const consoleTotals = options.parseConsoleCoverage(displayOutput);
    const hasPathFilters =
      coverageState.coverageIncludedPaths.length > 0 ||
      coverageState.coverageExcludedFiles.size > 0 ||
      coverageState.coverageExcludedPaths.length > 0;

    if (consoleTotals && !hasPathFilters) {
      return consoleTotals;
    }

    if (!consoleTotals) {
      messages.push({
        text: "Coverage summary row not found in output; falling back to LCOV artifact totals.",
        tone: "warn",
      });
    }
  }

  return collectLineCoverage({
    coveragePath: coverageState.coveragePath,
    excludedFiles: coverageState.coverageExcludedFiles,
    excludedPaths: coverageState.coverageExcludedPaths,
    existsSync,
    includedPaths: coverageState.coverageIncludedPaths,
    readFileSync,
  });
}

function resolveMissingReportStatus(
  options: TestCoveragePostProcessOptions,
  junitResults: ReturnType<typeof parseJunitResults>,
  messages: NonNullable<StepPostProcessResult["messages"]>,
  reportPath: string,
  currentStatus: "fail" | "pass",
): "fail" | "pass" {
  // Lenient mode (e.g. playwright): if test counts exist from console output,
  // use them to drive status rather than always failing on a missing XML report.
  if (options.parseConsoleCoverage) {
    const anyTestsRan =
      junitResults.passed > 0 ||
      junitResults.failed > 0 ||
      junitResults.skipped > 0;

    if (!anyTestsRan) {
      appendMissingReportMessage(messages, reportPath);
      return "fail";
    }

    return junitResults.failed > 0 ? "fail" : currentStatus;
  }

  // Strict mode (e.g. junit): always fail when the report is missing.
  appendMissingReportMessage(messages, reportPath);
  return "fail";
}
