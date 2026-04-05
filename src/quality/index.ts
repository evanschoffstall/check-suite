/** Public entrypoint for the repository-agnostic quality analysis surface. */
export {
  buildComplexityReportWithFiles,
  collectExcludedRanges,
  collectFileMetrics,
  collectTopLevelFunctionNodes,
  collectTopLevelTypeScriptFunctionMetrics,
  collectWorkspaceFileMetrics,
  computeCyclomaticComplexity,
  computeMaxNestingDepth,
  countNonCommentLines,
  countTokens,
  createSpawnComplexityAdapter,
  DEFAULT_COMPLEXITY_THRESHOLDS,
  findFileViolations,
  findFunctionViolations,
  formatViolations,
  isPositionInsideRanges,
  parseCsvComplexityRows,
  resolveTopLevelFunctionMetrics,
  runComplexityCheck,
  toTopLevelTypeScriptFunctionMetrics,
} from "@/quality/complexity/index.ts";
export type {
  ComplexityAnalyzerAdapter,
  ComplexityCheckOptions,
  ComplexityCheckResult,
  ComplexityColumnMap,
  ComplexityThresholds,
  ComplexityViolation,
  FileMetrics,
  FunctionMetrics,
  SpawnComplexityAdapterOptions,
  TopLevelDeclaration,
  TopLevelFunctionNode,
  TypeScriptFunctionMetrics,
} from "@/quality/complexity/index.ts";
export {
  analyzeArchitecture,
  discoverDefaultCodeRoots,
  formatArchitectureViolations,
  inferAllowedRootFileStems,
  inferCentralSurfacePathPrefixes,
  inferDependencyPolicies,
  inferEntrypointNames,
  inferExplicitPublicSurfacePaths,
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
