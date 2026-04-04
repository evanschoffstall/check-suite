import type { ArchitectureProject, ArchitectureViolation } from "./types.ts";

import {
  getContainingBoundary,
  shouldFlagDeepRelativeImport,
  shouldPreferAliasImport,
} from "./import-rule-helpers.ts";
import {
  addRepeatedImport,
  buildLayerViolation,
} from "./import-rule-violations.ts";

/** Builds all import-edge violations for a single resolved import record. */
export function buildImportEntryViolations(
  project: ArchitectureProject,
  entry: ArchitectureProject["imports"][number],
  repeatedDeepImports: Map<string, Set<string>>,
): ArchitectureViolation[] {
  const sourceBoundary = getContainingBoundary(
    project.boundaries,
    entry.sourcePath,
  );
  const targetBoundary = entry.resolvedPath
    ? getContainingBoundary(project.boundaries, entry.resolvedPath)
    : null;

  return [
    ...buildPublicEntrypointViolations(entry, targetBoundary, sourceBoundary),
    ...buildAliasPreferenceViolations(project, entry),
    ...buildDeepRelativeViolations(
      project,
      entry,
      targetBoundary,
      sourceBoundary,
    ),
    ...buildLayerDirectionViolations(project, entry),
  ].map((violation) => {
    if (violation.code === "public-entrypoint" && entry.resolvedPath) {
      addRepeatedImport(
        repeatedDeepImports,
        entry.resolvedPath,
        entry.sourcePath,
      );
    }

    return violation;
  });
}

function buildAliasPreferenceViolations(
  project: ArchitectureProject,
  entry: ArchitectureProject["imports"][number],
): ArchitectureViolation[] {
  return shouldPreferAliasImport(
    project,
    entry.sourcePath,
    entry.resolvedPath,
    entry.specifier,
  )
    ? [
        {
          code: "prefer-alias-import",
          message: `${entry.sourcePath} uses relative import ${entry.specifier} even though the repository exposes alias-based cross-boundary imports`,
        },
      ]
    : [];
}

function buildDeepRelativeViolations(
  project: ArchitectureProject,
  entry: ArchitectureProject["imports"][number],
  targetBoundary: ReturnType<typeof getContainingBoundary>,
  sourceBoundary: ReturnType<typeof getContainingBoundary>,
): ArchitectureViolation[] {
  return shouldFlagDeepRelativeImport(
    project,
    entry.sourcePath,
    entry.resolvedPath,
    entry.specifier,
    targetBoundary,
    sourceBoundary,
  )
    ? [
        {
          code: "deep-relative-import",
          message: `${entry.sourcePath} uses deep relative import ${entry.specifier}; prefer a public surface or alias boundary`,
        },
      ]
    : [];
}

function buildLayerDirectionViolations(
  project: ArchitectureProject,
  entry: ArchitectureProject["imports"][number],
): ArchitectureViolation[] {
  const layerViolation = buildLayerViolation(project, entry);
  return layerViolation ? [layerViolation] : [];
}

function buildPublicEntrypointViolations(
  entry: ArchitectureProject["imports"][number],
  targetBoundary: ReturnType<typeof getContainingBoundary>,
  sourceBoundary: ReturnType<typeof getContainingBoundary>,
): ArchitectureViolation[] {
  return entry.resolvedPath &&
    targetBoundary &&
    sourceBoundary?.path !== targetBoundary.path &&
    !targetBoundary.entrypointPaths.includes(entry.resolvedPath)
    ? [
        {
          code: "public-entrypoint",
          message: `${entry.sourcePath} imports ${entry.resolvedPath} through ${entry.specifier} instead of the ${targetBoundary.path} public entrypoint`,
        },
      ]
    : [];
}
