import type { ArchitectureProject } from "@/steps/architecture/foundation/index.ts";

import { getCodeStem } from "@/steps/architecture/foundation/index.ts";

import { isSameDirectory } from "./paths";

/** Records one deep import so repeated offenders can be summarized later. */
export function addRepeatedImport(
  repeatedImports: Map<string, Set<string>>,
  targetPath: string,
  sourcePath: string,
): void {
  const sources = repeatedImports.get(targetPath) ?? new Set<string>();
  sources.add(sourcePath);
  repeatedImports.set(targetPath, sources);
}

/** Collects per-source internal imports for fan-in checks. */
export function collectInternalImports(
  project: ArchitectureProject,
): Map<string, Set<string>> {
  const internalImports = new Map<string, Set<string>>();

  for (const entry of project.imports) {
    if (!entry.resolvedPath) {
      continue;
    }

    const imports = internalImports.get(entry.sourcePath) ?? new Set<string>();
    imports.add(entry.resolvedPath);
    internalImports.set(entry.sourcePath, imports);
  }

  return internalImports;
}

/** Collects sibling-module imports for cohesion checks. */
export function collectSiblingImports(
  project: ArchitectureProject,
): Map<string, Set<string>> {
  const siblingImports = new Map<string, Set<string>>();

  for (const entry of project.imports) {
    if (
      !entry.resolvedPath ||
      !isSameDirectory(entry.sourcePath, entry.resolvedPath) ||
      project.config.entrypointNames.includes(
        getCodeStem(entry.sourcePath.split("/").pop() ?? entry.sourcePath),
      )
    ) {
      continue;
    }

    const siblings = siblingImports.get(entry.sourcePath) ?? new Set<string>();
    siblings.add(entry.resolvedPath);
    siblingImports.set(entry.sourcePath, siblings);
  }

  return siblingImports;
}
