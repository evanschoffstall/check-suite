import { dirname } from "node:path";

import type {
  ArchitectureProject,
  BoundaryDirectory,
} from "../../foundation/index.ts";

export function getCodeRoot(
  project: ArchitectureProject,
  filePath: string,
): string {
  return (
    project.codeRoots.directories.find(
      (directory) =>
        filePath === directory || filePath.startsWith(`${directory}/`),
    ) ?? filePath
  );
}

export function getContainingBoundary(
  boundaries: BoundaryDirectory[],
  filePath: string,
): BoundaryDirectory | null {
  return (
    boundaries
      .filter(
        (boundary) =>
          filePath === boundary.path ||
          filePath.startsWith(`${boundary.path}/`),
      )
      .sort((left, right) => right.path.length - left.path.length)[0] ?? null
  );
}

export function hasAliasForTarget(
  project: ArchitectureProject,
  filePath: string,
): boolean {
  return project.aliasMappings.some((aliasMapping) =>
    aliasMapping.targetRoots.some(
      (targetRoot) =>
        filePath === targetRoot || filePath.startsWith(`${targetRoot}/`),
    ),
  );
}

export function isSameDirectory(leftPath: string, rightPath: string): boolean {
  return dirname(leftPath) === dirname(rightPath);
}
