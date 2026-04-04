import ts from "typescript";

import type { TopLevelFunctionNode } from "../../shared/index.ts";

import {
  getDeclarationName,
  isFunctionInitializer,
  pushTopLevelFunction,
} from "./shared.ts";

export function collectVariableFunctions(
  statement: ts.VariableStatement,
  sourceFile: ts.SourceFile,
  topLevelFunctions: TopLevelFunctionNode[],
): void {
  for (const declaration of statement.declarationList.declarations) {
    const initializer = declaration.initializer;
    if (!initializer || !isFunctionInitializer(initializer)) {
      continue;
    }

    pushTopLevelFunction(
      topLevelFunctions,
      initializer,
      getDeclarationName(declaration.name, sourceFile),
      declaration,
    );
  }
}
