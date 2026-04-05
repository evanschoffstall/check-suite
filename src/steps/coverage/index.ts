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
export type { JunitResults } from "./types";
