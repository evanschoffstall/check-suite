import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

import type {
  AliasMapping,
  ImportRecord,
  NormalizedArchitectureAnalyzerConfig,
} from "@/quality/module-boundaries/foundation/index.ts";

import { resolveModulePath } from "@/quality/module-boundaries/analysis/index.ts";

interface CreateImportRecordInput {
  aliasMappings: AliasMapping[];
  config: NormalizedArchitectureAnalyzerConfig;
  cwd: string;
  isReExport: boolean;
  isSideEffectOnly: boolean;
  isTypeOnly: boolean;
  knownFiles: Set<string>;
  sourcePath: string;
  specifier: string;
}

/** Collects import edges for all scanned source files. */
export function collectImports(
  cwd: string,
  files: string[],
  aliasMappings: AliasMapping[],
  config: NormalizedArchitectureAnalyzerConfig,
): ImportRecord[] {
  const knownFiles = new Set(files);
  return files.flatMap((sourcePath) =>
    collectFileImports(cwd, sourcePath, knownFiles, aliasMappings, config),
  );
}

function collectFileImports(
  cwd: string,
  sourcePath: string,
  knownFiles: Set<string>,
  aliasMappings: AliasMapping[],
  config: NormalizedArchitectureAnalyzerConfig,
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
          {
            aliasMappings,
            config,
            cwd,
            isReExport: false,
            isSideEffectOnly: statement.importClause === undefined,
            isTypeOnly:
              statement.importClause?.phaseModifier ===
              ts.SyntaxKind.TypeKeyword,
            knownFiles,
            sourcePath,
            specifier: statement.moduleSpecifier.text,
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
          {
            aliasMappings,
            config,
            cwd,
            isReExport: true,
            isSideEffectOnly: false,
            isTypeOnly: false,
            knownFiles,
            sourcePath,
            specifier: statement.moduleSpecifier.text,
          },
        ),
      ];
    }

    return [];
  });
}

function createImportRecord(
  input: CreateImportRecordInput,
): ImportRecord {
  return {
    isReExport: input.isReExport,
    isSideEffectOnly: input.isSideEffectOnly,
    isTypeOnly: input.isTypeOnly,
    resolvedPath: resolveModulePath(
      input.cwd,
      input.sourcePath,
      input.specifier,
      input.knownFiles,
      input.aliasMappings,
      input.config,
    ),
    sourcePath: input.sourcePath,
    specifier: input.specifier,
  };
}
