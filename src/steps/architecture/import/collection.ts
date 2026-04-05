import { readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import ts from "typescript";

import type { AliasMapping, ImportRecord } from "@/steps/architecture/foundation/index.ts";

import {
  CODE_EXTENSIONS,
  normalizePath,
  trimLeadingDotSlash,
} from "@/steps/architecture/foundation/index.ts";

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
  const preProcessedFile = ts.preProcessFile(sourceText, true, true);
  return preProcessedFile.importedFiles.map(({ fileName }) => ({
    resolvedPath: resolveImportPath(
      cwd,
      sourcePath,
      fileName,
      knownFiles,
      aliasMappings,
    ),
    sourcePath,
    specifier: fileName,
  }));
}

function resolveCandidatePath(
  targetPath: string,
  knownFiles: Set<string>,
): null | string {
  const normalizedTargetPath = trimLeadingDotSlash(normalizePath(targetPath));
  const candidates = [
    normalizedTargetPath,
    ...CODE_EXTENSIONS.map(
      (extension) => `${normalizedTargetPath}${extension}`,
    ),
    ...CODE_EXTENSIONS.map(
      (extension) => `${normalizedTargetPath}/index${extension}`,
    ),
    ...CODE_EXTENSIONS.map(
      (extension) => `${normalizedTargetPath}/main${extension}`,
    ),
    ...CODE_EXTENSIONS.map(
      (extension) => `${normalizedTargetPath}/mod${extension}`,
    ),
  ];
  return candidates.find((candidate) => knownFiles.has(candidate)) ?? null;
}

function resolveImportPath(
  cwd: string,
  sourcePath: string,
  specifier: string,
  knownFiles: Set<string>,
  aliasMappings: AliasMapping[],
): null | string {
  if (specifier.startsWith(".")) {
    return resolveCandidatePath(
      normalizePath(
        relative(cwd, resolve(cwd, dirname(sourcePath), specifier)),
      ),
      knownFiles,
    );
  }

  for (const aliasMapping of aliasMappings) {
    if (!specifier.startsWith(aliasMapping.prefix)) continue;
    const remainder = specifier.slice(aliasMapping.prefix.length);
    for (const targetRoot of aliasMapping.targetRoots) {
      const resolvedPath = resolveCandidatePath(
        `${targetRoot}/${remainder}`,
        knownFiles,
      );
      if (resolvedPath) return resolvedPath;
    }
  }

  return null;
}
