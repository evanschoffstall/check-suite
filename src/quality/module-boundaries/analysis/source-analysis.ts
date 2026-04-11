import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import ts from "typescript";

import type {
  AliasMapping,
  ArchitectureAnalyzerConfig,
  SourceFileFacts,
  SourceFileReExport,
} from "@/quality/module-boundaries/foundation/index.ts";

import {
  getCodeStem,
  isArchitectureEntrypoint,
} from "@/quality/module-boundaries/foundation/index.ts";

import { resolveModulePath } from "./module-resolution";
import { countTopLevelRuntimeOperations } from "./top-level-operations";

/** Collects AST-derived facts for each scanned source file. */
export function collectSourceFacts(
  cwd: string,
  files: string[],
  aliasMappings: AliasMapping[],
  config: Required<ArchitectureAnalyzerConfig>,
): SourceFileFacts[] {
  const knownFiles = new Set(files);

  return files
    .map((filePath) =>
      analyzeSourceFile(cwd, filePath, knownFiles, aliasMappings, config),
    )
    .sort((left, right) => left.path.localeCompare(right.path));
}

function analyzeSourceFile(
  cwd: string,
  filePath: string,
  knownFiles: ReadonlySet<string>,
  aliasMappings: AliasMapping[],
  config: Required<ArchitectureAnalyzerConfig>,
): SourceFileFacts {
  const sourceText = readFileSync(join(cwd, filePath), "utf8");
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
  );
  const fileName = filePath.split("/").pop() ?? filePath;
  const reExports = collectReExports(
    cwd,
    filePath,
    sourceFile,
    knownFiles,
    aliasMappings,
  );

  return {
    directoryPath: dirname(filePath).replace(/^\.$/u, ""),
    exportedSymbolCount: countExportedSymbols(sourceFile),
    exportModuleSpecifiers: collectExportModuleSpecifiers(sourceFile),
    isEntrypoint: isArchitectureEntrypoint(config, getCodeStem(fileName)),
    path: filePath,
    reExports,
    runtimeOperationCount: countTopLevelRuntimeOperations(sourceFile),
    stem: getCodeStem(fileName),
    topLevelDeclarationCount: countSourceFileTopLevelDeclarations(sourceFile),
    topLevelExecutableStatementCount:
      countTopLevelExecutableStatements(sourceFile),
    wildcardExportCount: reExports.filter((entry) => entry.isWildcard).length,
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

function collectReExports(
  cwd: string,
  filePath: string,
  sourceFile: ts.SourceFile,
  knownFiles: ReadonlySet<string>,
  aliasMappings: AliasMapping[],
): SourceFileReExport[] {
  return sourceFile.statements.flatMap((statement) =>
    ts.isExportDeclaration(statement) &&
    statement.moduleSpecifier &&
    ts.isStringLiteralLike(statement.moduleSpecifier)
      ? [
          {
            isWildcard: statement.exportClause === undefined,
            resolvedPath: resolveModulePath(
              cwd,
              filePath,
              statement.moduleSpecifier.text,
              knownFiles,
              aliasMappings,
            ),
            specifier: statement.moduleSpecifier.text,
          },
        ]
      : [],
  );
}

function countExportedSymbols(sourceFile: ts.SourceFile): number {
  return sourceFile.statements.reduce(
    (count, statement) => count + countStatementExports(statement),
    0,
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

function countStatementExports(statement: ts.Statement): number {
  if (ts.isExportDeclaration(statement)) {
    if (!statement.exportClause) {
      return 1;
    }

    return ts.isNamedExports(statement.exportClause)
      ? statement.exportClause.elements.length
      : 1;
  }

  if (ts.isExportAssignment(statement)) {
    return 1;
  }

  if (ts.isVariableStatement(statement) && hasExportModifier(statement)) {
    return statement.declarationList.declarations.length;
  }

  return hasExportModifier(statement)
    ? countTopLevelDeclarations(statement)
    : 0;
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

function countTopLevelExecutableStatements(sourceFile: ts.SourceFile): number {
  return sourceFile.statements.reduce(
    (count, statement) => count + (isPureSurfaceStatement(statement) ? 0 : 1),
    0,
  );
}

function hasExportModifier(node: ts.Node): boolean {
  if (!ts.canHaveModifiers(node)) {
    return false;
  }

  return (
    ts
      .getModifiers(node)
      ?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ??
    false
  );
}

function isPureSurfaceStatement(statement: ts.Statement): boolean {
  return (
    ts.isImportDeclaration(statement) ||
    ts.isExportDeclaration(statement) ||
    ts.isInterfaceDeclaration(statement) ||
    ts.isTypeAliasDeclaration(statement)
  );
}
