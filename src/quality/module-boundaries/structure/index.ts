import type {
  ArchitectureProject,
  ArchitectureViolation,
} from "@/quality/module-boundaries/foundation/index.ts";

import { dedupeArchitectureViolations } from "@/quality/module-boundaries/analysis/index.ts";
import {
  buildBroadBarrelViolations,
  buildDirectoryFactViolations,
  buildFlattenedFeatureViolations,
  buildJunkDrawerViolations,
  buildMixedTypesViolations,
  buildPeerBoundaryConsistencyViolations,
  buildSameNameFileDirectoryViolations,
  buildScatteredFeatureHomeViolations,
  buildSplitHomeViolations,
  collectSiblingsByParent,
} from "@/quality/module-boundaries/structure/rule/index.ts";

/** Applies folder ownership and file-layout architecture rules. */
export function analyzeStructureRules(
  project: ArchitectureProject,
): ArchitectureViolation[] {
  const violations: ArchitectureViolation[] = [];
  const { directoriesByParent, filesByParent } =
    collectSiblingsByParent(project);
  const directoryFactsByPath = new Map(
    project.directoryFacts.map((fact) => [fact.path, fact]),
  );

  violations.push(...buildBoundaryViolations(project));
  violations.push(...buildDirectoryViolations(project));
  violations.push(
    ...buildSiblingLayoutViolations(
      project,
      directoriesByParent,
      filesByParent,
      directoryFactsByPath,
    ),
  );
  violations.push(...buildScatteredFeatureHomeViolations(project));
  violations.push(...buildJunkDrawerViolations(project));
  violations.push(...buildBroadBarrelViolations(project));

  return dedupeArchitectureViolations(violations);
}

function buildBoundaryViolations(
  project: ArchitectureProject,
): ArchitectureViolation[] {
  return project.boundaries.flatMap((boundary) =>
    boundary.entrypointPaths.length > 1
      ? [
          {
            code: "multiple-entrypoints",
            message: `${boundary.path} exposes multiple public entrypoints (${boundary.entrypointPaths.join(", ")}); keep one intentional surface per boundary`,
          },
        ]
      : [],
  );
}

function buildDirectoryViolations(
  project: ArchitectureProject,
): ArchitectureViolation[] {
  return project.directoryFacts.flatMap((directoryFact) =>
    buildDirectoryFactViolations(project, directoryFact),
  );
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
    ...buildMixedTypesViolations(
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
