import type {
  ComplexityThresholds,
  FunctionMetrics,
} from "@/quality/complexity/shared/index.ts";

import { buildComplexityReportWithFiles } from "@/quality/complexity/report/index.ts";
import { DEFAULT_COMPLEXITY_THRESHOLDS } from "@/quality/complexity/shared/index.ts";
import { discoverDefaultCodeRoots } from "@/quality/module-boundaries/discovery/index.ts";

import { resolveTopLevelFunctionMetrics } from "./top-level-resolution";
import { collectWorkspaceFileMetrics } from "./workspace-metrics";

/** Config-owned adapter that supplies the external analysis contract. */
export interface ComplexityAnalyzerAdapter {
  buildAnalysisArgs(
    targets: readonly string[],
    excludedPaths: readonly string[],
  ): readonly string[];
  parseAnalysisOutput(output: string): FunctionMetrics[];
  /**
   * Runs the external analysis process asynchronously. Must not block the
   * event loop — use async process spawning (e.g. {@link Bun.spawn}) rather
   * than any synchronous spawn variant to prevent freezing the host process.
   */
  runAnalysis(input: {
    analysisArgs: readonly string[];
    cwd: string;
    failWithOutput: (output: string, exitCode?: number) => never;
  }): Promise<string>;
}

/** Runtime configuration for the generic complexity analysis. */
export interface ComplexityCheckOptions {
  /** External analyzer implementation supplied by config-owned code. */
  analyzer: ComplexityAnalyzerAdapter;
  /** Glob patterns for paths to exclude from analysis. */
  excludedPaths?: readonly string[];
  /**
   * Source directories and files to analyze.
   *
    * When omitted, the platform asks code-root discovery for directories that
    * match the current architecture code-target configuration.
   */
  targets?: readonly string[];
  /** Complexity thresholds — any unset field falls back to the platform default. */
  thresholds?: Partial<ComplexityThresholds>;
}

/** Result of a generic complexity analysis run. */
export interface ComplexityCheckResult {
  exitCode: 0 | 1;
  output: string;
}

/** Runs the generic complexity analysis and returns the normalized result. */
export async function runComplexityCheck(
  config: ComplexityCheckOptions,
  cwd: string = process.cwd(),
): Promise<ComplexityCheckResult> {
  const thresholds: ComplexityThresholds = {
    ...DEFAULT_COMPLEXITY_THRESHOLDS,
    ...config.thresholds,
  };
  const excludedPaths = config.excludedPaths ?? [];
  const targets = config.targets ?? discoverDefaultCodeRoots(cwd).directories;
  const analysisArgs = config.analyzer.buildAnalysisArgs(targets, excludedPaths);

  const analysisOutput = await config.analyzer.runAnalysis({
    analysisArgs,
    cwd,
    failWithOutput,
  });
  const functions = resolveTopLevelFunctionMetrics(
    config.analyzer.parseAnalysisOutput(analysisOutput),
  );
  const report = buildComplexityReport(
    functions,
    targets,
    excludedPaths,
    thresholds,
    cwd,
  );

  return {
    exitCode: report.exitCode,
    output: report.output.endsWith("\n") ? report.output : `${report.output}\n`,
  };
}

function buildComplexityReport(
  functions: FunctionMetrics[],
  targets: readonly string[],
  excludedPaths: readonly string[],
  thresholds: ComplexityThresholds,
  cwd: string,
): ComplexityCheckResult {
  return buildComplexityReportWithFiles(
    functions,
    collectWorkspaceFileMetrics(functions, targets, excludedPaths, cwd),
    thresholds,
  );
}

function failWithOutput(output: string): never {
  throw new Error(output);
}
