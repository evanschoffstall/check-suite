import ts from "typescript";

import type { TypeScriptFunctionMetrics } from "./contracts.ts";

import { collectTopLevelFunctionNodes } from "./top-level-node-collection.ts";
import { toTopLevelTypeScriptFunctionMetrics } from "./top-level-node-metrics.ts";

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
