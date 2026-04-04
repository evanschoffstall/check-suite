import ts from "typescript";

import type { TopLevelDeclaration } from "./types.ts";

import {
  collectExcludedRanges,
  isPositionInsideRanges,
} from "./excluded-ranges.ts";

export function countTokens(
  declaration: TopLevelDeclaration,
  sourceFile: ts.SourceFile,
  sourceText: string,
): number {
  const declarationStart = declaration.getStart(sourceFile);
  const excludedRanges = collectExcludedRanges(declaration, sourceFile);
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    true,
    ts.LanguageVariant.Standard,
    sourceText.slice(declarationStart, declaration.getEnd()),
  );
  let tokenCount = 0;

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
    tokenCount += 1;
  }

  return tokenCount;
}
