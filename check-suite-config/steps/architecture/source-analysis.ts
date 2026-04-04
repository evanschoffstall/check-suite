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
  const fileName = filePath.split("/").pop() ?? filePath;

  return {
    directoryPath: dirname(filePath).replace(/^\.$/u, ""),
    exportModuleSpecifiers: collectExportModuleSpecifiers(sourceFile),
    isEntrypoint: entrypointNames.includes(getCodeStem(fileName)),
    path: filePath,
    stem: getCodeStem(fileName),
    topLevelDeclarationCount: countSourceFileTopLevelDeclarations(sourceFile),
  };
}

function collectExportModuleSpecifiers(sourceFile: ts.SourceFile): string[] {
  return sourceFile.statements.flatMap((statement) =>
    ts.isExportDeclaration(statement) &&
    statement.moduleSpecifier &&
    ts.isStringLiteralLike(statement.moduleSpecifier)
      ? [statement.moduleSpecifier.text]
      : [],
  );
}

function countSourceFileTopLevelDeclarations(
  sourceFile: ts.SourceFile,
): number {
  return sourceFile.statements.reduce(
    (count, statement) => count + countTopLevelDeclarations(statement),
    0,
  );
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
