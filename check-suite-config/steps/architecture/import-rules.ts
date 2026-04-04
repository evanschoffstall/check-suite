import { basename, dirname } from "node:path";

import type {
  ArchitectureLayerGroup,
  ArchitectureProject,
  ArchitectureViolation,
  BoundaryDirectory,
} from "./types.ts";

import { getCodeStem } from "./utils.ts";

/** Applies import-surface architecture rules to the discovered project graph. */
export function analyzeImportRules(
  project: ArchitectureProject,
): ArchitectureViolation[] {
  const violations: ArchitectureViolation[] = [];
  const repeatedDeepImports = new Map<string, Set<string>>();

  for (const entry of project.imports) {
    const sourceBoundary = getContainingBoundary(
      project.boundaries,
      entry.sourcePath,
    );
    const targetBoundary = entry.resolvedPath
      ? getContainingBoundary(project.boundaries, entry.resolvedPath)
      : null;

    if (
      entry.resolvedPath &&
      targetBoundary &&
      sourceBoundary?.path !== targetBoundary.path
    ) {
      if (!targetBoundary.entrypointPaths.includes(entry.resolvedPath)) {
        violations.push({
          code: "public-entrypoint",
          message: `${entry.sourcePath} imports ${entry.resolvedPath} through ${entry.specifier} instead of the ${targetBoundary.path} public entrypoint`,
        });
        addRepeatedImport(
          repeatedDeepImports,
          entry.resolvedPath,
          entry.sourcePath,
        );
      }
    }

    if (
      shouldPreferAliasImport(
        project,
        entry.sourcePath,
        entry.resolvedPath,
        entry.specifier,
      )
    ) {
      violations.push({
        code: "prefer-alias-import",
        message: `${entry.sourcePath} uses relative import ${entry.specifier} even though the repository exposes alias-based cross-boundary imports`,
      });
    }

    if (
      shouldFlagDeepRelativeImport(
        project,
        entry.sourcePath,
        entry.resolvedPath,
        entry.specifier,
        targetBoundary,
        sourceBoundary,
      )
    ) {
      violations.push({
        code: "deep-relative-import",
        message: `${entry.sourcePath} uses deep relative import ${entry.specifier}; prefer a public surface or alias boundary`,
      });
    }

    const layerViolation = buildLayerViolation(project, entry);
    if (layerViolation) {
      violations.push(layerViolation);
    }
  }

  for (const [targetPath, sources] of repeatedDeepImports) {
    if (sources.size < project.config.minRepeatedDeepImports) continue;
    violations.push({
      code: "repeated-deep-import",
      message: `${targetPath} is imported directly from ${sources.size} files; expose a stable public surface instead of repeating internal imports`,
    });
  }

  for (const [sourcePath, siblingImports] of collectSiblingImports(project)) {
    if (siblingImports.size > project.config.maxSiblingImports) {
      violations.push({
        code: "sibling-import-cohesion",
        message: `${sourcePath} imports ${siblingImports.size} sibling modules; extract a smaller owner or move shared code to the actual boundary`,
      });
    }
  }

  for (const [sourcePath, imports] of collectInternalImports(project)) {
    if (imports.size > project.config.maxInternalImportsPerFile) {
      violations.push({
        code: "too-many-internal-dependencies",
        message: `${sourcePath} imports ${imports.size} internal modules; split responsibilities or move shared code behind a smaller public seam`,
      });
    }
  }

  return dedupeViolations(violations);
}

function addRepeatedImport(
  repeatedImports: Map<string, Set<string>>,
  targetPath: string,
  sourcePath: string,
): void {
  const sources = repeatedImports.get(targetPath) ?? new Set<string>();
  sources.add(sourcePath);
  repeatedImports.set(targetPath, sources);
}

function buildLayerViolation(
  project: ArchitectureProject,
  entry: ArchitectureProject["imports"][number],
): ArchitectureViolation | null {
  if (!entry.resolvedPath) {
    return null;
  }

  const sourceLayer = inferLayerGroup(
    entry.sourcePath,
    project.config.layerGroups,
  );
  const targetLayer = inferLayerGroup(
    entry.resolvedPath,
    project.config.layerGroups,
  );

  if (!sourceLayer || !targetLayer || sourceLayer.rank >= targetLayer.rank) {
    return null;
  }

  return {
    code: "layer-direction",
    message: `${entry.sourcePath} (${sourceLayer.group.name}) depends on ${entry.resolvedPath} (${targetLayer.group.name}); lower layers must not depend on higher layers`,
  };
}

function collectInternalImports(
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

function collectSiblingImports(
  project: ArchitectureProject,
): Map<string, Set<string>> {
  const siblingImports = new Map<string, Set<string>>();

  for (const entry of project.imports) {
    if (
      !entry.resolvedPath ||
      !isSameDirectory(entry.sourcePath, entry.resolvedPath) ||
      project.config.entrypointNames.includes(
        getCodeStem(basename(entry.sourcePath)),
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

function dedupeViolations(
  violations: ArchitectureViolation[],
): ArchitectureViolation[] {
  const seen = new Set<string>();
  return violations.filter((violation) => {
    const key = `${violation.code}:${violation.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getCodeRoot(project: ArchitectureProject, filePath: string): string {
  return (
    project.codeRoots.directories.find(
      (directory) =>
        filePath === directory || filePath.startsWith(`${directory}/`),
    ) ?? filePath
  );
}

function getContainingBoundary(
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

function hasAliasForTarget(
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

function inferLayerGroup(
  filePath: string,
  layerGroups: ArchitectureLayerGroup[],
): null | { group: ArchitectureLayerGroup; rank: number; segment: string } {
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
        return { group, rank, segment: segments[segmentIndex] };
      }
    }
  }

  return null;
}

function isSameDirectory(leftPath: string, rightPath: string): boolean {
  return dirname(leftPath) === dirname(rightPath);
}

function shouldFlagDeepRelativeImport(
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

function shouldPreferAliasImport(
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
