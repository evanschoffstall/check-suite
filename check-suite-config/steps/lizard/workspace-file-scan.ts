import { resolve } from "node:path";
import ts from "typescript";

import type { FileMetrics, FunctionMetrics } from "./contracts.ts";

import { LIZARD_EXCLUDED_PATHS, LIZARD_TARGETS } from "./constants.ts";
import { getAnalyzedTypeScriptFiles } from "./file-discovery.ts";
import {
  countSourceFileNonCommentLines,
  countSourceFileTokens,
} from "./source-file-metrics.ts";
import { collectFileMetrics } from "./workspace-metrics.ts";

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
