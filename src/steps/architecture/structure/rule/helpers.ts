import { dirname } from "node:path";

import type { ArchitectureProject } from "@/steps/architecture/foundation/index.ts";

/** Returns whether the directory path is one of the discovered code roots. */
export function isCodeRootDirectory(
  project: ArchitectureProject,
  directoryPath: string,
): boolean {
  return project.codeRoots.directories.includes(directoryPath);
}

/** Returns whether a path lives directly under a discovered code root. */
export function isDirectChildOfCodeRoot(
  project: ArchitectureProject,
  path: string,
): boolean {
  const parentPath = dirname(path).replace(/^\.$/u, "");
  return project.codeRoots.directories.includes(parentPath);
}

/** Identifies entrypoints that only re-export modules and own no declarations. */
export function isPureBarrelEntrypoint(
  project: ArchitectureProject,
  entrypointPath: string,
): boolean {
  const sourceFact = project.sourceFacts.find(
    (fact) => fact.path === entrypointPath,
  );

  return Boolean(
    sourceFact &&
    sourceFact.exportModuleSpecifiers.length > 0 &&
    sourceFact.topLevelDeclarationCount === 0,
  );
}

/** Matches flattened file stems back to the owning feature directory name. */
export function matchesResponsibilityName(
  stem: string,
  directoryName: string,
): boolean {
  return (
    stem === directoryName ||
    stem.startsWith(`${directoryName}-`) ||
    stem.startsWith(`${directoryName}_`)
  );
}

/** Formats an empty parent path as the repository root for diagnostics. */
export function normalizeParentPath(parentPath: string): string {
  return parentPath.length === 0 ? "repo root" : parentPath;
}
