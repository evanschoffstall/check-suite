import type {
  ArchitectureProject,
  ArchitectureViolation,
  SourceFileFacts,
} from "@/quality/module-boundaries/foundation/index.ts";

import { getContainingBoundary } from "@/quality/module-boundaries/import/rule/index.ts";

import { getTopLevelOwner } from "./helpers";

/** Flags public surfaces that expose too many exported symbols for a central shared surface. */
export function buildCentralSurfaceBudgetViolations(
  project: ArchitectureProject,
): ArchitectureViolation[] {
  if (
    project.config.centralSurfacePathPrefixes.length === 0 ||
    project.config.maxCentralSurfaceExports === Number.MAX_SAFE_INTEGER
  ) {
    return [];
  }

  return getPublicSurfaceFacts(project).flatMap((sourceFact) =>
    isConfiguredCentralSurface(project, sourceFact.path) &&
    sourceFact.exportedSymbolCount > project.config.maxCentralSurfaceExports
      ? [
          {
            code: "central-surface-budget",
            message: `${sourceFact.path} exports ${sourceFact.exportedSymbolCount} symbols; keep central shared surfaces at or below ${project.config.maxCentralSurfaceExports} exports`,
          },
        ]
      : [],
  );
}

/** Flags public surfaces that re-export another public surface, creating a barrel chain. */
export function buildPublicSurfaceReExportChainViolations(
  project: ArchitectureProject,
): ArchitectureViolation[] {
  if (project.config.allowPublicSurfaceReExportChains) {
    return [];
  }

  const publicSurfacePaths = new Set(
    getPublicSurfaceFacts(project).map((sourceFact) => sourceFact.path),
  );

  return getPublicSurfaceFacts(project).flatMap((sourceFact) =>
    sourceFact.reExports.flatMap((reExport) => {
      if (
        !reExport.resolvedPath ||
        !publicSurfacePaths.has(reExport.resolvedPath)
      ) {
        return [];
      }

      const sourceBoundary = getContainingBoundary(
        project.boundaries,
        sourceFact.path,
      );
      const targetBoundary = getContainingBoundary(
        project.boundaries,
        reExport.resolvedPath,
      );
      if (sourceBoundary?.path === targetBoundary?.path) {
        return [];
      }

      if (
        getTopLevelOwner(project, sourceFact.path) ===
        getTopLevelOwner(project, reExport.resolvedPath)
      ) {
        return [];
      }

      return [
        {
          code: "public-surface-re-export-chain",
          message: `${sourceFact.path} re-exports ${reExport.resolvedPath}; keep public surfaces from chaining through other public surfaces`,
        },
      ];
    }),
  );
}

/** Flags wildcard exports on public surfaces beyond the configured budget. */
export function buildWildcardExportViolations(
  project: ArchitectureProject,
): ArchitectureViolation[] {
  if (
    project.config.maxWildcardExportsPerPublicSurface ===
    Number.MAX_SAFE_INTEGER
  ) {
    return [];
  }

  return getPublicSurfaceFacts(project).flatMap((sourceFact) =>
    sourceFact.wildcardExportCount >
    project.config.maxWildcardExportsPerPublicSurface
      ? [
          {
            code: "public-surface-wildcard-export",
            message: `${sourceFact.path} uses ${sourceFact.wildcardExportCount} wildcard export(s); keep public surfaces explicit and curated`,
          },
        ]
      : [],
  );
}

function getPublicSurfaceFacts(
  project: ArchitectureProject,
): SourceFileFacts[] {
  return project.sourceFacts.filter((sourceFact) =>
    isPublicSurface(project, sourceFact.path),
  );
}

function isConfiguredCentralSurface(
  project: ArchitectureProject,
  filePath: string,
): boolean {
  return project.config.centralSurfacePathPrefixes.some(
    (prefix) => filePath === prefix || filePath.startsWith(`${prefix}/`),
  );
}

function isPublicSurface(
  project: ArchitectureProject,
  filePath: string,
): boolean {
  return (
    project.config.explicitPublicSurfacePaths.includes(filePath) ||
    project.sourceFacts.some(
      (sourceFact) => sourceFact.path === filePath && sourceFact.isEntrypoint,
    )
  );
}
