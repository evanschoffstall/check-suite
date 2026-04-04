import {
  readResolvedNumber,
  readResolvedPath,
  resolveCoverageMatchers,
} from "./coverage-matchers.ts";

/** Shared coverage state derived from a step post-processor config block. */
export interface CoverageState {
  coverageExcludedFiles: Set<string>;
  coverageExcludedPaths: string[];
  coverageIncludedPaths: string[];
  coverageLabel: string;
  coveragePath: string;
  coverageThreshold: number;
  reportPath: string;
}

export function buildCommonCoverageState(
  data: Record<string, unknown>,
  resolveTokenString: (value: string) => string,
  defaultThreshold: number,
): CoverageState {
  const coverageIncludedPaths = [
    ...new Set(
      resolveCoverageMatchers(
        data.coverageIncludedPaths,
        [],
        resolveTokenString,
      ),
    ),
  ];
  const coverageExcludedFiles = new Set(
    resolveCoverageMatchers(
      data.coverageExcludedFiles,
      coverageIncludedPaths,
      resolveTokenString,
    ),
  );
  const coverageExcludedPaths = [
    ...new Set(
      resolveCoverageMatchers(
        data.coverageExcludedPaths,
        coverageIncludedPaths,
        resolveTokenString,
      ),
    ),
  ];

  return {
    coverageExcludedFiles,
    coverageExcludedPaths,
    coverageIncludedPaths,
    coverageLabel:
      typeof data.coverageLabel === "string" ? data.coverageLabel : "coverage",
    coveragePath: readResolvedPath(data.coveragePath, resolveTokenString),
    coverageThreshold: readResolvedNumber(
      data.coverageThreshold,
      defaultThreshold,
      resolveTokenString,
    ),
    reportPath: readResolvedPath(data.reportPath, resolveTokenString),
  };
}
