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

/** Returns whether a repo-relative file path belongs to the configured code surface. */
export function isIncludedCodeFile(
  filePath: string,
  config: NormalizedArchitectureAnalyzerConfig,
): boolean {
  const normalizedPath = normalizeDirectoryPath(filePath);
  const includePatterns = config.codeTargets.includePatterns ?? [];
  const declarationFilePatterns = config.codeTargets.declarationFilePatterns ?? [];
  const testFilePatterns = config.codeTargets.testFilePatterns ?? [];

  return includePatterns.some((pattern) =>
    matchesFileGlob(normalizedPath, pattern),
  ) &&
    !declarationFilePatterns.some((pattern) =>
      matchesFileGlob(normalizedPath, pattern),
    ) &&
    !testFilePatterns.some((pattern) =>
      matchesFileGlob(normalizedPath, pattern),
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

/** Returns whether a directory should be skipped before descending into it. */
export function shouldSkipDirectory(
  directoryPath: string,
  config: NormalizedArchitectureAnalyzerConfig,
): boolean {
  return isIgnoredDirectory(directoryPath, config) ||
    isTestDirectory(directoryPath, config);
}

/** Reuses compiled directory-glob matchers across scans. */
function getDirectoryGlobMatcher(pattern: string): (value: string) => boolean {
  const cachedMatcher = directoryGlobMatcherCache.get(pattern);
  if (cachedMatcher) {
    return cachedMatcher;
  }

  const matcher = createGlobMatcher(normalizeDirectoryPath(pattern));
  directoryGlobMatcherCache.set(pattern, matcher);
  return matcher;
}

/** Reuses compiled file-glob matchers across scans. */
function getFileGlobMatcher(pattern: string): (value: string) => boolean {
  const cachedMatcher = fileGlobMatcherCache.get(pattern);
  if (cachedMatcher) {
    return cachedMatcher;
  }

  const matcher = createGlobMatcher(normalizeDirectoryPath(pattern));
  fileGlobMatcherCache.set(pattern, matcher);
  return matcher;
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

    return getDirectoryGlobMatcher(normalizedPattern)(normalizedPath) ||
      getDirectoryGlobMatcher(suffixPattern)(normalizedPath);
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
  const simpleSuffixPattern = readSimpleSuffixPattern(normalizedPattern);

  if (simpleSuffixPattern !== null) {
    return normalizedPath.endsWith(simpleSuffixPattern);
  }

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

    return getFileGlobMatcher(normalizedPattern)(normalizedPath) ||
      getFileGlobMatcher(suffixPattern)(normalizedPath);
  }

  return normalizedPattern.includes("*")
    ? getFileGlobMatcher(normalizedPattern)(normalizedPath)
    : normalizedPath === normalizedPattern;
}

/** Normalizes one repo-relative path before applying glob-based matching. */
function normalizeDirectoryPath(directoryPath: string): string {
  return normalizePath(directoryPath).replace(/^\.\//u, "").replace(/\/+$/u, "");
}

/** Recognizes common suffix-only file globs so matching can avoid regex work. */
function readSimpleSuffixPattern(pattern: string): null | string {
  if (!pattern.startsWith("**/*.")) {
    return null;
  }

  const suffix = pattern.slice(4);
  return suffix.includes("*") ? null : suffix;
}
