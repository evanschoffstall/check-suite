/// <reference types="bun" />
/// <reference types="node" />

export { parseLizardCsv, parseLizardCsvLine } from "./csv-parser.ts";

export {
  collectTopLevelFunctionNodes,
  toTopLevelTypeScriptFunctionMetrics,
} from "./function/index.ts";
export { runLizardAnalysis } from "./lizard-analysis.ts";
export { main } from "./main.ts";
export {
  buildLizardReportWithFiles,
  findFileViolations,
  findFunctionViolations,
  formatViolations,
} from "./report/index.ts";
export { LIZARD_ANALYSIS_ARGS, LIZARD_THRESHOLDS } from "./shared/index.ts";
export type {
  ComplexityThresholds,
  ComplexityViolation,
  FileMetrics,
  FunctionMetrics,
  TopLevelDeclaration,
  TopLevelFunctionNode,
  TypeScriptFunctionMetrics,
} from "./shared/index.ts";
export {
  collectExcludedRanges,
  computeCyclomaticComplexity,
  computeMaxNestingDepth,
  countNonCommentLines,
  countTokens,
  isPositionInsideRanges,
} from "./shared/index.ts";
export { lizardStep } from "./step-config.ts";
export {
  collectTopLevelTypeScriptFunctionMetrics,
  resolveTopLevelFunctionMetrics,
} from "./top-level-resolution.ts";
export {
  collectFileMetrics,
  collectWorkspaceFileMetrics,
} from "./workspace-metrics.ts";

if (import.meta.main) {
  const { main } = await import("./main.ts");
  main();
}
