import ts from "typescript";

import type {
  TopLevelFunctionNode,
  TypeScriptFunctionMetrics,
} from "./contracts.ts";

import {
  computeCyclomaticComplexity,
  computeMaxNestingDepth,
  countNonCommentLines,
  countTokens,
} from "./declaration-metrics.ts";

// ---------------------------------------------------------------------------
// Top-level function node collection
// ---------------------------------------------------------------------------

/** Walks a SourceFile and collects all top-level function/method declarations. */
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

/** Converts collected top-level function nodes into typed metrics objects. */
export function toTopLevelTypeScriptFunctionMetrics(
  topLevelFunctions: TopLevelFunctionNode[],
  sourceFile: ts.SourceFile,
  sourceText: string,
  filePath: string,
): TypeScriptFunctionMetrics[] {
  const toLineNumber = (position: number): number =>
    sourceFile.getLineAndCharacterOfPosition(position).line + 1;

  return topLevelFunctions.map(({ declaration, functionName, startNode }) => {
    const startLine = toLineNumber(startNode.getStart(sourceFile));
    const endLine = toLineNumber(declaration.getEnd());
    const length = endLine - startLine + 1;
    const nloc = countNonCommentLines(declaration, sourceFile, sourceText);

    return {
      ccn: computeCyclomaticComplexity(declaration),
      endLine,
      functionName,
      length,
      location: `${functionName}@${startLine}-${endLine}@${filePath}`,
      nestingDepth: computeMaxNestingDepth(declaration),
      nloc,
      parameterCount: declaration.parameters.length,
      path: filePath,
      startLine,
      tokenCount: countTokens(declaration, sourceFile, sourceText),
    } satisfies TypeScriptFunctionMetrics;
  });
}

// ---------------------------------------------------------------------------
// Top-level function node → TypeScriptFunctionMetrics conversion
// ---------------------------------------------------------------------------

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
