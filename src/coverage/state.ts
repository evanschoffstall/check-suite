export interface CoverageState {
  coverageExcludedFiles: Set<string>;
  coverageExcludedPaths: string[];
  coverageIncludedPaths: string[];
  coverageLabel: string;
  coveragePath: string;
  coverageThreshold: number;
  reportPath: string;
}

/** Resolves and normalizes the common coverage-related config knobs. */
export function buildCommonCoverageState(
  data: Record<string, unknown>,
  resolveTokenString: (value: string) => string,
  defaultThreshold: number,
): CoverageState {
  const {
    coverageExcludedFiles,
    coverageExcludedPaths,
    coverageIncludedPaths,
  } = resolveCoverageFilters(data, resolveTokenString);

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

/** Returns whether the file path matches a directory-or-file coverage matcher. */
export function matchesCoveragePath(
  filePath: string,
  matcherPath: string,
): boolean {
  return filePath === matcherPath || filePath.startsWith(`${matcherPath}/`);
}

/** Normalizes coverage file paths so path comparisons behave consistently across tools. */
export function normalizeCoverageFilePath(value: string): string {
  return value
    .replace(/\\/g, "/")
    .replace(/\/+/, "/")
    .replace(/^\.\//u, "")
    .replace(/\/$/u, "");
}

/** Applies include/exclude coverage filters to a normalized file path. */
export function shouldIncludeCoverageFile(
  filePath: string,
  includedPaths: string[],
  excludedFiles: ReadonlySet<string>,
  excludedPaths: string[],
): boolean {
  const normalizedFilePath = normalizeCoverageFilePath(filePath);
  const isIncluded =
    includedPaths.length === 0 ||
    includedPaths.some((matcherPath) =>
      matchesCoveragePath(normalizedFilePath, matcherPath),
    );

  if (!isIncluded || excludedFiles.has(normalizedFilePath)) {
    return false;
  }

  return !excludedPaths.some((matcherPath) =>
    matchesCoveragePath(normalizedFilePath, matcherPath),
  );
}

function readResolvedNumber(
  value: unknown,
  fallback: number,
  resolveTokenString: (value: string) => string,
): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsedValue = Number.parseFloat(resolveTokenString(value));
    if (Number.isFinite(parsedValue)) {
      return parsedValue;
    }
  }

  return fallback;
}

function readResolvedPath(
  value: unknown,
  resolveTokenString: (value: string) => string,
): string {
  return typeof value === "string" ? resolveTokenString(value) : "";
}

function resolveCoverageFilters(
  data: Record<string, unknown>,
  resolveTokenString: (value: string) => string,
): {
  coverageExcludedFiles: Set<string>;
  coverageExcludedPaths: string[];
  coverageIncludedPaths: string[];
} {
  const coverageIncludedPaths = [
    ...new Set(
      resolveCoverageMatchers(
        data.coverageIncludedPaths,
        [],
        resolveTokenString,
      ),
    ),
  ];

  return {
    coverageExcludedFiles: new Set(
      resolveCoverageMatchers(
        data.coverageExcludedFiles,
        coverageIncludedPaths,
        resolveTokenString,
      ),
    ),
    coverageExcludedPaths: [
      ...new Set(
        resolveCoverageMatchers(
          data.coverageExcludedPaths,
          coverageIncludedPaths,
          resolveTokenString,
        ),
      ),
    ],
    coverageIncludedPaths,
  };
}

function resolveCoverageMatchers(
  values: unknown,
  includePaths: string[],
  resolveTokenString: (value: string) => string,
): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return values.flatMap((value) => {
    if (typeof value !== "string") {
      return [];
    }

    const normalizedValue = normalizeCoverageFilePath(
      resolveTokenString(value),
    );
    if (!normalizedValue) {
      return [];
    }

    const resolvedMatchers = new Set([normalizedValue]);
    for (const includePath of includePaths) {
      resolvedMatchers.add(
        normalizeCoverageFilePath(`${includePath}/${normalizedValue}`),
      );
      if (normalizedValue.startsWith("../")) {
        resolvedMatchers.add(
          normalizeCoverageFilePath(
            `${includePath}/${normalizedValue.slice(3)}`,
          ),
        );
      }
    }

    return [...resolvedMatchers].filter(Boolean);
  });
}
