import ts from "typescript";

import type { TypeScriptFunctionMetrics } from "./contracts.ts";

import { collectTopLevelTypeScriptFunctionMetrics } from "./collect-top-level-metrics.ts";

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
