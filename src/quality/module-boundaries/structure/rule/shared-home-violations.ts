import type {
  ArchitectureProject,
  ArchitectureViolation,
} from "@/quality/module-boundaries/foundation/index.ts";

import { normalizeParentPath } from "./ownership";

/** Flags repositories that split one shared-home concept across local and central homes. */
export function buildMixedTypesViolations(
  sharedHomeNames: string[],
  parentPath: string,
  siblingDirectories: Set<string>,
  files: string[],
  imports: ArchitectureProject["imports"],
): ArchitectureViolation[] {
  return sharedHomeNames.flatMap((sharedHomeName) => {
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
