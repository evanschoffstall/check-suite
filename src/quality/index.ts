/** Public entrypoint for the repository-agnostic quality analysis surface. */
export {
  buildLizardAnalysisArgs,
  buildLizardReportWithFiles,
  collectExcludedRanges,
  collectFileMetrics,
  collectTopLevelFunctionNodes,
  collectTopLevelTypeScriptFunctionMetrics,
  collectWorkspaceFileMetrics,
  computeCyclomaticComplexity,
  computeMaxNestingDepth,
  countNonCommentLines,
  countTokens,
  findFileViolations,
  findFunctionViolations,
  formatViolations,
  isPositionInsideRanges,
  LIZARD_DEFAULT_THRESHOLDS,
  parseLizardCsv,
  parseLizardCsvLine,
  resolveTopLevelFunctionMetrics,
  runLizardAnalysis,
  runLizardCheck,
  toTopLevelTypeScriptFunctionMetrics,
} from "@/quality/complexity/index.ts";
export type {
  ComplexityThresholds,
  ComplexityViolation,
  FileMetrics,
  FunctionMetrics,
  LizardCheckResult,
  LizardConfig,
  TopLevelDeclaration,
  TopLevelFunctionNode,
  TypeScriptFunctionMetrics,
} from "@/quality/complexity/index.ts";
export { runDependencyCruiserCheck } from "@/quality/dependency-graph/index.ts";
export type { DependencyCruiserCheckResult } from "@/quality/dependency-graph/index.ts";
export {
  appendCoverageCheckResult,
  appendMissingReportMessage,
  appendTestResultSections,
  buildCommonCoverageState,
  buildConsoleOnlyJunitResults,
  buildTestSummary,
  collectLineCoverage,
  matchesCoveragePath,
  normalizeCoverageFilePath,
  parseBunConsoleCoverage,
  parseJunitResults,
  shouldIncludeCoverageFile,
} from "@/quality/line-metrics/index.ts";
export type {
  ConsoleCoverageTotals,
  CoverageState,
  JunitResults,
} from "@/quality/line-metrics/index.ts";
export {
  analyzeArchitecture,
  formatArchitectureViolations,
} from "@/quality/module-boundaries/index.ts";
export type { ArchitectureAnalyzerConfig } from "@/quality/module-boundaries/index.ts";
export {
  analyzePurgeCss,
  formatUnusedSelectorOutput,
  readPurgeCssConfig,
} from "@/quality/selector-usage/index.ts";
export type {
  PurgeCssCheckResult,
  PurgeCssConfig,
} from "@/quality/selector-usage/index.ts";
