import { dirname } from "node:path";

import type { ArchitectureProject, ArchitectureViolation } from "./types.ts";

import { getCodeStem } from "./utils.ts";

/** Applies folder ownership and file-layout architecture rules. */
export function analyzeStructureRules(
  project: ArchitectureProject,
): ArchitectureViolation[] {
  const violations: ArchitectureViolation[] = [];
  const directoriesByParent = new Map<string, Set<string>>();
  const filesByParent = new Map<string, string[]>();

  for (const directoryPath of project.directories) {
    const parentPath = dirname(directoryPath).replace(/^\.$/u, "");
    const siblingDirectories =
      directoriesByParent.get(parentPath) ?? new Set<string>();
    siblingDirectories.add(directoryPath.split("/").pop() ?? directoryPath);
    directoriesByParent.set(parentPath, siblingDirectories);
  }

  for (const filePath of project.files) {
    const parentPath = dirname(filePath).replace(/^\.$/u, "");
    const siblingFiles = filesByParent.get(parentPath) ?? [];
    siblingFiles.push(filePath.split("/").pop() ?? filePath);
    filesByParent.set(parentPath, siblingFiles);
  }

  for (const boundary of project.boundaries) {
    if (boundary.entrypointPaths.length > 1) {
      violations.push({
        code: "multiple-entrypoints",
        message: `${boundary.path} exposes multiple public entrypoints (${boundary.entrypointPaths.join(", ")}); keep one intentional surface per boundary`,
      });
    }
  }

  for (const [parentPath, siblingDirectories] of directoriesByParent) {
    const siblingFiles = filesByParent.get(parentPath) ?? [];
    violations.push(
      ...buildSplitHomeViolations(parentPath, siblingDirectories, siblingFiles),
    );
    violations.push(
      ...buildFlattenedFeatureViolations(
        parentPath,
        siblingDirectories,
        siblingFiles,
        project.config.entrypointNames,
      ),
    );
    violations.push(
      ...buildMixedTypesViolations(
        parentPath,
        siblingDirectories,
        project.files,
        project.imports,
      ),
    );
  }

  return dedupeViolations(violations);
}

function buildFlattenedFeatureViolations(
  parentPath: string,
  siblingDirectories: Set<string>,
  siblingFiles: string[],
  entrypointNames: readonly string[],
): ArchitectureViolation[] {
  return [
    ...collectFlattenedFeatureGroups(
      siblingDirectories,
      siblingFiles,
      entrypointNames,
    ),
  ].map(([featureName, groupedFiles]) => ({
    code: "mixed-feature-layout",
    message: `${normalizeParentPath(parentPath)} mixes folder-owned features with flattened ${featureName} files (${groupedFiles.join(", ")}); move ${featureName} into ${featureName}/ and expose one public entrypoint`,
  }));
}

function buildMixedTypesViolations(
  parentPath: string,
  siblingDirectories: Set<string>,
  files: string[],
  imports: ArchitectureProject["imports"],
): ArchitectureViolation[] {
  if (!siblingDirectories.has("types")) return [];
  const localTypesOwners = collectExternallyConsumedTypeOwners(
    parentPath,
    siblingDirectories,
    files,
    imports,
  );
  if (localTypesOwners.length === 0) return [];

  return [
    {
      code: "mixed-types-home",
      message: `${normalizeParentPath(parentPath)} contains a central types/ directory while ${localTypesOwners.join(", ")} also define externally consumed feature-local types.ts files; choose one shared types home`,
    },
  ];
}

function buildSplitHomeViolations(
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

function collectExternallyConsumedTypeOwners(
  parentPath: string,
  siblingDirectories: Set<string>,
  files: string[],
  imports: ArchitectureProject["imports"],
): string[] {
  const knownFiles = new Set(files);
  const parentPrefix = parentPath.length === 0 ? "" : `${parentPath}/`;

  return [...siblingDirectories]
    .filter((directoryName) => directoryName !== "types")
    .map((directoryName) => ({
      directoryName,
      typesPath: `${parentPrefix}${directoryName}/types.ts`,
    }))
    .filter(({ typesPath }) => knownFiles.has(typesPath))
    .filter(({ directoryName, typesPath }) =>
      imports.some(
        (entry) =>
          entry.resolvedPath === typesPath &&
          !entry.sourcePath.startsWith(`${parentPrefix}${directoryName}/`),
      ),
    )
    .map(({ directoryName }) => `${directoryName}/types.ts`)
    .sort((left, right) => left.localeCompare(right));
}

function collectFlattenedFeatureGroups(
  siblingDirectories: Set<string>,
  siblingFiles: string[],
  entrypointNames: readonly string[],
): Map<string, string[]> {
  if (siblingDirectories.size === 0) return new Map();

  const fileEntries = siblingFiles.map((fileName) => ({
    fileName,
    stem: getCodeStem(fileName),
  }));
  const groups = new Map<string, string[]>();

  for (const { stem } of fileEntries) {
    if (siblingDirectories.has(stem) || entrypointNames.includes(stem))
      continue;
    const groupedFiles = fileEntries
      .filter(
        (entry) =>
          entry.stem === stem ||
          entry.stem.startsWith(`${stem}-`) ||
          entry.stem.startsWith(`${stem}_`),
      )
      .map((entry) => entry.fileName)
      .sort((left, right) => left.localeCompare(right));
    if (groupedFiles.length >= 2) groups.set(stem, groupedFiles);
  }

  return new Map(
    [...groups.entries()].sort(([left], [right]) => left.localeCompare(right)),
  );
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

function normalizeParentPath(parentPath: string): string {
  return parentPath.length === 0 ? "repo root" : parentPath;
}
