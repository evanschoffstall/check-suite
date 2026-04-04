import type {
  ArchitectureLayerGroup,
  ArchitectureProject,
  BoundaryDirectory,
} from "./types.ts";

import {
  getCodeRoot,
  hasAliasForTarget,
  isSameDirectory,
} from "./import-rule-paths.ts";
import { getCodeStem } from "./utils.ts";

export function inferLayerGroup(
  filePath: string,
  layerGroups: ArchitectureLayerGroup[],
): null | { group: ArchitectureLayerGroup; rank: number } {
  const segments = filePath
    .split("/")
    .flatMap((segment, index, allSegments) =>
      index === allSegments.length - 1 ? [getCodeStem(segment)] : [segment],
    );

  for (
    let segmentIndex = segments.length - 1;
    segmentIndex >= 0;
    segmentIndex -= 1
  ) {
    const normalizedSegment = segments[segmentIndex].toLowerCase();

    for (const [rank, group] of layerGroups.entries()) {
      if (
        group.patterns.some(
          (pattern) => pattern.toLowerCase() === normalizedSegment,
        )
      ) {
        return { group, rank };
      }
    }
  }

  return null;
}

export function shouldFlagDeepRelativeImport(
  project: ArchitectureProject,
  sourcePath: string,
  resolvedPath: null | string,
  specifier: string,
  targetBoundary: BoundaryDirectory | null,
  sourceBoundary: BoundaryDirectory | null,
): boolean {
  return (
    resolvedPath !== null &&
    specifier.startsWith(".") &&
    specifier.split("../").length - 1 >= 3 &&
    (getCodeRoot(project, sourcePath) !== getCodeRoot(project, resolvedPath) ||
      (targetBoundary !== null && sourceBoundary?.path !== targetBoundary.path))
  );
}

export function shouldPreferAliasImport(
  project: ArchitectureProject,
  sourcePath: string,
  resolvedPath: null | string,
  specifier: string,
): boolean {
  return (
    resolvedPath !== null &&
    specifier.startsWith(".") &&
    project.aliasMappings.length > 0 &&
    !isSameDirectory(sourcePath, resolvedPath) &&
    hasAliasForTarget(project, resolvedPath)
  );
}
