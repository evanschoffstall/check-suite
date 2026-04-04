import ts from "typescript";

import type {
  TopLevelFunctionNode,
  TypeScriptFunctionMetrics,
} from "../../shared/index.ts";

import {
  computeCyclomaticComplexity,
  computeMaxNestingDepth,
  countNonCommentLines,
  countTokens,
} from "../../shared/index.ts";

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
