/// <reference types="bun" />
/// <reference types="node" />

export { parseLizardCsv, parseLizardCsvLine } from "./csv-parser.ts";

export { runLizardAnalysis } from "./lizard-analysis.ts";
export type { LizardConfig } from "./main.ts";
export { main } from "./main.ts";
export { createLizardStep } from "./step-config.ts";
export {
  collectTopLevelTypeScriptFunctionMetrics,
  resolveTopLevelFunctionMetrics,
} from "./top-level-resolution.ts";
export {
  collectFileMetrics,
  collectWorkspaceFileMetrics,
} from "./workspace-metrics.ts";
export {
  collectTopLevelFunctionNodes,
  toTopLevelTypeScriptFunctionMetrics,
} from "@/steps/lizard/function/index.ts";
export {
  buildLizardReportWithFiles,
  findFileViolations,
  findFunctionViolations,
  formatViolations,
} from "@/steps/lizard/report/index.ts";
export {
  buildLizardAnalysisArgs,
  LIZARD_DEFAULT_THRESHOLDS,
} from "@/steps/lizard/shared/index.ts";
export type {
  ComplexityThresholds,
  ComplexityViolation,
  FileMetrics,
  FunctionMetrics,
  TopLevelDeclaration,
  TopLevelFunctionNode,
  TypeScriptFunctionMetrics,
} from "@/steps/lizard/shared/index.ts";
export {
  collectExcludedRanges,
  computeCyclomaticComplexity,
  computeMaxNestingDepth,
  countNonCommentLines,
  countTokens,
  isPositionInsideRanges,
} from "@/steps/lizard/shared/index.ts";

if (import.meta.main) {
  // Parse config from --config=<json> CLI argument when used as subprocess entry.
  const configArg = process.argv.find((a) => a.startsWith("--config="));
  const config = configArg
    ? (JSON.parse(
        configArg.slice("--config=".length),
      ) as import("./main.ts").LizardConfig)
    : null;

  if (!config) {
    process.stderr.write("lizard: missing required --config=<json> argument\n");
    process.exit(1);
  }

  const { main } = await import("./main.ts");
  main(config);
}
