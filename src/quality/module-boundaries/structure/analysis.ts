import type {
  ArchitectureProject,
  ArchitectureViolation,
} from "@/quality/module-boundaries/foundation/index.ts";

import { dedupeArchitectureViolations } from "@/quality/module-boundaries/analysis/index.ts";
import {
  buildBroadBarrelViolations,
  buildCentralSurfaceBudgetViolations,
  buildDependencyPolicyCoverageViolations,
  buildDependencyPolicyCycleViolations,
  buildDirectoryDepthViolations,
  buildDirectoryFactViolations,
  buildFlattenedFeatureViolations,
  buildJunkDrawerViolations,
  buildMixedFileNameCaseViolations,
  buildMixedTypesViolations,
  buildMultipleEntrypointViolations,
  buildPeerBoundaryConsistencyViolations,
  buildPolicyFanOutViolations,
  buildPublicSurfacePurityViolations,
  buildPublicSurfaceReExportChainViolations,
  buildPublicSurfaceTierViolations,
  buildRootFileOwnershipViolations,
  buildRuntimeOnlyPathViolations,
  buildSameNameFileDirectoryViolations,
  buildScatteredFeatureHomeViolations,
  buildSplitHomeViolations,
  buildWildcardExportViolations,
  collectSiblingsByParent,
} from "@/quality/module-boundaries/structure/rule/index.ts";

export function analyzeStructureRules(
  project: ArchitectureProject,
): ArchitectureViolation[] {
  const violations: ArchitectureViolation[] = [];
  const { directoriesByParent, filesByParent } =
    collectSiblingsByParent(project);
  const directoryFactsByPath = new Map(
    project.directoryFacts.map((fact) => [fact.path, fact]),
  );

  violations.push(...buildCoreStructureViolations(project));
  violations.push(
    ...buildSiblingAndPolicyViolations(
      project,
      directoriesByParent,
      filesByParent,
      directoryFactsByPath,
    ),
  );

  return dedupeArchitectureViolations(violations);
}

function buildBoundaryViolations(
  project: ArchitectureProject,
): ArchitectureViolation[] {
  return buildMultipleEntrypointViolations(project);
}

function buildCoreStructureViolations(
  project: ArchitectureProject,
): ArchitectureViolation[] {
  return [
    ...buildBoundaryViolations(project),
    ...buildDirectoryViolations(project),
    ...buildScatteredFeatureHomeViolations(project),
    ...buildJunkDrawerViolations(project),
    ...buildBroadBarrelViolations(project),
    ...buildWildcardExportViolations(project),
    ...buildCentralSurfaceBudgetViolations(project),
    ...buildPublicSurfacePurityViolations(project),
    ...buildPublicSurfaceReExportChainViolations(project),
    ...buildRuntimeOnlyPathViolations(project),
    ...buildRootFileOwnershipViolations(project),
    ...buildDirectoryDepthViolations(project),
  ];
}

function buildDirectoryViolations(
  project: ArchitectureProject,
): ArchitectureViolation[] {
  return project.directoryFacts.flatMap((directoryFact) =>
    buildDirectoryFactViolations(project, directoryFact),
  );
}

function buildSiblingAndPolicyViolations(
  project: ArchitectureProject,
  directoriesByParent: Map<string, Set<string>>,
  filesByParent: Map<string, string[]>,
  directoryFactsByPath: Map<string, (typeof project.directoryFacts)[number]>,
): ArchitectureViolation[] {
  return [
    ...buildSiblingLayoutViolations(
      project,
      directoriesByParent,
      filesByParent,
      directoryFactsByPath,
    ),
    ...buildDependencyPolicyCoverageViolations(project),
    ...buildDependencyPolicyCycleViolations(project),
    ...buildPolicyFanOutViolations(project),
    ...buildPublicSurfaceTierViolations(project),
  ];
}

function buildSiblingLayoutViolations(
  project: ArchitectureProject,
  directoriesByParent: Map<string, Set<string>>,
  filesByParent: Map<string, string[]>,
  directoryFactsByPath: Map<string, (typeof project.directoryFacts)[number]>,
): ArchitectureViolation[] {
  const violations: ArchitectureViolation[] = [];
  const siblingParentPaths = new Set<string>([
    ...directoriesByParent.keys(),
    ...filesByParent.keys(),
  ]);

  for (const parentPath of siblingParentPaths) {
    const siblingDirectories = directoriesByParent.get(parentPath) ?? new Set();
    const siblingFiles = filesByParent.get(parentPath) ?? [];
    violations.push(
      ...collectParentLayoutViolations(
        parentPath,
        siblingDirectories,
        siblingFiles,
        project,
        directoryFactsByPath,
      ),
    );
  }

  return violations;
}

function collectParentLayoutViolations(
  parentPath: string,
  siblingDirectories: Set<string>,
  siblingFiles: string[],
  project: ArchitectureProject,
  directoryFactsByPath: Map<string, (typeof project.directoryFacts)[number]>,
): ArchitectureViolation[] {
  return [
    ...buildSameNameFileDirectoryViolations(
      parentPath,
      siblingDirectories,
      siblingFiles,
    ),
    ...buildSplitHomeViolations(parentPath, siblingDirectories, siblingFiles),
    ...buildFlattenedFeatureViolations(
      parentPath,
      siblingDirectories,
      siblingFiles,
      project.config.entrypointNames,
    ),
    ...buildMixedFileNameCaseViolations(parentPath, siblingFiles, project),
    ...buildMixedTypesViolations(
      project.config.sharedHomeNames,
      parentPath,
      siblingDirectories,
      project.files,
      project.imports,
    ),
    ...buildPeerBoundaryConsistencyViolations(
      parentPath,
      siblingDirectories,
      directoryFactsByPath,
    ),
  ];
}
