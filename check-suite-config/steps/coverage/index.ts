export { parseJunitResults } from "./junit-results.ts";
export { collectLineCoverage } from "./lcov.ts";
export {
  buildCommonCoverageState,
  matchesCoveragePath,
  normalizeCoverageFilePath,
  shouldIncludeCoverageFile,
} from "./state.ts";
export type { JunitResults } from "./types.ts";
