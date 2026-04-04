import { dirname } from "node:path";

import type {
  ArchitectureProject,
  ArchitectureViolation,
  DirectoryFacts,
} from "./types.ts";

import { getCodeStem, getLastPathSegment } from "./utils.ts";

/** Applies folder ownership and file-layout architecture rules. */
export function analyzeStructureRules(
  project: ArchitectureProject,
): ArchitectureViolation[] {
  const violations: ArchitectureViolation[] = [];
  const directoriesByParent = new Map<string, Set<string>>();
  const filesByParent = new Map<string, string[]>();
  const directoryFactsByPath = new Map(
    project.directoryFacts.map((fact) => [fact.path, fact]),
  );

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

  for (const directoryFact of project.directoryFacts) {
    violations.push(...buildDirectoryFactViolations(project, directoryFact));
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
    violations.push(
      ...buildPeerBoundaryConsistencyViolations(
        parentPath,
        siblingDirectories,
        directoryFactsByPath,
      ),
    );
  }

  violations.push(...buildScatteredFeatureHomeViolations(project));
  violations.push(...buildJunkDrawerViolations(project));
  violations.push(...buildBroadBarrelViolations(project));

  return dedupeViolations(violations);
}

function buildBroadBarrelViolations(
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

function buildDirectoryFactViolations(
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
    hasImplementation &&
    shouldRequireEntrypoint &&
    directoryFact.entrypointPaths.length === 0
  ) {
    violations.push({
      code: "missing-public-entrypoint",
      message: `${directoryFact.path} owns implementation files but has no ${project.config.entrypointNames[0]}.ts public entrypoint`,
    });
  }

  if (
    directoryFact.entrypointPaths.length > 0 &&
    implementationFiles.length === 0 &&
    directoryFact.childDirectoryPaths.length === 0 &&
    directoryFact.entrypointPaths.every((entrypointPath) =>
      isPureBarrelEntrypoint(project, entrypointPath),
    )
  ) {
    violations.push({
      code: "orphan-public-entrypoint",
      message: `${directoryFact.path} exposes a public entrypoint without any colocated implementation; remove the orphan barrel or move the owned code under this folder`,
    });
  }

  return violations;
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

function buildJunkDrawerViolations(
  project: ArchitectureProject,
): ArchitectureViolation[] {
  const violations: ArchitectureViolation[] = [];

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
    const stem = getCodeStem(filePath.split("/").pop() ?? filePath);

    if (
      isDirectChildOfCodeRoot(project, filePath) &&
      project.config.junkDrawerFileStems.includes(stem)
    ) {
      violations.push({
        code: "junk-drawer-file",
        message: `${filePath} uses a broad catch-all filename; rename it to the responsibility it actually owns or move the code to the correct owner`,
      });
    }
  }

  return violations;
}

function buildMixedTypesViolations(
  parentPath: string,
  siblingDirectories: Set<string>,
  files: string[],
  imports: ArchitectureProject["imports"],
): ArchitectureViolation[] {
  const knownSharedHomeNames = ["types", "contracts", "utils"];

  return knownSharedHomeNames.flatMap((sharedHomeName) => {
    if (!siblingDirectories.has(sharedHomeName)) return [];

    const localSharedOwners = collectExternallyConsumedSharedOwners(
      parentPath,
      siblingDirectories,
      files,
      imports,
      sharedHomeName,
    );

    if (localSharedOwners.length === 0) return [];

    return [
      {
        code: `mixed-${sharedHomeName}-home`,
        message: `${normalizeParentPath(parentPath)} contains a central ${sharedHomeName}/ directory while ${localSharedOwners.join(", ")} also define externally consumed feature-local ${sharedHomeName} modules; choose one shared ${sharedHomeName} home`,
      },
    ];
  });
}

function buildPeerBoundaryConsistencyViolations(
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

function buildScatteredFeatureHomeViolations(
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

function collectExternallyConsumedSharedOwners(
  parentPath: string,
  siblingDirectories: Set<string>,
  files: string[],
  imports: ArchitectureProject["imports"],
  sharedHomeName: string,
): string[] {
  const knownFiles = new Set(files);
  const parentPrefix = parentPath.length === 0 ? "" : `${parentPath}/`;

  return [...siblingDirectories]
    .filter((directoryName) => directoryName !== sharedHomeName)
    .map((directoryName) => ({
      directoryName,
      localSharedPaths: files.filter(
        (filePath) =>
          filePath.startsWith(
            `${parentPrefix}${directoryName}/${sharedHomeName}`,
          ) &&
          (filePath ===
            `${parentPrefix}${directoryName}/${sharedHomeName}.ts` ||
            filePath ===
              `${parentPrefix}${directoryName}/${sharedHomeName}.tsx` ||
            filePath.startsWith(
              `${parentPrefix}${directoryName}/${sharedHomeName}/`,
            )),
      ),
    }))
    .filter(({ localSharedPaths }) =>
      localSharedPaths.some((path) => knownFiles.has(path)),
    )
    .filter(({ directoryName, localSharedPaths }) =>
      localSharedPaths.some((sharedPath) =>
        imports.some(
          (entry) =>
            entry.resolvedPath === sharedPath &&
            !entry.sourcePath.startsWith(`${parentPrefix}${directoryName}/`),
        ),
      ),
    )
    .map(({ directoryName }) => `${directoryName}/${sharedHomeName}`)
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

function isCodeRootDirectory(
  project: ArchitectureProject,
  directoryPath: string,
): boolean {
  return project.codeRoots.directories.includes(directoryPath);
}

function isDirectChildOfCodeRoot(
  project: ArchitectureProject,
  path: string,
): boolean {
  const parentPath = dirname(path).replace(/^\.$/u, "");
  return project.codeRoots.directories.includes(parentPath);
}

function isPureBarrelEntrypoint(
  project: ArchitectureProject,
  entrypointPath: string,
): boolean {
  const sourceFact = project.sourceFacts.find(
    (fact) => fact.path === entrypointPath,
  );

  return Boolean(
    sourceFact &&
    sourceFact.exportModuleSpecifiers.length > 0 &&
    sourceFact.topLevelDeclarationCount === 0,
  );
}

function matchesResponsibilityName(
  stem: string,
  directoryName: string,
): boolean {
  return (
    stem === directoryName ||
    stem.startsWith(`${directoryName}-`) ||
    stem.startsWith(`${directoryName}_`)
  );
}

function normalizeParentPath(parentPath: string): string {
  return parentPath.length === 0 ? "repo root" : parentPath;
}
