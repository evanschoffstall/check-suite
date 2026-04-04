import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import ts from "typescript";

import type { SourceFileFacts } from "./types.ts";

import { getCodeStem } from "./utils.ts";

/** Collects AST-derived facts for each scanned source file. */
export function collectSourceFacts(
  cwd: string,
  files: string[],
  entrypointNames: readonly string[],
): SourceFileFacts[] {
  return files
    .map((filePath) => analyzeSourceFile(cwd, filePath, entrypointNames))
    .sort((left, right) => left.path.localeCompare(right.path));
}

function analyzeSourceFile(
  cwd: string,
  filePath: string,
  entrypointNames: readonly string[],
): SourceFileFacts {
  const sourceText = readFileSync(join(cwd, filePath), "utf8");
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
  );
  const exportModuleSpecifiers: string[] = [];
  let topLevelDeclarationCount = 0;

  for (const statement of sourceFile.statements) {
    if (
      ts.isExportDeclaration(statement) &&
      statement.moduleSpecifier &&
      ts.isStringLiteralLike(statement.moduleSpecifier)
    ) {
      exportModuleSpecifiers.push(statement.moduleSpecifier.text);
    }

    topLevelDeclarationCount += countTopLevelDeclarations(statement);
  }

  return {
    directoryPath: dirname(filePath).replace(/^\.$/u, ""),
    exportModuleSpecifiers,
    isEntrypoint: entrypointNames.includes(
      getCodeStem(filePath.split("/").pop() ?? filePath),
    ),
    path: filePath,
    stem: getCodeStem(filePath.split("/").pop() ?? filePath),
    topLevelDeclarationCount,
  };
}

function countTopLevelDeclarations(statement: ts.Statement): number {
  if (ts.isVariableStatement(statement)) {
    return statement.declarationList.declarations.length;
  }

  return ts.isClassDeclaration(statement) ||
    ts.isEnumDeclaration(statement) ||
    ts.isFunctionDeclaration(statement) ||
    ts.isInterfaceDeclaration(statement) ||
    ts.isModuleDeclaration(statement) ||
    ts.isTypeAliasDeclaration(statement)
    ? 1
    : 0;
}
