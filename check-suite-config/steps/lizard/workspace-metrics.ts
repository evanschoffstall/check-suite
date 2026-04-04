import { resolve } from "node:path";
import ts from "typescript";

import type { FileMetrics, FunctionMetrics } from "./contracts.ts";

import { LIZARD_EXCLUDED_PATHS, LIZARD_TARGETS } from "./constants.ts";
import { getAnalyzedTypeScriptFiles } from "./file-scanning.ts";

// ---------------------------------------------------------------------------
// Per-file metric aggregation from lizard function rows
// ---------------------------------------------------------------------------

/** Aggregates per-function lizard metrics into a per-file summary. */
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

/** Builds per-file metrics for all analyzed workspace files, merging lizard function-row aggregates with direct source-file scans for NLOC and token counts. */
export function collectWorkspaceFileMetrics(
  functions: FunctionMetrics[],
  cwd = process.cwd(),
): FileMetrics[] {
  const metricsByPath = new Map<string, FileMetrics>(
    collectFileMetrics(functions).map((entry) => [entry.path, entry] as const),
  );

  for (const relativePath of getAnalyzedTypeScriptFiles(
    cwd,
    LIZARD_TARGETS,
    LIZARD_EXCLUDED_PATHS,
  )) {
    const absolutePath = resolve(cwd, relativePath);
    const sourceText = ts.sys.readFile(absolutePath, "utf8");
    if (!sourceText) continue;

    const sourceFile = ts.createSourceFile(
      relativePath,
      sourceText,
      ts.ScriptTarget.Latest,
      true,
      relativePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    const existing = metricsByPath.get(relativePath) ?? {
      ccn: 0,
      functionCount: 0,
      nloc: 0,
      path: relativePath,
      tokenCount: 0,
    };

    existing.nloc = Math.max(
      existing.nloc,
      countSourceFileNonCommentLines(sourceFile, sourceText),
    );
    existing.tokenCount = Math.max(
      existing.tokenCount,
      countSourceFileTokens(sourceText),
    );
    metricsByPath.set(relativePath, existing);
  }

  return [...metricsByPath.values()].sort(
    (left, right) => right.ccn - left.ccn,
  );
}

export function countSourceFileNonCommentLines(
  sourceFile: ts.SourceFile,
  sourceText: string,
): number {
  const scanner = ts.createScanner(
    sourceFile.languageVersion,
    true,
    sourceFile.languageVariant,
    sourceText,
  );
  const lineNumbers = new Set<number>();

  for (
    let token = scanner.scan();
    token !== ts.SyntaxKind.EndOfFileToken;
    token = scanner.scan()
  ) {
    if (
      token === ts.SyntaxKind.NewLineTrivia ||
      token === ts.SyntaxKind.WhitespaceTrivia
    )
      continue;
    lineNumbers.add(
      sourceFile.getLineAndCharacterOfPosition(scanner.getTokenPos()).line + 1,
    );
  }

  return lineNumbers.size;
}

// ---------------------------------------------------------------------------
// Workspace-wide file metrics scan
// ---------------------------------------------------------------------------

export function countSourceFileTokens(sourceText: string): number {
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    true,
    ts.LanguageVariant.Standard,
    sourceText,
  );
  let tokenCount = 0;

  for (
    let token = scanner.scan();
    token !== ts.SyntaxKind.EndOfFileToken;
    token = scanner.scan()
  ) {
    if (
      token === ts.SyntaxKind.NewLineTrivia ||
      token === ts.SyntaxKind.WhitespaceTrivia
    )
      continue;
    tokenCount += 1;
  }

  return tokenCount;
}
