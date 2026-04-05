import type {
  ArchitectureProject,
  ArchitectureViolation,
} from "@/quality/module-boundaries/foundation/index.ts";

import {
  getCodeStem,
  getLastPathSegment,
} from "@/quality/module-boundaries/foundation/index.ts";
import { inferDependencyPolicy } from "@/quality/module-boundaries/import/rule/index.ts";

import { isDirectChildOfCodeRoot } from "./helpers";

/** Flags uncovered or overlapping dependency-policy ownership at the code-root level. */
export function buildDependencyPolicyCoverageViolations(
  project: ArchitectureProject,
): ArchitectureViolation[] {
  if (!project.config.requireCompleteDependencyPolicyCoverage) {
    return [];
  }

  return [
    ...buildTopLevelDirectoryPolicyCoverageViolations(project),
    ...buildRootPublicSurfacePolicyCoverageViolations(project),
  ];
}

function buildCoverageViolationsForPath(
  ownedPath: string,
  matchingPolicies: string[],
): ArchitectureViolation[] {
  if (matchingPolicies.length === 1) {
    return [];
  }

  if (matchingPolicies.length === 0) {
    return [
      {
        code: "dependency-policy-coverage",
        message: `${ownedPath} is not covered by any declared dependency policy`,
      },
    ];
  }

  return [
    {
      code: "dependency-policy-overlap",
      message: `${ownedPath} is claimed by multiple dependency policies (${matchingPolicies.join(", ")}); keep one owner per architectural surface`,
    },
  ];
}

function buildRootPublicSurfacePolicyCoverageViolations(
  project: ArchitectureProject,
): ArchitectureViolation[] {
  const explicitPublicSurfaces = new Set(
    project.config.explicitPublicSurfacePaths,
  );

  return project.files.flatMap((filePath) => {
    if (!isDirectChildOfCodeRoot(project, filePath)) {
      return [];
    }

    const stem = getCodeStem(getLastPathSegment(filePath));
    if (
      !project.config.allowedRootFileStems.includes(stem) &&
      !explicitPublicSurfaces.has(filePath)
    ) {
      return [];
    }

    const matchingPolicies = collectMatchingPolicies(project, filePath);
    return buildCoverageViolationsForPath(filePath, matchingPolicies);
  });
}

function buildTopLevelDirectoryPolicyCoverageViolations(
  project: ArchitectureProject,
): ArchitectureViolation[] {
  return project.directoryFacts.flatMap((directoryFact) => {
    if (!isDirectChildOfCodeRoot(project, directoryFact.path)) {
      return [];
    }

    const matchingPolicies = collectMatchingPolicies(
      project,
      directoryFact.path,
    );
    return buildCoverageViolationsForPath(directoryFact.path, matchingPolicies);
  });
}

function collectMatchingPolicies(
  project: ArchitectureProject,
  path: string,
): string[] {
  return project.config.dependencyPolicies
    .filter((policy) => inferDependencyPolicy(path, [policy]) !== null)
    .map((policy) => policy.name)
    .sort((left, right) => left.localeCompare(right));
}
