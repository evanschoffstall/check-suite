import ts from "typescript";

import type { TopLevelFunctionNode } from "@/quality/complexity/shared/index.ts";

import { collectClassFunctions } from "./class-collection";
import { getDeclarationName, pushTopLevelFunction } from "./shared";
import { collectVariableFunctions } from "./variable-collection";

export function collectStatementFunctions(
  statement: ts.Statement,
  sourceFile: ts.SourceFile,
  topLevelFunctions: TopLevelFunctionNode[],
): void {
  if (ts.isFunctionDeclaration(statement) && statement.body) {
    pushTopLevelFunction(
      topLevelFunctions,
      statement,
      getDeclarationName(statement.name, sourceFile),
      statement,
    );
    return;
  }

  if (ts.isClassDeclaration(statement)) {
    collectClassFunctions(statement, sourceFile, topLevelFunctions);
    return;
  }

  if (ts.isVariableStatement(statement)) {
    collectVariableFunctions(statement, sourceFile, topLevelFunctions);
  }
}
