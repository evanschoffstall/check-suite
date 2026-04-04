import ts from "typescript";

import type { TopLevelDeclaration } from "./types.ts";

import {
  collectExcludedRanges,
  isPositionInsideRanges,
} from "./excluded-ranges.ts";

export function countNonCommentLines(
  declaration: TopLevelDeclaration,
  sourceFile: ts.SourceFile,
  sourceText: string,
): number {
  const declarationStart = declaration.getStart(sourceFile);
  const excludedRanges = collectExcludedRanges(declaration, sourceFile);
  const scanner = ts.createScanner(
    sourceFile.languageVersion,
    true,
    sourceFile.languageVariant,
    sourceText.slice(declarationStart, declaration.getEnd()),
  );
  const lineNumbers = new Set<number>();

  for (
    let token = scanner.scan();
    token !== ts.SyntaxKind.EndOfFileToken;
    token = scanner.scan()
  ) {
    if (
      token === ts.SyntaxKind.NewLineTrivia ||
      token === ts.SyntaxKind.WhitespaceTrivia
    ) {
      continue;
    }

    const absolutePosition = declarationStart + scanner.getTokenPos();
    if (isPositionInsideRanges(absolutePosition, excludedRanges)) continue;

    lineNumbers.add(
      sourceFile.getLineAndCharacterOfPosition(absolutePosition).line + 1,
    );
  }

  return lineNumbers.size;
}
