import ts from "typescript";

import type { TypeScriptFunctionMetrics } from "./contracts.ts";

import {
  collectTopLevelFunctionNodes,
  toTopLevelTypeScriptFunctionMetrics,
} from "./function-nodes.ts";

// ---------------------------------------------------------------------------
// Single-file: collect top-level TypeScript function metrics via the AST
// ---------------------------------------------------------------------------

/** Parses a single source file and returns typed metrics for all top-level functions. */
export function collectTopLevelTypeScriptFunctionMetrics(
  sourceText: string,
  filePath: string,
): TypeScriptFunctionMetrics[] {
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  return toTopLevelTypeScriptFunctionMetrics(
    collectTopLevelFunctionNodes(sourceFile),
    sourceFile,
    sourceText,
    filePath,
  );
}

// ---------------------------------------------------------------------------
// Multi-file: resolve lizard function metrics against AST-derived metrics
// ---------------------------------------------------------------------------

export function resolveTopLevelFunctionMetrics(
  functions: TypeScriptFunctionMetrics[],
): TypeScriptFunctionMetrics[] {
  const functionsByPath = groupFunctionsByPath(functions);
  const resolvedFunctions: TypeScriptFunctionMetrics[] = [];

  for (const [filePath, pathEntries] of functionsByPath) {
    resolvedFunctions.push(...resolvePathEntries(filePath, pathEntries));
  }

  return resolvedFunctions;
}

function groupFunctionsByPath(
  functions: TypeScriptFunctionMetrics[],
): Map<string, TypeScriptFunctionMetrics[]> {
  const functionsByPath = new Map<string, TypeScriptFunctionMetrics[]>();

  for (const entry of functions) {
    const pathEntries = functionsByPath.get(entry.path) ?? [];
    pathEntries.push(entry);
    functionsByPath.set(entry.path, pathEntries);
  }

  return functionsByPath;
}

function resolvePathEntries(
  filePath: string,
  pathEntries: TypeScriptFunctionMetrics[],
): TypeScriptFunctionMetrics[] {
  const sourceText = ts.sys.readFile(filePath, "utf8");
  if (!sourceText) return pathEntries;

  const astFunctions = collectTopLevelTypeScriptFunctionMetrics(
    sourceText,
    filePath,
  );
  const astFunctionsByStartLine = new Map(
    astFunctions.map((entry) => [entry.startLine, entry] as const),
  );
  const astStartLines = astFunctions
    .map((entry) => entry.startLine)
    .sort((left, right) => left - right);

  return pathEntries.flatMap((lizardFunction) => {
    const astFunction = astFunctionsByStartLine.get(lizardFunction.startLine);
    if (!astFunction) return [];

    const overlaps = astStartLines.filter(
      (startLine) =>
        startLine >= lizardFunction.startLine &&
        startLine <= lizardFunction.endLine,
    ).length;
    if (overlaps > 1) return [];

    return {
      ...lizardFunction,
      endLine: astFunction.endLine,
      length: astFunction.length,
      location: `${astFunction.functionName}@${astFunction.startLine}-${astFunction.endLine}@${filePath}`,
      nestingDepth: astFunction.nestingDepth,
      nloc: astFunction.nloc,
      parameterCount: astFunction.parameterCount,
    } satisfies TypeScriptFunctionMetrics;
  });
}
