import type {
  ArchitectureProject,
  ArchitectureViolation,
  DirectoryFacts,
} from "@/quality/module-boundaries/foundation/index.ts";

import { getLastPathSegment } from "@/quality/module-boundaries/foundation/index.ts";

import {
  isCodeRootDirectory,
  isPureBarrelEntrypoint,
  normalizeParentPath,
} from "./helpers";

/** Flags entrypoints that re-export too many modules. */
export function buildBroadBarrelViolations(
  project: ArchitectureProject,
): ArchitectureViolation[] {
  return project.sourceFacts
    .filter(
      (fact) =>
        fact.isEntrypoint &&
        fact.exportModuleSpecifiers.length >
          project.config.maxEntrypointReExports,
    )
    .map((fact) => ({
      code: "broad-barrel-surface",
      message: `${fact.path} re-exports ${fact.exportModuleSpecifiers.length} modules; keep feature barrels intentional instead of turning them into dumping grounds`,
    }));
}

/** Applies directory ownership rules around public entrypoints. */
export function buildDirectoryFactViolations(
  project: ArchitectureProject,
  directoryFact: DirectoryFacts,
): ArchitectureViolation[] {
  if (isCodeRootDirectory(project, directoryFact.path)) {
    return [];
  }

  const implementationFiles = directoryFact.codeFilePaths.filter(
    (filePath) => !directoryFact.entrypointPaths.includes(filePath),
  );
  const hasImplementation =
    implementationFiles.length > 0 ||
    directoryFact.childDirectoryPaths.length > 0;
  const shouldRequireEntrypoint =
    implementationFiles.length > 1 ||
    directoryFact.childDirectoryPaths.length > 0;
  const violations: ArchitectureViolation[] = [];

  if (
    isMissingPublicEntrypoint(
      hasImplementation,
      shouldRequireEntrypoint,
      directoryFact,
    )
  ) {
    violations.push({
      code: "missing-public-entrypoint",
      message: `${directoryFact.path} owns implementation files but has no ${project.config.entrypointNames[0]}.ts public entrypoint`,
    });
  }

  if (
    isOrphanPublicEntrypoint(project, directoryFact, implementationFiles.length)
  ) {
    violations.push({
      code: "orphan-public-entrypoint",
      message: `${directoryFact.path} exposes a public entrypoint without any colocated implementation; remove the orphan barrel or move the owned code under this folder`,
    });
  }

  return violations;
}

/** Requires peer feature folders to follow a consistent public-surface pattern. */
export function buildPeerBoundaryConsistencyViolations(
  parentPath: string,
  siblingDirectories: Set<string>,
  directoryFactsByPath: Map<string, DirectoryFacts>,
): ArchitectureViolation[] {
  const peerFacts = [...siblingDirectories]
    .map(
      (directoryName) =>
        directoryFactsByPath.get(
          `${parentPath}/${directoryName}`.replace(/^\//u, ""),
        ) ?? directoryFactsByPath.get(directoryName),
    )
    .filter((fact): fact is DirectoryFacts => fact !== undefined)
    .filter(
      (fact) =>
        fact.childDirectoryPaths.length > 0 ||
        fact.codeFilePaths.filter(
          (filePath) => !fact.entrypointPaths.includes(filePath),
        ).length > 1,
    );

  if (peerFacts.length < 2) {
    return [];
  }

  const withEntrypoint = peerFacts.filter(
    (fact) => fact.entrypointPaths.length > 0,
  );
  const withoutEntrypoint = peerFacts.filter(
    (fact) => fact.entrypointPaths.length === 0,
  );

  return withEntrypoint.length > 0 && withoutEntrypoint.length > 0
    ? [
        {
          code: "peer-boundary-inconsistency",
          message: `${normalizeParentPath(parentPath)} mixes peer folders with and without public entrypoints (${withEntrypoint.map((fact) => getLastPathSegment(fact.path)).join(", ")} vs ${withoutEntrypoint.map((fact) => getLastPathSegment(fact.path)).join(", ")}); keep sibling features on one architectural pattern`,
        },
      ]
    : [];
}

function isMissingPublicEntrypoint(
  hasImplementation: boolean,
  shouldRequireEntrypoint: boolean,
  directoryFact: DirectoryFacts,
): boolean {
  return (
    hasImplementation &&
    shouldRequireEntrypoint &&
    directoryFact.entrypointPaths.length === 0
  );
}

function isOrphanPublicEntrypoint(
  project: ArchitectureProject,
  directoryFact: DirectoryFacts,
  implementationFileCount: number,
): boolean {
  return (
    directoryFact.entrypointPaths.length > 0 &&
    implementationFileCount === 0 &&
    directoryFact.childDirectoryPaths.length === 0 &&
    directoryFact.entrypointPaths.every((entrypointPath) =>
      isPureBarrelEntrypoint(project, entrypointPath),
    )
  );
}
