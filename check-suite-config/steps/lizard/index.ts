/// <reference types="bun" />
/// <reference types="node" />

export { LIZARD_ANALYSIS_ARGS, LIZARD_THRESHOLDS } from "./constants.ts";

export type {
  ComplexityThresholds,
  ComplexityViolation,
  FileMetrics,
  FunctionMetrics,
  TopLevelFunctionNode,
  TypeScriptFunctionMetrics,
} from "./contracts.ts";
export { parseLizardCsv, parseLizardCsvLine } from "./csv-parser.ts";
export { runLizardAnalysis } from "./lizard-analysis.ts";
export { main } from "./main.ts";
export {
  buildLizardReportWithFiles,
  findFileViolations,
  findFunctionViolations,
  formatThresholdSummary,
  formatViolations,
} from "./report.ts";

export { lizardStep } from "./step-config.ts";
export {
  collectTopLevelTypeScriptFunctionMetrics,
  resolveTopLevelFunctionMetrics,
} from "./top-level-metrics.ts";
export {
  collectFileMetrics,
  collectWorkspaceFileMetrics,
} from "./workspace-metrics.ts";

if (import.meta.main) {
  const { main } = await import("./main.ts");
  main();
}
