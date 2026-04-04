import ts from "typescript";

import type { TopLevelFunctionNode } from "./contracts.ts";

export function collectTopLevelFunctionNodes(
  sourceFile: ts.SourceFile,
): TopLevelFunctionNode[] {
  const topLevelFunctions: TopLevelFunctionNode[] = [];

  const registerTopLevelFunction = (
    declaration: TopLevelFunctionNode["declaration"],
    functionName: string,
    startNode: ts.Node,
  ): void => {
    topLevelFunctions.push({ declaration, functionName, startNode });
  };

  for (const statement of sourceFile.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.body) {
      registerTopLevelFunction(
        statement,
        getDeclarationName(statement.name, sourceFile),
        statement,
      );
      continue;
    }

    if (ts.isClassDeclaration(statement)) {
      for (const member of statement.members) {
        if (
          (ts.isMethodDeclaration(member) ||
            ts.isConstructorDeclaration(member)) &&
          member.body
        ) {
          registerTopLevelFunction(
            member,
            ts.isConstructorDeclaration(member)
              ? "constructor"
              : getDeclarationName(member.name, sourceFile),
            member,
          );
        }
      }
      continue;
    }

    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        const initializer = declaration.initializer;
        if (
          initializer &&
          (ts.isArrowFunction(initializer) ||
            ts.isFunctionExpression(initializer))
        ) {
          registerTopLevelFunction(
            initializer,
            getDeclarationName(declaration.name, sourceFile),
            declaration,
          );
        }
      }
    }
  }

  return topLevelFunctions;
}

function getDeclarationName(
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
