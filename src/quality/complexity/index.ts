/// <reference types="bun" />
/// <reference types="node" />

export { parseLizardCsv, parseLizardCsvLine } from "./csv-parser";

export { runLizardAnalysis } from "./lizard-analysis";
export type { LizardConfig } from "./main";
export type { LizardCheckResult } from "./main";
export { runLizardCheck } from "./main";
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
  buildLizardReportWithFiles,
  findFileViolations,
  findFunctionViolations,
  formatViolations,
} from "@/quality/complexity/report/index.ts";
export {
  buildLizardAnalysisArgs,
  LIZARD_DEFAULT_THRESHOLDS,
} from "@/quality/complexity/shared/index.ts";
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
