import type { InlineTypeScriptPostProcessContext } from "../src/types.ts";

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

/** Parsed JUnit totals and expanded failing/skipped test labels. */
export interface JunitResults {
  failed: number;
  failedTests: string[];
  passed: number;
  skipped: number;
  skippedTests: string[];
}

/**
 * Builds the normalized coverage lookup state consumed by the JUnit and
 * Playwright post-processors.
 */
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

/**
 * Collects line coverage totals from an LCOV artifact after path inclusion and
 * exclusion rules have been applied.
 */
export function collectLineCoverage(options: {
  coveragePath: string;
  excludedFiles: ReadonlySet<string>;
  excludedPaths: string[];
  existsSync: InlineTypeScriptPostProcessContext["existsSync"];
  includedPaths: string[];
  readFileSync: InlineTypeScriptPostProcessContext["readFileSync"];
}): null | { covered: number; found: number; pct: number } {
  if (!options.coveragePath || !options.existsSync(options.coveragePath)) {
    return null;
  }

  let activeFile = "";
  let includeActiveFile = false;
  const lineHitCounts = new Map<string, number>();

  for (const line of options
    .readFileSync(options.coveragePath, "utf8")
    .split(/\r?\n/u)) {
    if (line.startsWith("SF:")) {
      activeFile = normalizeCoverageFilePath(line.slice(3));
      includeActiveFile = shouldIncludeCoverageFile(
        activeFile,
        options.includedPaths,
        options.excludedFiles,
        options.excludedPaths,
      );
      continue;
    }

    if (!includeActiveFile || !activeFile || !line.startsWith("DA:")) {
      continue;
    }

    const lineNumber = line.slice(3, line.lastIndexOf(","));
    const hitCount = Number.parseInt(line.slice(line.lastIndexOf(",") + 1), 10);
    if (!lineNumber || !Number.isFinite(hitCount)) {
      continue;
    }

    const lineKey = `${activeFile}:${lineNumber}`;
    const previousHitCount = lineHitCounts.get(lineKey);
    if (previousHitCount === undefined || hitCount > previousHitCount) {
      lineHitCounts.set(lineKey, hitCount);
    }
  }

  let covered = 0;
  let found = 0;
  for (const hitCount of lineHitCounts.values()) {
    found += 1;
    if (hitCount > 0) {
      covered += 1;
    }
  }

  return {
    covered,
    found,
    pct: found > 0 ? (covered / found) * 100 : 0,
  };
}

/**
 * Parses a JUnit XML report into aggregate counts and user-facing failing test
 * descriptions. Falls back to Playwright console totals when no report exists.
 */
export function parseJunitResults(
  reportPath: string,
  commandOutput: string,
  existsSync: InlineTypeScriptPostProcessContext["existsSync"],
  readFileSync: InlineTypeScriptPostProcessContext["readFileSync"],
): JunitResults {
  const parsePlaywrightCount = (label: string): number => {
    const match = commandOutput.match(
      new RegExp(`(?:^|\\n)\\s*(\\d+)\\s+${label}(?:\\s|$)`, "i"),
    );
    return match ? Number.parseInt(match[1] ?? "0", 10) : 0;
  };

  if (!reportPath || !existsSync(reportPath)) {
    return {
      failed: parsePlaywrightCount("failed"),
      failedTests: [],
      passed: parsePlaywrightCount("passed"),
      skipped: parsePlaywrightCount("skipped"),
      skippedTests: [],
    };
  }

  const report = readFileSync(reportPath, "utf8");
  const suitesAttributes = readXmlAttributes(
    report.match(/<testsuites\b([^>]*)>/)?.[1] ?? "",
  );
  const totalTests = Number.parseInt(suitesAttributes.tests ?? "0", 10);
  const failed = Number.parseInt(suitesAttributes.failures ?? "0", 10);
  const skipped = Number.parseInt(suitesAttributes.skipped ?? "0", 10);
  const passed = Math.max(0, totalTests - failed - skipped);
  const failedTests: string[] = [];
  const skippedTests: string[] = [];

  for (const match of report.matchAll(
    /<testcase\b([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase>)/g,
  )) {
    const test = readXmlAttributes(match[1] ?? "");
    const body = match[2] ?? "";
    if (
      !/<skipped\b/.test(body) &&
      !body.includes("<failure") &&
      !body.includes("<error")
    ) {
      continue;
    }

    const formatted = formatTestResult({
      file: test.file,
      line: test.line,
      message: readXmlAttributes(
        body.match(/<(?:failure|error)\b([^>]*)>/)?.[1] ?? "",
      ).message,
      name: test.name,
      suite: test.classname,
    });

    if (/<skipped\b/.test(body)) {
      skippedTests.push(formatted);
      continue;
    }

    failedTests.push(formatted);
  }

  return { failed, failedTests, passed, skipped, skippedTests };
}

function formatTestResult(test: {
  file?: string;
  line?: string;
  message?: string;
  name?: string;
  suite?: string;
}): string {
  return `${test.file ?? "unknown-file"}${test.line ? `:${test.line}` : ""} - ${test.suite ? `${test.suite} > ` : ""}${test.name ?? "(unnamed test)"}${test.message ? ` [${test.message}]` : ""}`;
}

function matchesCoveragePath(filePath: string, matcherPath: string): boolean {
  return filePath === matcherPath || filePath.startsWith(`${matcherPath}/`);
}

function normalizeCoverageFilePath(value: string): string {
  return value
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/")
    .replace(/^\.\//u, "")
    .replace(/\/$/u, "");
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

function readXmlAttributes(raw: string): Record<string, string> {
  return Object.fromEntries(
    [...raw.matchAll(/(\w+)="([^"]*)"/g)].flatMap((match) =>
      match[1] ? [[match[1], match[2] ?? ""]] : [],
    ),
  );
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

function shouldIncludeCoverageFile(
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
