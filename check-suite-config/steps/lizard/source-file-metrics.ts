import ts from "typescript";

export function countSourceFileNonCommentLines(
  sourceFile: ts.SourceFile,
  sourceText: string,
): number {
  const scanner = ts.createScanner(
    sourceFile.languageVersion,
    true,
    sourceFile.languageVariant,
    sourceText,
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
    )
      continue;
    lineNumbers.add(
      sourceFile.getLineAndCharacterOfPosition(scanner.getTokenPos()).line + 1,
    );
  }

  return lineNumbers.size;
}

export function countSourceFileTokens(sourceText: string): number {
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    true,
    ts.LanguageVariant.Standard,
    sourceText,
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
    )
      continue;
    tokenCount += 1;
  }

  return tokenCount;
}
