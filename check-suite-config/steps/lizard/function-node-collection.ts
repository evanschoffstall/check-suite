import ts from "typescript";

import type { TopLevelFunctionNode } from "./contracts.ts";

import { collectStatementFunctions } from "./function-node-statement-collection.ts";

/** Walks a SourceFile and collects all top-level function/method declarations. */
export function collectTopLevelFunctionNodes(
  sourceFile: ts.SourceFile,
): TopLevelFunctionNode[] {
  const topLevelFunctions: TopLevelFunctionNode[] = [];

  for (const statement of sourceFile.statements) {
    collectStatementFunctions(statement, sourceFile, topLevelFunctions);
  }

  return topLevelFunctions;
}
