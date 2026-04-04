import ts from "typescript";

import type { TopLevelFunctionNode } from "./contracts.ts";

import { collectClassFunctions } from "./function-node-class-collection.ts";
import {
  getDeclarationName,
  pushTopLevelFunction,
} from "./function-node-shared.ts";
import { collectVariableFunctions } from "./function-node-variable-collection.ts";

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
