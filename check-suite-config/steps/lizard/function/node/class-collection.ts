import ts from "typescript";

import type { TopLevelFunctionNode } from "../../shared/index.ts";

import { getDeclarationName, pushTopLevelFunction } from "./shared.ts";

export function collectClassFunctions(
  declaration: ts.ClassDeclaration,
  sourceFile: ts.SourceFile,
  topLevelFunctions: TopLevelFunctionNode[],
): void {
  for (const member of declaration.members) {
    if (
      (ts.isMethodDeclaration(member) || ts.isConstructorDeclaration(member)) &&
      member.body
    ) {
      pushTopLevelFunction(
        topLevelFunctions,
        member,
        ts.isConstructorDeclaration(member)
          ? "constructor"
          : getDeclarationName(member.name, sourceFile),
        member,
      );
    }
  }
}
