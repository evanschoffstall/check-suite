import type {
  ArchitectureProject,
  ArchitectureViolation,
  DirectoryFacts,
} from "@/quality/module-boundaries/foundation/index.ts";

import {
  getCodeStem,
  getLastPathSegment,
  isArchitectureEntrypoint,
} from "@/quality/module-boundaries/foundation/index.ts";

import { isCodeRootDirectory, isDirectChildOfCodeRoot } from "./helpers";

/** Flags directories that exceed the configured depth budget beneath a code root. */
export function buildDirectoryDepthViolations(
  project: ArchitectureProject,
): ArchitectureViolation[] {
  if (project.config.maxDirectoryDepth === Number.MAX_SAFE_INTEGER) {
    return [];
  }

  return project.directoryFacts.flatMap((directoryFact) =>
    shouldFlagDirectoryDepth(project, directoryFact)
      ? [
          {
            code: "directory-depth",
            message: `${directoryFact.path} is ${countDirectoryDepth(project, directoryFact.path)} levels below its code root; keep directory depth at or below ${project.config.maxDirectoryDepth}`,
          },
        ]
      : [],
  );
}

/** Flags direct children of a code root that are not intentionally allowed root files. */
export function buildRootFileOwnershipViolations(
  project: ArchitectureProject,
): ArchitectureViolation[] {
  return project.files.flatMap((filePath) => {
    if (!isDirectChildOfCodeRoot(project, filePath)) {
      return [];
    }

    const stem = getCodeStem(getLastPathSegment(filePath));
    if (
      isArchitectureEntrypoint(project.config, stem) ||
      project.config.allowedRootFileStems.includes(stem)
    ) {
      return [];
    }

    return [
      {
        code: "root-file-ownership",
        message: `${filePath} lives directly under a code root without being an allowed root file; move it into an owning folder or declare it as an intentional root surface`,
      },
    ];
  });
}

function countDirectoryDepth(
  project: ArchitectureProject,
  directoryPath: string,
): number {
  const baseline = getDepthBaseline(project, directoryPath);
  if (!baseline || directoryPath === baseline) {
    return 0;
  }
  return directoryPath.slice(baseline.length + 1).split("/").length;
}

function getDepthBaseline(
  project: ArchitectureProject,
  directoryPath: string,
): string {
  const policyPrefix = project.config.dependencyPolicies
    .flatMap((policy) => policy.pathPrefixes)
    .filter(
      (prefix) =>
        directoryPath === prefix || directoryPath.startsWith(`${prefix}/`),
    )
    .reduce(
      (longest, prefix) => (prefix.length > longest.length ? prefix : longest),
      "",
    );

  if (policyPrefix) {
    return policyPrefix;
  }

  return (
    project.codeRoots.directories.find(
      (candidate) =>
        directoryPath === candidate ||
        directoryPath.startsWith(`${candidate}/`),
    ) ?? ""
  );
}

function shouldFlagDirectoryDepth(
  project: ArchitectureProject,
  directoryFact: DirectoryFacts,
): boolean {
  if (isCodeRootDirectory(project, directoryFact.path)) {
    return false;
  }

  return (
    countDirectoryDepth(project, directoryFact.path) >
    project.config.maxDirectoryDepth
  );
}
