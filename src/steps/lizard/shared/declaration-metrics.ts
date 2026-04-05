import ts from "typescript";

import type { TopLevelDeclaration } from "./contracts";

import {
  collectMeaningfulTokenLineNumbers,
  countMeaningfulTokens,
} from "./token-scanner";

// ---------------------------------------------------------------------------
// Excluded ranges — positions inside nested functions / JSX that should be
// excluded when counting tokens or NLOC for the enclosing declaration.
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Cyclomatic complexity
// ---------------------------------------------------------------------------

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

    ts.forEachChild(node, (child) => {
      visit(child, nextDepth);
    });
  };

  if (declaration.body) visit(declaration.body, 0);
  return maxDepth;
}

// ---------------------------------------------------------------------------
// Nesting depth
// ---------------------------------------------------------------------------

export function countNonCommentLines(
  declaration: TopLevelDeclaration,
  sourceFile: ts.SourceFile,
  sourceText: string,
): number {
  const declarationStart = declaration.getStart(sourceFile);
  const excludedRanges = collectExcludedRanges(declaration, sourceFile);
  const lineNumbers = collectMeaningfulTokenLineNumbers(sourceFile, {
    getAbsoluteTokenStart: (scanner) =>
      declarationStart + scanner.getTokenStart(),
    languageVariant: sourceFile.languageVariant,
    languageVersion: sourceFile.languageVersion,
    shouldIgnorePosition: (absolutePosition) =>
      isPositionInsideRanges(absolutePosition, excludedRanges),
    sourceText: sourceText.slice(declarationStart, declaration.getEnd()),
  });

  return lineNumbers.size;
}

// ---------------------------------------------------------------------------
// Non-comment line count (NLOC)
// ---------------------------------------------------------------------------

export function countTokens(
  declaration: TopLevelDeclaration,
  sourceFile: ts.SourceFile,
  sourceText: string,
): number {
  const declarationStart = declaration.getStart(sourceFile);
  const excludedRanges = collectExcludedRanges(declaration, sourceFile);
  return countMeaningfulTokens({
    getAbsoluteTokenStart: (scanner) =>
      declarationStart + scanner.getTokenStart(),
    languageVariant: ts.LanguageVariant.Standard,
    languageVersion: ts.ScriptTarget.Latest,
    shouldIgnorePosition: (absolutePosition) =>
      isPositionInsideRanges(absolutePosition, excludedRanges),
    sourceText: sourceText.slice(declarationStart, declaration.getEnd()),
  });
}

// ---------------------------------------------------------------------------
// Token count
// ---------------------------------------------------------------------------

export function isPositionInsideRanges(
  position: number,
  ranges: (readonly [number, number])[],
): boolean {
  return ranges.some(([start, end]) => position >= start && position < end);
}
