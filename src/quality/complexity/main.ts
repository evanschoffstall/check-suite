import type {
  ComplexityThresholds,
  FunctionMetrics,
} from "@/quality/complexity/shared/index.ts";

import { buildLizardReportWithFiles } from "@/quality/complexity/report/index.ts";
import {
  buildLizardAnalysisArgs,
  LIZARD_DEFAULT_THRESHOLDS,
} from "@/quality/complexity/shared/index.ts";
import { discoverDefaultCodeRoots } from "@/quality/module-boundaries/discovery/index.ts";

import { parseLizardCsv } from "./csv-parser";
import { runLizardAnalysis } from "./lizard-analysis";
import { resolveTopLevelFunctionMetrics } from "./top-level-resolution";
import { collectWorkspaceFileMetrics } from "./workspace-metrics";

/** Result of a lizard complexity analysis run. */
export interface LizardCheckResult {
  exitCode: 0 | 1;
  output: string;
}

/** Runtime configuration for the lizard complexity analysis. */
export interface LizardConfig {
  /** Glob patterns for paths to exclude from analysis. */
  excludedPaths?: readonly string[];
  /**
   * Source directories and files to analyze.
   *
   * When omitted, the platform auto-discovers top-level source directories
   * from the current working directory using conventional exclusion defaults.
   */
  targets?: readonly string[];
  /** Complexity thresholds — any unset field falls back to the platform default. */
  thresholds?: Partial<ComplexityThresholds>;
}

/** Runs the lizard complexity analysis and returns the normalized result. */
export function runLizardCheck(
  config: LizardConfig,
  cwd: string = process.cwd(),
): LizardCheckResult {
  const thresholds: ComplexityThresholds = {
    ...LIZARD_DEFAULT_THRESHOLDS,
    ...config.thresholds,
  };
  const excludedPaths = config.excludedPaths ?? [];
  const targets = config.targets ?? discoverDefaultCodeRoots(cwd).directories;
  const analysisArgs = buildLizardAnalysisArgs(targets, excludedPaths);

  const lizardCsvOutput = runLizardAnalysis(failWithOutput, analysisArgs);
  const functions = resolveTopLevelFunctionMetrics(
    parseLizardCsv(lizardCsvOutput),
  );
  const report = buildLizardReport(functions, targets, excludedPaths, thresholds);

  return {
    exitCode: report.exitCode,
    output: report.output.endsWith("\n") ? report.output : `${report.output}\n`,
  };
}

function buildLizardReport(
  functions: FunctionMetrics[],
  targets: readonly string[],
  excludedPaths: readonly string[],
  thresholds: ComplexityThresholds,
): LizardCheckResult {
  return buildLizardReportWithFiles(
    functions,
    collectWorkspaceFileMetrics(functions, targets, excludedPaths),
    thresholds,
  );
}

function failWithOutput(output: string): never {
  throw new Error(output);
}
