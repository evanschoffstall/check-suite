import { resolve } from "node:path";
import ts from "typescript";

import type {
  FileMetrics,
  FunctionMetrics,
} from "@/quality/complexity/shared/index.ts";

import {
  collectMeaningfulTokenLineNumbers,
  countMeaningfulTokens,
} from "@/quality/complexity/shared/index.ts";

import { getAnalyzedTypeScriptFiles } from "./file-scanning";

// ---------------------------------------------------------------------------
// Per-file metric aggregation from analyzer function rows
// ---------------------------------------------------------------------------

/** Aggregates per-function analyzer metrics into a per-file summary. */
export function collectFileMetrics(
  functions: FunctionMetrics[],
): FileMetrics[] {
  const metricsByPath = new Map<string, FileMetrics>();

  for (const entry of functions) {
    const existingMetrics = metricsByPath.get(entry.path) ?? {
      ccn: 0,
      functionCount: 0,
      nloc: 0,
      path: entry.path,
      tokenCount: 0,
    };

    existingMetrics.ccn += entry.ccn;
    existingMetrics.functionCount += 1;
    existingMetrics.nloc += entry.nloc;
    existingMetrics.tokenCount += entry.tokenCount;
    metricsByPath.set(entry.path, existingMetrics);
  }

  return [...metricsByPath.values()].sort(
    (left, right) => right.ccn - left.ccn,
  );
}

// ---------------------------------------------------------------------------
// Source-file-level NLOC and token counting (whole-file, not per-function)
// ---------------------------------------------------------------------------

/** Builds per-file metrics for all analyzed workspace files, merging analyzer function-row aggregates with direct source-file scans for NLOC and token counts. */
export function collectWorkspaceFileMetrics(
  functions: FunctionMetrics[],
  targets: readonly string[],
  excludedPaths: readonly string[],
  cwd = process.cwd(),
): FileMetrics[] {
  const metricsByPath = new Map<string, FileMetrics>(
    collectFileMetrics(functions).map((entry) => [entry.path, entry] as const),
  );
  const analyzedPaths = getAnalyzedTypeScriptFiles(cwd, targets, excludedPaths);

  for (const fileMetrics of analyzedPaths
    .map((relativePath) => scanWorkspaceFileMetrics(cwd, relativePath))
    .filter((entry): entry is FileMetrics => entry !== null)) {
    const existing =
      metricsByPath.get(fileMetrics.path) ??
      createEmptyFileMetrics(fileMetrics.path);
    existing.nloc = Math.max(existing.nloc, fileMetrics.nloc);
    existing.tokenCount = Math.max(existing.tokenCount, fileMetrics.tokenCount);
    metricsByPath.set(fileMetrics.path, existing);
  }

  return [...metricsByPath.values()].sort(
    (left, right) => right.ccn - left.ccn,
  );
}

export function countSourceFileNonCommentLines(
  sourceFile: ts.SourceFile,
  sourceText: string,
): number {
  return collectMeaningfulTokenLineNumbers(sourceFile, {
    languageVariant: sourceFile.languageVariant,
    languageVersion: sourceFile.languageVersion,
    sourceText,
  }).size;
}

export function countSourceFileTokens(sourceText: string): number {
  return countMeaningfulTokens({
    languageVariant: ts.LanguageVariant.Standard,
    languageVersion: ts.ScriptTarget.Latest,
    sourceText,
  });
}

function createEmptyFileMetrics(path: string): FileMetrics {
  return {
    ccn: 0,
    functionCount: 0,
    nloc: 0,
    path,
    tokenCount: 0,
  };
}

// ---------------------------------------------------------------------------
// Workspace-wide file metrics scan
// ---------------------------------------------------------------------------

function scanWorkspaceFileMetrics(
  cwd: string,
  relativePath: string,
): FileMetrics | null {
  const absolutePath = resolve(cwd, relativePath);
  const sourceText = ts.sys.readFile(absolutePath, "utf8");
  if (!sourceText) {
    return null;
  }

  const sourceFile = ts.createSourceFile(
    relativePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    relativePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  return {
    ...createEmptyFileMetrics(relativePath),
    nloc: countSourceFileNonCommentLines(sourceFile, sourceText),
    tokenCount: countSourceFileTokens(sourceText),
  };
}
