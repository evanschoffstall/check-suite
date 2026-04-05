import type { ComplexityThresholds, FunctionMetrics } from "@/steps/lizard/shared/index.ts";

import { buildLizardReportWithFiles } from "@/steps/lizard/report/index.ts";
import {
  buildLizardAnalysisArgs,
  LIZARD_DEFAULT_THRESHOLDS,
} from "@/steps/lizard/shared/index.ts";

import { parseLizardCsv } from "./csv-parser.ts";
import { runLizardAnalysis } from "./lizard-analysis.ts";
import { resolveTopLevelFunctionMetrics } from "./top-level-resolution.ts";
import { collectWorkspaceFileMetrics } from "./workspace-metrics.ts";

/** Runtime configuration for the lizard complexity analysis. */
export interface LizardConfig {
  /** Glob patterns for paths to exclude from analysis. */
  excludedPaths?: readonly string[];
  /** Source directories and files to analyze. */
  targets: readonly string[];
  /** Complexity thresholds — any unset field falls back to the platform default. */
  thresholds?: Partial<ComplexityThresholds>;
}

/** Runs the lizard complexity analysis and writes results to stdout, exiting non-zero on violations. */
export function main(config: LizardConfig): void {
  const thresholds: ComplexityThresholds = {
    ...LIZARD_DEFAULT_THRESHOLDS,
    ...config.thresholds,
  };
  const excludedPaths = config.excludedPaths ?? [];
  const analysisArgs = buildLizardAnalysisArgs(config.targets, excludedPaths);

  const lizardCsvOutput = runLizardAnalysis(failWithOutput, analysisArgs);
  const functions = resolveTopLevelFunctionMetrics(
    parseLizardCsv(lizardCsvOutput),
  );
  const report = buildLizardReport(
    functions,
    config.targets,
    excludedPaths,
    thresholds,
  );

  if (report.exitCode === 0) {
    process.stdout.write(`${report.output}\n`);
    return;
  }

  failWithOutput(report.output, report.exitCode);
}

function buildLizardReport(
  functions: FunctionMetrics[],
  targets: readonly string[],
  excludedPaths: readonly string[],
  thresholds: ComplexityThresholds,
): {
  exitCode: 0 | 1;
  output: string;
} {
  return buildLizardReportWithFiles(
    functions,
    collectWorkspaceFileMetrics(functions, targets, excludedPaths),
    thresholds,
  );
}

function failWithOutput(output: string, exitCode = 1): never {
  process.stdout.write(output.endsWith("\n") ? output : `${output}\n`);
  process.exit(exitCode);
}
