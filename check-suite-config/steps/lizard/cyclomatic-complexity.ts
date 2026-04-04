import ts from "typescript";

import type { TopLevelDeclaration } from "./types.ts";

export function computeCyclomaticComplexity(
  declaration: TopLevelDeclaration,
): number {
  let complexity = 1;

  const visit = (node: ts.Node): void => {
    if (node !== declaration && ts.isFunctionLike(node)) return;

    if (
      ts.isCatchClause(node) ||
      ts.isConditionalExpression(node) ||
      ts.isDoStatement(node) ||
      ts.isForInStatement(node) ||
      ts.isForOfStatement(node) ||
      ts.isForStatement(node) ||
      ts.isIfStatement(node) ||
      ts.isWhileStatement(node)
    ) {
      complexity += 1;
    }

    if (ts.isCaseClause(node)) complexity += 1;

    if (
      ts.isBinaryExpression(node) &&
      (node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
        node.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
        node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)
    ) {
      complexity += 1;
    }

    ts.forEachChild(node, visit);
  };

  if (declaration.body) visit(declaration.body);
  return complexity;
}
