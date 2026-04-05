import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

import type {
  AliasMapping,
  ImportRecord,
} from "@/quality/module-boundaries/foundation/index.ts";

import { resolveModulePath } from "@/quality/module-boundaries/analysis/index.ts";

/** Collects import edges for all scanned source files. */
export function collectImports(
  cwd: string,
  files: string[],
  aliasMappings: AliasMapping[],
): ImportRecord[] {
  const knownFiles = new Set(files);
  return files.flatMap((sourcePath) =>
    collectFileImports(cwd, sourcePath, knownFiles, aliasMappings),
  );
}

function collectFileImports(
  cwd: string,
  sourcePath: string,
  knownFiles: Set<string>,
  aliasMappings: AliasMapping[],
): ImportRecord[] {
  const sourceText = readFileSync(join(cwd, sourcePath), "utf8");
  const sourceFile = ts.createSourceFile(
    sourcePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
  );

  return sourceFile.statements.flatMap((statement) => {
    if (
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteralLike(statement.moduleSpecifier)
    ) {
      return [
        createImportRecord(
          cwd,
          sourcePath,
          statement.moduleSpecifier.text,
          knownFiles,
          aliasMappings,
          {
            isReExport: false,
            isSideEffectOnly: statement.importClause === undefined,
            isTypeOnly:
              statement.importClause?.phaseModifier ===
              ts.SyntaxKind.TypeKeyword,
          },
        ),
      ];
    }

    if (
      ts.isExportDeclaration(statement) &&
      statement.moduleSpecifier &&
      ts.isStringLiteralLike(statement.moduleSpecifier)
    ) {
      return [
        createImportRecord(
          cwd,
          sourcePath,
          statement.moduleSpecifier.text,
          knownFiles,
          aliasMappings,
          {
            isReExport: true,
            isSideEffectOnly: false,
            isTypeOnly: false,
          },
        ),
      ];
    }

    return [];
  });
}

function createImportRecord(
  cwd: string,
  sourcePath: string,
  specifier: string,
  knownFiles: Set<string>,
  aliasMappings: AliasMapping[],
  options: {
    isReExport: boolean;
    isSideEffectOnly: boolean;
    isTypeOnly: boolean;
  },
): ImportRecord {
  return {
    isReExport: options.isReExport,
    isSideEffectOnly: options.isSideEffectOnly,
    isTypeOnly: options.isTypeOnly,
    resolvedPath: resolveModulePath(
      cwd,
      sourcePath,
      specifier,
      knownFiles,
      aliasMappings,
    ),
    sourcePath,
    specifier,
  };
}
