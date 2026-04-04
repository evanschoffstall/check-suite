import ts from "typescript";

import type { TopLevelDeclaration } from "./types.ts";

export function computeMaxNestingDepth(
  declaration: TopLevelDeclaration,
): number {
  let maxDepth = 0;

  const visit = (node: ts.Node, depth: number): void => {
    if (node !== declaration && ts.isFunctionLike(node)) return;

    let nextDepth = depth;
    if (
      ts.isCatchClause(node) ||
      ts.isConditionalExpression(node) ||
      ts.isDoStatement(node) ||
      ts.isForInStatement(node) ||
      ts.isForOfStatement(node) ||
      ts.isForStatement(node) ||
      ts.isIfStatement(node) ||
      ts.isSwitchStatement(node) ||
      ts.isWhileStatement(node)
    ) {
      nextDepth = depth + 1;
      if (nextDepth > maxDepth) maxDepth = nextDepth;
    }

    ts.forEachChild(node, (child) => visit(child, nextDepth));
  };

  if (declaration.body) visit(declaration.body, 0);
  return maxDepth;
}
