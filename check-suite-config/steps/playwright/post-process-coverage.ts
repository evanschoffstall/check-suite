import type { InlineTypeScriptPostProcessContext } from "@/types/index.ts";

import type { ConfigCheck, ConfigMessage } from "../../types.ts";

import {
  buildCommonCoverageState,
  collectLineCoverage,
} from "../coverage/index.ts";

const CONSOLE_LINE_COVERAGE_PATTERN =
  /(?:^|\n)\s*[│|]\s*Lines\s*[│|]\s*([\d.]+)\s*%\s*[│|]\s*([\d,]+)\s*[│|]\s*[\d,]+\s*[│|]\s*([\d,]+)\s*[│|]/u;

interface CoverageResult {
  covered: number;
  found: number;
  pct: number;
}

/** Applies Playwright coverage status using console totals when possible, else LCOV totals. */
export function applyPlaywrightCoverageStatus(input: {
  coverageState: ReturnType<typeof buildCommonCoverageState>;
  displayOutput: string;
  existsSync: InlineTypeScriptPostProcessContext["existsSync"];
  extraChecks: ConfigCheck[];
  messages: ConfigMessage[];
  readFileSync: InlineTypeScriptPostProcessContext["readFileSync"];
  status: "fail" | "pass";
}): "fail" | "pass" {
  const consoleLineCoverage = parseConsoleLineCoverage(input.displayOutput);
  if (consoleLineCoverage && !hasCoveragePathFilters(input.coverageState)) {
    return appendCoverageResult(
      {
        coverageLabel: input.coverageState.coverageLabel,
        coverageThreshold: input.coverageState.coverageThreshold,
        totals: consoleLineCoverage,
      },
      input.extraChecks,
      input.messages,
      input.status,
    );
  }

  if (!consoleLineCoverage) {
    input.messages.push({
      text: "Coverage summary row not found in Playwright output; falling back to LCOV artifact totals.",
      tone: "warn",
    });
  }

  return appendCoverageResult(
    {
      coverageLabel: input.coverageState.coverageLabel,
      coverageThreshold: input.coverageState.coverageThreshold,
      totals: collectArtifactCoverageTotals(input),
    },
    input.extraChecks,
    input.messages,
    input.status,
    input.coverageState.coveragePath,
  );
}

function appendCoverageResult(
  input: {
    coverageLabel: string;
    coverageThreshold: number;
    totals: CoverageResult | null;
  },
  extraChecks: ConfigCheck[],
  messages: ConfigMessage[],
  status: "fail" | "pass",
  coveragePath?: string,
): "fail" | "pass" {
  if (!input.totals) {
    messages.push({
      text: `Coverage report not found: ${coveragePath || "(unset)"}`,
      tone: "fail",
    });
    extraChecks.push({
      details: `0.00% (0/0) · threshold ${input.coverageThreshold.toFixed(1)}%`,
      label: input.coverageLabel,
      status: "fail",
    });
    return "fail";
  }

  const coverageStatus: "fail" | "pass" =
    input.totals.found > 0 && input.totals.pct >= input.coverageThreshold
      ? "pass"
      : "fail";

  extraChecks.push({
    details: `${input.totals.pct.toFixed(2)}% (${input.totals.covered}/${input.totals.found}) · threshold ${input.coverageThreshold.toFixed(1)}%`,
    label: input.coverageLabel,
    status: coverageStatus,
  });

  if (input.totals.found === 0) {
    messages.push({
      text: "No executable lines found in coverage report",
      tone: "fail",
    });
  }

  return coverageStatus === "fail" ? "fail" : status;
}

function collectArtifactCoverageTotals(input: {
  coverageState: ReturnType<typeof buildCommonCoverageState>;
  existsSync: InlineTypeScriptPostProcessContext["existsSync"];
  readFileSync: InlineTypeScriptPostProcessContext["readFileSync"];
}): CoverageResult | null {
  return collectLineCoverage({
    coveragePath: input.coverageState.coveragePath,
    excludedFiles: input.coverageState.coverageExcludedFiles,
    excludedPaths: input.coverageState.coverageExcludedPaths,
    existsSync: input.existsSync,
    includedPaths: input.coverageState.coverageIncludedPaths,
    readFileSync: input.readFileSync,
  });
}

function hasCoveragePathFilters(
  coverageState: ReturnType<typeof buildCommonCoverageState>,
): boolean {
  return (
    coverageState.coverageIncludedPaths.length > 0 ||
    coverageState.coverageExcludedFiles.size > 0 ||
    coverageState.coverageExcludedPaths.length > 0
  );
}

function parseConsoleLineCoverage(
  displayOutput: string,
): CoverageResult | null {
  const consoleLineCoverageMatch = displayOutput.match(
    CONSOLE_LINE_COVERAGE_PATTERN,
  );

  return consoleLineCoverageMatch
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
}
