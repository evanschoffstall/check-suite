import { existsSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";
import ts from "typescript";

import { escapeRegExpLiteral, testSafeRegExp } from "@/regex.ts";

// ---------------------------------------------------------------------------
// Path normalization
// ---------------------------------------------------------------------------

/** Returns a matcher function for a glob pattern (supports * and **). */
export function createGlobMatcher(pattern: string): (value: string) => boolean {
  const escapedPattern = pattern
    .replaceAll("\\", "\\\\")
    .replaceAll(".", escapeRegExpLiteral("."))
    .replaceAll("+", escapeRegExpLiteral("+"))
    .replaceAll("?", escapeRegExpLiteral("?"))
    .replaceAll("^", escapeRegExpLiteral("^"))
    .replaceAll("$", escapeRegExpLiteral("$"))
    .replaceAll("{", escapeRegExpLiteral("{"))
    .replaceAll("}", escapeRegExpLiteral("}"))
    .replaceAll("(", escapeRegExpLiteral("("))
    .replaceAll(")", escapeRegExpLiteral(")"))
    .replaceAll("|", escapeRegExpLiteral("|"))
    .replaceAll("[", escapeRegExpLiteral("["))
    .replaceAll("]", escapeRegExpLiteral("]"))
    .replaceAll("**", "\\u0000")
    .replaceAll("*", "[^/]*")
    .replaceAll("\\u0000", ".*");
  const safePattern = `^${escapedPattern}$`;

  return (value: string): boolean =>
    testSafeRegExp(normalizePath(value), safePattern, "u");
}

// ---------------------------------------------------------------------------
// Glob matching
// ---------------------------------------------------------------------------

/** Returns all TypeScript/TSX files under the given targets, excluding paths that match any exclusion pattern. */
export function getAnalyzedTypeScriptFiles(
  cwd: string,
  targets: readonly string[],
  excludedPaths: readonly string[],
): string[] {
  const filePaths = new Set<string>();
  const excludedPatterns = excludedPaths.map((pattern) =>
    createGlobMatcher(pattern),
  );

  for (const target of targets) {
    collectTargetFiles(target, cwd, excludedPatterns, filePaths);
  }

  return [...filePaths].sort();
}

// ---------------------------------------------------------------------------
// File discovery
// ---------------------------------------------------------------------------

export function normalizePath(path: string): string {
  return path.replaceAll("\\", "/");
}

function addIfIncluded(
  relativePath: string,
  excludedPatterns: ((value: string) => boolean)[],
  filePaths: Set<string>,
): void {
  if (!relativePath.endsWith(".ts") && !relativePath.endsWith(".tsx")) {
    return;
  }

  const normalizedPath = normalizePath(relativePath);
  if (
    excludedPatterns.some((matchesPattern) => matchesPattern(normalizedPath))
  ) {
    return;
  }

  filePaths.add(normalizedPath);
}

function collectTargetFiles(
  target: string,
  cwd: string,
  excludedPatterns: ((value: string) => boolean)[],
  filePaths: Set<string>,
): void {
  const absoluteTargetPath = resolve(cwd, target);
  if (!existsSync(absoluteTargetPath)) return;

  const targetStats = statSync(absoluteTargetPath);
  if (targetStats.isFile()) {
    addIfIncluded(
      relative(cwd, absoluteTargetPath),
      excludedPatterns,
      filePaths,
    );
    return;
  }

  for (const absoluteFilePath of ts.sys.readDirectory(
    absoluteTargetPath,
    [".ts", ".tsx"],
    undefined,
    undefined,
  )) {
    addIfIncluded(relative(cwd, absoluteFilePath), excludedPatterns, filePaths);
  }
}
