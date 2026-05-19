/// <reference types="bun" />
/// <reference types="node" />

export type {
  ComplexityAnalyzerAdapter,
  ComplexityCheckOptions,
} from "./main";
export type { ComplexityCheckResult } from "./main";
export { runComplexityCheck } from "./main";
export {
  createSpawnComplexityAdapter,
  parseCsvComplexityRows,
} from "./spawn-adapter.ts";
export type {
  ComplexityColumnMap,
  SpawnComplexityAdapterOptions,
} from "./spawn-adapter.ts";
export {
  collectTopLevelTypeScriptFunctionMetrics,
  resolveTopLevelFunctionMetrics,
} from "./top-level-resolution";
export {
  collectFileMetrics,
  collectWorkspaceFileMetrics,
} from "./workspace-metrics";
export {
  collectTopLevelFunctionNodes,
  toTopLevelTypeScriptFunctionMetrics,
} from "@/quality/complexity/function/index.ts";
export {
  buildComplexityReportWithFiles,
  findFileViolations,
  findFunctionViolations,
  formatViolations,
} from "@/quality/complexity/report/index.ts";
export {
  collectExcludedRanges,
  type ComplexityThresholds,
  type ComplexityViolation,
  computeCyclomaticComplexity,
  computeMaxNestingDepth,
  countNonCommentLines,
  countTokens,
  DEFAULT_COMPLEXITY_THRESHOLDS,
  type FileMetrics,
  type FunctionMetrics,
  isPositionInsideRanges,
  type TopLevelDeclaration,
  type TopLevelFunctionNode,
  type TypeScriptFunctionMetrics,
} from "@/quality/complexity/shared/index.ts";
