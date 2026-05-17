import type { PostProcessMessage } from "@/types/index.ts";

import type {
  MetricResolver,
  MetricResolverResult,
} from "./execution-metric.ts";
import type { ThresholdMetricTotals } from "./metric-threshold.ts";

export interface LcovLineTotalsResolverOptions {
  excludedFiles?: string[];
  excludedPaths?: string[];
  includedPaths?: string[];
  parseConsoleTotals?: (output: string) => null | ThresholdMetricTotals;
  parseConsoleTotalsPattern?: RegExp;
}

interface ActiveLcovFile {
  include: boolean;
  path: string;
}

type MetricResolverContext = Parameters<MetricResolver>[0];

/**
 * Aggregates line-hit ratio totals from an LCOV-style artifact while honoring include and
 * exclude matchers supplied by the caller.
 */
export function collectLineHitRatioTotals(options: {
  artifactPath: string;
  excludedFiles: ReadonlySet<string>;
  excludedPaths: string[];
  existsSync: MetricResolverContext["existsSync"];
  includedPaths: string[];
  readFileSync: MetricResolverContext["readFileSync"];
}): null | ThresholdMetricTotals {
  if (!options.artifactPath || !options.existsSync(options.artifactPath)) {
    return null;
  }

  const lineHitCounts = new Map<string, number>();
  let activeFile: ActiveLcovFile = { include: false, path: "" };

  for (const line of options
    .readFileSync(options.artifactPath, "utf8")
    .split(/\r?\n/u)) {
    if (line.startsWith("SF:")) {
      activeFile = resolveActiveLcovFile(line, options);
      continue;
    }

    collectLineHitCount(lineHitCounts, activeFile, line);
  }

  return summarizeLineHitCounts(lineHitCounts);
}

/**
 * Creates a metric resolver that reads threshold totals from a line-hit artifact,
 * optionally falling back to a caller-supplied console-summary parser.
 */
export function createLineHitRatioResolver(
  options: LcovLineTotalsResolverOptions = {},
): MetricResolver {
  return ({
    data,
    displayOutput,
    existsSync,
    readFileSync,
    resolveTokenString,
  }: MetricResolverContext): MetricResolverResult => {
    const messages: PostProcessMessage[] = [];
    const includedPaths = resolveArtifactPathMatchers(
      options.includedPaths ?? data.metricIncludedPaths,
      [],
      resolveTokenString,
    );
    const excludedFiles = new Set(
      resolveArtifactPathMatchers(
        options.excludedFiles ?? data.metricExcludedFiles,
        includedPaths,
        resolveTokenString,
      ),
    );
    const excludedPaths = resolveArtifactPathMatchers(
      options.excludedPaths ?? data.metricExcludedPaths,
      includedPaths,
      resolveTokenString,
    );

    const parseConsoleTotals = resolveConsoleTotalsParser(options);
    if (parseConsoleTotals) {
      const totals = parseConsoleTotals(displayOutput);
      if (
        totals &&
        includedPaths.length === 0 &&
        excludedFiles.size === 0 &&
        excludedPaths.length === 0
      ) {
        return { totals };
      }
      if (!totals) {
        messages.push({
          text: "Metric summary row not found in output; falling back to LCOV artifact totals.",
          tone: "warn",
        });
      }
    }

    const artifactPath =
      typeof data.metricPath === "string"
        ? resolveTokenString(data.metricPath)
        : "";

    return {
      ...(messages.length > 0 && { messages }),
      totals: collectLineHitRatioTotals({
        artifactPath,
        excludedFiles,
        excludedPaths,
        existsSync,
        includedPaths,
        readFileSync,
      }),
    };
  };
}

/** Returns whether a file path matches an exact or descendant matcher path. */
export function matchesArtifactPath(
  filePath: string,
  matcherPath: string,
): boolean {
  return filePath === matcherPath || filePath.startsWith(`${matcherPath}/`);
}

/** Normalizes an artifact path for consistent cross-platform matching. */
export function normalizeArtifactPath(value: string): string {
  return value
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/")
    .replace(/^\.\//u, "")
    .replace(/\/$/u, "");
}

/**
 * Parses ratio totals from a caller-supplied summary-table pattern.
 * This keeps the table format configurable while centralizing the extraction.
 */
export function parseSummaryTableTotals(
  output: string,
  pattern: RegExp,
): null | ThresholdMetricTotals {
  const match = pattern.exec(output);
  return match
    ? {
        covered: Number.parseInt(match[2].replace(/,/g, ""), 10),
        found: Number.parseInt(match[3].replace(/,/g, ""), 10),
        pct: Number.parseFloat(match[1]),
      }
    : null;
}

/**
 * Resolves configured artifact path matchers after token substitution and
 * expands relative matchers against the provided include roots.
 */
export function resolveArtifactPathMatchers(
  values: unknown,
  includePaths: string[],
  resolveTokenString: (value: string) => string,
): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return [
    ...new Set(
      values.flatMap((value) => {
        if (typeof value !== "string") {
          return [];
        }

        const normalizedValue = normalizeArtifactPath(
          resolveTokenString(value),
        );
        if (!normalizedValue) {
          return [];
        }

        const resolved = new Set([normalizedValue]);
        for (const includePath of includePaths) {
          resolved.add(
            normalizeArtifactPath(`${includePath}/${normalizedValue}`),
          );
          if (normalizedValue.startsWith("../")) {
            resolved.add(
              normalizeArtifactPath(
                `${includePath}/${normalizedValue.slice(3)}`,
              ),
            );
          }
        }
        return [...resolved].filter(Boolean);
      }),
    ),
  ];
}

function collectLineHitCount(
  lineHitCounts: Map<string, number>,
  activeFile: ActiveLcovFile,
  line: string,
): void {
  const record = parseLineHitRecord(activeFile, line);
  if (!record) return;

  const previous = lineHitCounts.get(record.key);
  if (previous === undefined || record.hitCount > previous) {
    lineHitCounts.set(record.key, record.hitCount);
  }
}

function parseLineHitRecord(
  activeFile: ActiveLcovFile,
  line: string,
): null | { hitCount: number; key: string } {
  if (!activeFile.include || !activeFile.path || !line.startsWith("DA:")) {
    return null;
  }

  const separatorIndex = line.lastIndexOf(",");
  const hitCount = Number.parseInt(line.slice(separatorIndex + 1), 10);
  const lineNumber = line.slice(3, separatorIndex);
  return lineNumber && Number.isFinite(hitCount)
    ? { hitCount, key: `${activeFile.path}:${lineNumber}` }
    : null;
}

function resolveActiveLcovFile(
  line: string,
  options: Pick<
    Parameters<typeof collectLineHitRatioTotals>[0],
    "excludedFiles" | "excludedPaths" | "includedPaths"
  >,
): ActiveLcovFile {
  const path = normalizeArtifactPath(line.slice(3));
  return {
    include: shouldIncludeArtifactPath(
      path,
      options.includedPaths,
      options.excludedFiles,
      options.excludedPaths,
    ),
    path,
  };
}

function resolveConsoleTotalsParser(
  options: LcovLineTotalsResolverOptions,
): ((output: string) => null | ThresholdMetricTotals) | undefined {
  if (options.parseConsoleTotals) return options.parseConsoleTotals;

  const pattern = options.parseConsoleTotalsPattern;
  return pattern
    ? (output) => parseSummaryTableTotals(output, pattern)
    : undefined;
}

function shouldIncludeArtifactPath(
  filePath: string,
  includedPaths: string[],
  excludedFiles: ReadonlySet<string>,
  excludedPaths: string[],
): boolean {
  const normalizedFilePath = normalizeArtifactPath(filePath);
  const isIncluded =
    includedPaths.length === 0 ||
    includedPaths.some((matcherPath) =>
      matchesArtifactPath(normalizedFilePath, matcherPath),
    );

  return (
    isIncluded &&
    !excludedFiles.has(normalizedFilePath) &&
    !excludedPaths.some((matcherPath) =>
      matchesArtifactPath(normalizedFilePath, matcherPath),
    )
  );
}

function summarizeLineHitCounts(
  lineHitCounts: Map<string, number>,
): ThresholdMetricTotals {
  const found = lineHitCounts.size;
  const covered = [...lineHitCounts.values()].filter(
    (hitCount) => hitCount > 0,
  ).length;
  return { covered, found, pct: found > 0 ? (covered / found) * 100 : 0 };
}
