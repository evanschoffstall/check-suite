import ts from "typescript";

import type { TopLevelFunctionNode } from "@/quality/complexity/shared/index.ts";

import { collectStatementFunctions } from "./statement-collection";

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
