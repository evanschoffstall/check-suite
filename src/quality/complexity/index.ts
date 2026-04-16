/// <reference types="bun" />
/// <reference types="node" />

export type { ComplexityAnalyzerAdapter, ComplexityCheckOptions } from "./main";
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
export { DEFAULT_COMPLEXITY_THRESHOLDS } from "@/quality/complexity/shared/index.ts";
export type {
  ComplexityThresholds,
  ComplexityViolation,
  FileMetrics,
  FunctionMetrics,
  TopLevelDeclaration,
  TopLevelFunctionNode,
  TypeScriptFunctionMetrics,
} from "@/quality/complexity/shared/index.ts";
export {
  collectExcludedRanges,
  computeCyclomaticComplexity,
  computeMaxNestingDepth,
  countNonCommentLines,
  countTokens,
  isPositionInsideRanges,
} from "@/quality/complexity/shared/index.ts";
