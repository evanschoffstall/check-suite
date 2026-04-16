import type { NormalizedArchitectureAnalyzerConfig } from "@/quality/module-boundaries/foundation/index.ts";

import { createGlobMatcher } from "@/foundation/index.ts";
import {
  getLastPathSegment,
  normalizePath,
} from "@/quality/module-boundaries/foundation/index.ts";

const directoryGlobMatcherCache = new Map<string, (value: string) => boolean>();
const fileGlobMatcherCache = new Map<string, (value: string) => boolean>();

/** Returns whether a directory path should be ignored entirely. */
export function isIgnoredDirectory(
  directoryPath: string,
  config: NormalizedArchitectureAnalyzerConfig,
): boolean {
  return config.ignoredDirectories.some((pattern) =>
    matchesDirectoryGlob(directoryPath, pattern),
  );
}

/** Returns whether one path matches the configured code-file surface. */
export function isIncludedCodeFile(
  fileName: string,
  config: Pick<NormalizedArchitectureAnalyzerConfig, "codeTargets">,
): boolean {
  const normalizedFilePath = normalizeDirectoryPath(fileName);

  return (
    matchesCodeTargetPatterns(
      normalizedFilePath,
      config.codeTargets.includePatterns,
    ) &&
    !matchesCodeTargetPatterns(
      normalizedFilePath,
      config.codeTargets.declarationFilePatterns,
    ) &&
    !matchesCodeTargetPatterns(
      normalizedFilePath,
      config.codeTargets.testFilePatterns,
    )
  );
}

/** Returns whether a directory path only contains tests, fixtures, or mocks. */
export function isTestDirectory(
  directoryPath: string,
  config: NormalizedArchitectureAnalyzerConfig,
): boolean {
  return config.testDirectories.some((pattern) =>
    matchesDirectoryGlob(directoryPath, pattern),
  );
}

export function shouldSkipDirectory(
  directoryPath: string,
  config: NormalizedArchitectureAnalyzerConfig,
): boolean {
  return (
    isIgnoredDirectory(directoryPath, config) ||
    isTestDirectory(directoryPath, config)
  );
}

/** Reuses compiled glob matchers across scans. */
function getDirectoryGlobMatcher(pattern: string): (value: string) => boolean {
  const cachedMatcher = directoryGlobMatcherCache.get(pattern);
  if (cachedMatcher) {
    return cachedMatcher;
  }

  const matcher = createGlobMatcher(normalizeDirectoryPath(pattern));
  directoryGlobMatcherCache.set(pattern, matcher);
  return matcher;
}

function getFileGlobMatcher(pattern: string): (value: string) => boolean {
  const normalizedPattern = normalizeDirectoryPath(pattern);
  const cachedMatcher = fileGlobMatcherCache.get(normalizedPattern);
  if (cachedMatcher) {
    return cachedMatcher;
  }

  const matcher = createGlobMatcher(normalizedPattern);
  fileGlobMatcherCache.set(normalizedPattern, matcher);
  return matcher;
}

function matchesCodeTargetPatterns(
  filePath: string,
  patterns: readonly string[] | undefined,
): boolean {
  if (patterns === undefined || patterns.length === 0) {
    return false;
  }

  return patterns.some((pattern) => matchesFileGlob(filePath, pattern));
}

/** Matches slashless patterns against a directory basename, path globs against the full path. */
function matchesDirectoryGlob(directoryPath: string, pattern: string): boolean {
  const normalizedPath = normalizeDirectoryPath(directoryPath);
  const normalizedPattern = normalizeDirectoryPath(pattern);
  const directoryName = getLastPathSegment(normalizedPath);

  if (!normalizedPattern.includes("/")) {
    return normalizedPattern.includes("*")
      ? getDirectoryGlobMatcher(normalizedPattern)(directoryName)
      : directoryName === normalizedPattern;
  }

  if (normalizedPattern.startsWith("**/")) {
    const suffixPattern = normalizedPattern.slice(3);

    if (!suffixPattern.includes("/") && !suffixPattern.includes("*")) {
      return directoryName === suffixPattern;
    }

    return (
      getDirectoryGlobMatcher(normalizedPattern)(normalizedPath) ||
      getDirectoryGlobMatcher(suffixPattern)(normalizedPath)
    );
  }

  return normalizedPattern.includes("*")
    ? getDirectoryGlobMatcher(normalizedPattern)(normalizedPath)
    : normalizedPath === normalizedPattern;
}

/** Matches slashless patterns against a file basename, path globs against the full path. */
function matchesFileGlob(filePath: string, pattern: string): boolean {
  const normalizedPath = normalizeDirectoryPath(filePath);
  const normalizedPattern = normalizeDirectoryPath(pattern);
  const fileName = getLastPathSegment(normalizedPath);

  if (!normalizedPattern.includes("/")) {
    return normalizedPattern.includes("*")
      ? getFileGlobMatcher(normalizedPattern)(fileName)
      : fileName === normalizedPattern;
  }

  if (normalizedPattern.startsWith("**/")) {
    const suffixPattern = normalizedPattern.slice(3);

    if (!suffixPattern.includes("/") && !suffixPattern.includes("*")) {
      return fileName === suffixPattern;
    }

    return (
      getFileGlobMatcher(normalizedPattern)(normalizedPath) ||
      getFileGlobMatcher(suffixPattern)(normalizedPath)
    );
  }

  return normalizedPattern.includes("*")
    ? getFileGlobMatcher(normalizedPattern)(normalizedPath)
    : normalizedPath === normalizedPattern;
}

/** Normalizes one directory path before applying glob-based skip rules. */
function normalizeDirectoryPath(directoryPath: string): string {
  return normalizePath(directoryPath)
    .replace(/^\.\//u, "")
    .replace(/\/+$/u, "");
}
