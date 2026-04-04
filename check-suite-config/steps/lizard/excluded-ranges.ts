import ts from "typescript";

import type { TopLevelDeclaration } from "./types.ts";

export function collectExcludedRanges(
  declaration: TopLevelDeclaration,
  sourceFile: ts.SourceFile,
): (readonly [number, number])[] {
  const ranges: (readonly [number, number])[] = [];

  const visit = (node: ts.Node): void => {
    if (node !== declaration && ts.isFunctionLike(node)) {
      ranges.push([node.getStart(sourceFile), node.getEnd()]);
      return;
    }

    if (
      ts.isJsxElement(node) ||
      ts.isJsxFragment(node) ||
      ts.isJsxSelfClosingElement(node)
    ) {
      ranges.push([node.getStart(sourceFile), node.getEnd()]);
      return;
    }

    ts.forEachChild(node, visit);
  };

  if (declaration.body) visit(declaration.body);
  return ranges;
}

export function isPositionInsideRanges(
  position: number,
  ranges: (readonly [number, number])[],
): boolean {
  return ranges.some(([start, end]) => position >= start && position < end);
}
