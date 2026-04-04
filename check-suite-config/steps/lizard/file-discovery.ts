import { existsSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";
import ts from "typescript";

import { createGlobMatcher } from "./glob-matcher.ts";
import { normalizePath } from "./normalize-path.ts";

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
