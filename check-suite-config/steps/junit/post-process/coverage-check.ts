import type { InlineTypeScriptPostProcessContext } from "../../../../src/types/index.ts";
import type {
  ConfigCheck,
  ConfigMessage,
} from "../../../types.ts";

import {
  buildCommonCoverageState,
  collectLineCoverage,
} from "../../coverage/index.ts";

interface CoverageCheckInput {
  coverageLabel: string;
  coveragePath: string;
  coverageThreshold: number;
  totals: null | { covered: number; found: number; pct: number };
}

export function applyCoverageStatus(
  data: Record<string, unknown>,
  resolveTokenString: (value: string) => string,
  existsSync: InlineTypeScriptPostProcessContext["existsSync"],
  readFileSync: InlineTypeScriptPostProcessContext["readFileSync"],
  messages: ConfigMessage[],
  extraChecks: ConfigCheck[],
  currentStatus: "fail" | "pass",
): "fail" | "pass" {
  const coverageState = buildCommonCoverageState(data, resolveTokenString, 85);
  const coverageTotals = collectLineCoverage({
    coveragePath: coverageState.coveragePath,
    excludedFiles: coverageState.coverageExcludedFiles,
    excludedPaths: coverageState.coverageExcludedPaths,
    existsSync,
    includedPaths: coverageState.coverageIncludedPaths,
    readFileSync,
  });

  return appendCoverageCheck(
    {
      coverageLabel: coverageState.coverageLabel,
      coveragePath: coverageState.coveragePath,
      coverageThreshold: coverageState.coverageThreshold,
      totals: coverageTotals,
    },
    messages,
    extraChecks,
  )
    ? "fail"
    : currentStatus;
}

function appendCoverageCheck(
  input: CoverageCheckInput,
  messages: ConfigMessage[],
  extraChecks: ConfigCheck[],
): boolean {
  const { coverageLabel, coveragePath, coverageThreshold, totals } = input;
  if (!totals) {
    messages.push({
      text: `Coverage report not found: ${coveragePath || "(unset)"}`,
      tone: "fail",
    });
    extraChecks.push({
      details: `0.00% (0/0) · threshold ${coverageThreshold.toFixed(1)}%`,
      label: coverageLabel,
      status: "fail",
    });
    return true;
  }

  const coverageStatus: "fail" | "pass" =
    totals.found > 0 && totals.pct >= coverageThreshold ? "pass" : "fail";

  extraChecks.push({
    details: `${totals.pct.toFixed(2)}% (${totals.covered}/${totals.found}) · threshold ${coverageThreshold.toFixed(1)}%`,
    label: coverageLabel,
    status: coverageStatus,
  });

  if (totals.found === 0) {
    messages.push({
      text: "No executable lines found in coverage report",
      tone: "fail",
    });
  }

  return coverageStatus === "fail";
}
