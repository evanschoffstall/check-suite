import type {
  ArchitectureProject,
  ArchitectureViolation,
} from "@/quality/module-boundaries/foundation/index.ts";

import { createGlobMatcher } from "@/foundation/index.ts";
import {
  getCodeStem,
  getLastPathSegment,
} from "@/quality/module-boundaries/foundation/index.ts";

import {
  isDirectChildOfCodeRoot,
  matchesResponsibilityName,
  normalizeParentPath,
} from "./ownership";

/** Detects flattened file groups that should live under a feature directory. */
export function buildFlattenedFeatureViolations(
  parentPath: string,
  siblingDirectories: Set<string>,
  siblingFiles: string[],
  entrypointNames: readonly string[],
): ArchitectureViolation[] {
  return [
    ...collectDuplicatePrefixGroups(
      siblingDirectories,
      siblingFiles,
      entrypointNames,
    ),
  ].map(([featureName, groupedFiles]) => ({
    code: "mixed-feature-layout",
    message: `${normalizeParentPath(parentPath)} uses a correct ${featureName}* naming convention across ${groupedFiles.join(", ")}, but flattened duplicate prefixes are not allowed; move this responsibility into ${featureName}/ and expose one public entrypoint`,
  }));
}

/** Flags broad shared names that indicate a junk-drawer directory or file. */
export function buildJunkDrawerViolations(
  project: ArchitectureProject,
): ArchitectureViolation[] {
  const violations: ArchitectureViolation[] = [];
  const junkDrawerFileNameMatchers =
    project.config.junkDrawerFileNamePatterns.map((pattern) =>
      createGlobMatcher(pattern),
    );

  for (const directoryFact of project.directoryFacts) {
    const directoryName = getLastPathSegment(directoryFact.path);

    if (
      isDirectChildOfCodeRoot(project, directoryFact.path) &&
      project.config.junkDrawerDirectoryNames.includes(directoryName)
    ) {
      violations.push({
        code: "junk-drawer-directory",
        message: `${directoryFact.path} uses a broad shared directory name with no ownership boundary; split it into responsibility-based folders`,
      });
    }
  }

  for (const filePath of project.files) {
    const fileName = filePath.split("/").pop() ?? filePath;
    const stem = getCodeStem(fileName);
    const matchesConfiguredPattern = junkDrawerFileNameMatchers.some(
      (matchesPattern) => matchesPattern(fileName) || matchesPattern(stem),
    );
    const matchesConfiguredStem =
      isDirectChildOfCodeRoot(project, filePath) &&
      project.config.junkDrawerFileStems.includes(stem);

    if (matchesConfiguredStem || matchesConfiguredPattern) {
      violations.push({
        code: "junk-drawer-file",
        message: `${filePath} uses a broad catch-all filename; rename it to the responsibility it actually owns or move the code to the correct owner`,
      });
    }
  }

  return violations;
}

/** Flags exact same-name file and folder pairs that coexist in one directory. */
export function buildSameNameFileDirectoryViolations(
  parentPath: string,
  siblingDirectories: Set<string>,
  siblingFiles: string[],
): ArchitectureViolation[] {
  return [...siblingDirectories]
    .flatMap((directoryName) => {
      const exactNameMatches = siblingFiles.filter(
        (fileName) => getCodeStem(fileName) === directoryName,
      );

      return exactNameMatches.map((fileName) => ({
        code: "same-name-file-folder",
        message: `${normalizeParentPath(parentPath)} contains ${fileName} beside ${directoryName}/ in the same directory; a file cannot share a folder name, so absorb ${fileName} into ${directoryName}/`,
      }));
    })
    .sort((left, right) => left.message.localeCompare(right.message));
}

/** Flags responsibilities that are split between a folder home and flat files. */
export function buildScatteredFeatureHomeViolations(
  project: ArchitectureProject,
): ArchitectureViolation[] {
  return project.directoryFacts
    .filter(
      (fact) =>
        isDirectChildOfCodeRoot(project, fact.path) &&
        (fact.entrypointPaths.length > 0 ||
          fact.childDirectoryPaths.length > 0 ||
          fact.codeFilePaths.filter(
            (filePath) => !fact.entrypointPaths.includes(filePath),
          ).length > 1),
    )
    .flatMap((fact) => {
      const directoryName = getLastPathSegment(fact.path);

      if (
        project.config.sharedHomeNames.includes(directoryName) ||
        project.config.junkDrawerDirectoryNames.includes(directoryName)
      ) {
        return [];
      }

      const scatteredFiles = project.files.filter(
        (filePath) =>
          isDirectChildOfCodeRoot(project, filePath) &&
          !filePath.startsWith(`${fact.path}/`) &&
          matchesResponsibilityName(
            getCodeStem(filePath.split("/").pop() ?? filePath),
            directoryName,
          ),
      );

      return scatteredFiles.length === 0
        ? []
        : [
            {
              code: "scattered-feature-home",
              message: `${fact.path} owns ${directoryName}, but ${scatteredFiles.join(", ")} leave the same responsibility in parallel homes`,
            },
          ];
    });
}

/** Flags directories that coexist with flattened files for the same responsibility. */
export function buildSplitHomeViolations(
  parentPath: string,
  siblingDirectories: Set<string>,
  siblingFiles: string[],
): ArchitectureViolation[] {
  return [...siblingDirectories]
    .map((directoryName) => {
      const prefixedFiles = siblingFiles.filter(
        (fileName) =>
          getCodeStem(fileName).startsWith(`${directoryName}-`) ||
          getCodeStem(fileName).startsWith(`${directoryName}_`) ||
          getCodeStem(fileName) === directoryName,
      );
      return prefixedFiles.length === 0
        ? null
        : {
            code: "split-feature-home",
            message: `${normalizeParentPath(parentPath)} contains ${directoryName}/ alongside ${prefixedFiles.join(", ")}; keep one responsibility in one folder home`,
          };
    })
    .filter(
      (violation): violation is ArchitectureViolation => violation !== null,
    );
}

/** Collects duplicate flat filename prefixes, including nested prefixes such as normalize-result*. */
function collectDuplicatePrefixGroups(
  siblingDirectories: Set<string>,
  siblingFiles: string[],
  entrypointNames: readonly string[],
): Map<string, string[]> {
  const fileEntries = siblingFiles.map((fileName) => ({
    fileName,
    prefixCandidates: getPrefixCandidates(getCodeStem(fileName)),
    stem: getCodeStem(fileName),
  }));
  const groups = new Map<string, string[]>();
  const candidatePrefixes = new Set<string>();

  for (const { prefixCandidates } of fileEntries) {
    for (const prefixCandidate of prefixCandidates) {
      if (entrypointNames.includes(prefixCandidate)) {
        continue;
      }

      candidatePrefixes.add(prefixCandidate);
    }
  }

  for (const prefixCandidate of candidatePrefixes) {
    if (siblingDirectories.has(prefixCandidate)) {
      continue;
    }

    const groupedFiles = fileEntries
      .filter(
        (entry) =>
          entry.stem === prefixCandidate ||
          entry.stem.startsWith(`${prefixCandidate}-`) ||
          entry.stem.startsWith(`${prefixCandidate}_`),
      )
      .map((entry) => entry.fileName)
      .sort((left, right) => left.localeCompare(right));

    if (groupedFiles.length >= 2) {
      groups.set(prefixCandidate, groupedFiles);
    }
  }

  return new Map(
    [...groups.entries()].sort(([left], [right]) => left.localeCompare(right)),
  );
}

/** Builds every delimiter-aware prefix candidate for a file stem using kebab-case normalization. */
function getPrefixCandidates(stem: string): string[] {
  const segments = stem.split(/[-_]/u).filter((segment) => segment.length > 0);

  return segments.map((_, index) => segments.slice(0, index + 1).join("-"));
}
