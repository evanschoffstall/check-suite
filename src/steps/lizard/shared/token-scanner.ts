import ts from "typescript";

interface TokenScannerOptions {
  getAbsoluteTokenStart?: (scanner: ts.Scanner) => number;
  languageVariant: ts.LanguageVariant;
  languageVersion: ts.ScriptTarget;
  shouldIgnorePosition?: (position: number) => boolean;
  sourceText: string;
}

/** Collects the 1-based line numbers occupied by meaningful tokens in a source span. */
export function collectMeaningfulTokenLineNumbers(
  sourceFile: ts.SourceFile,
  options: TokenScannerOptions,
): Set<number> {
  const lineNumbers = new Set<number>();

  scanMeaningfulTokens(options, (absolutePosition) => {
    lineNumbers.add(
      sourceFile.getLineAndCharacterOfPosition(absolutePosition).line + 1,
    );
  });

  return lineNumbers;
}

/** Counts non-whitespace, non-newline tokens in a source span. */
export function countMeaningfulTokens(options: TokenScannerOptions): number {
  let tokenCount = 0;

  scanMeaningfulTokens(options, () => {
    tokenCount += 1;
  });

  return tokenCount;
}

function scanMeaningfulTokens(
  options: TokenScannerOptions,
  onToken: (absolutePosition: number) => void,
): void {
  const scanner = ts.createScanner(
    options.languageVersion,
    true,
    options.languageVariant,
    options.sourceText,
  );
  const getAbsoluteTokenStart =
    options.getAbsoluteTokenStart ??
    ((activeScanner) => activeScanner.getTokenStart());

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

    const absolutePosition = getAbsoluteTokenStart(scanner);
    if (options.shouldIgnorePosition?.(absolutePosition)) {
      continue;
    }

    onToken(absolutePosition);
  }
}
