export {
  buildConsoleOnlyJunitResults,
  parseBunConsoleCoverage,
} from "./console-results";
export type { ConsoleCoverageTotals } from "./console-results";
export { parseJunitResults } from "./junit-results";
export { collectLineCoverage } from "./lcov";
export {
  appendCoverageCheckResult,
  appendMissingReportMessage,
  appendTestResultSections,
  buildTestSummary,
} from "./post-process";
export {
  buildCommonCoverageState,
  matchesCoveragePath,
  normalizeCoverageFilePath,
  shouldIncludeCoverageFile,
} from "./state";
export type { CoverageState } from "./state";
export type { JunitResults } from "./types";
