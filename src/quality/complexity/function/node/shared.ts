import ts from "typescript";

import type { TopLevelFunctionNode } from "@/quality/complexity/shared/index.ts";

export function getDeclarationName(
  name: ts.BindingName | ts.PropertyName | undefined,
  sourceFile: ts.SourceFile,
): string {
  if (!name) return "(anonymous)";

  if (
    ts.isIdentifier(name) ||
    ts.isPrivateIdentifier(name) ||
    ts.isNumericLiteral(name) ||
    ts.isStringLiteral(name)
  ) {
    return name.text;
  }

  return name.getText(sourceFile);
}

export function isFunctionInitializer(
  initializer: ts.Expression,
): initializer is ts.ArrowFunction | ts.FunctionExpression {
  return (
    ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer)
  );
}

export function pushTopLevelFunction(
  topLevelFunctions: TopLevelFunctionNode[],
  declaration: TopLevelFunctionNode["declaration"],
  functionName: string,
  startNode: ts.Node,
): void {
  topLevelFunctions.push({ declaration, functionName, startNode });
}
