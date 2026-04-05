import { dirname, relative, resolve } from "node:path";

import type { AliasMapping } from "@/quality/module-boundaries/foundation/index.ts";

import {
  CODE_EXTENSIONS,
  normalizePath,
  trimLeadingDotSlash,
} from "@/quality/module-boundaries/foundation/index.ts";

/** Resolves one import/export specifier to a known source file when possible. */
export function resolveModulePath(
  cwd: string,
  sourcePath: string,
  specifier: string,
  knownFiles: ReadonlySet<string>,
  aliasMappings: AliasMapping[],
): null | string {
  if (specifier.startsWith(".")) {
    return resolveCandidatePath(
      normalizePath(
        relative(cwd, resolve(cwd, dirname(sourcePath), specifier)),
      ),
      knownFiles,
    );
  }

  for (const aliasMapping of aliasMappings) {
    if (!specifier.startsWith(aliasMapping.prefix)) {
      continue;
    }

    const remainder = specifier.slice(aliasMapping.prefix.length);
    for (const targetRoot of aliasMapping.targetRoots) {
      const resolvedPath = resolveCandidatePath(
        `${targetRoot}/${remainder}`,
        knownFiles,
      );
      if (resolvedPath) {
        return resolvedPath;
      }
    }
  }

  return null;
}

function resolveCandidatePath(
  targetPath: string,
  knownFiles: ReadonlySet<string>,
): null | string {
  const normalizedTargetPath = trimLeadingDotSlash(normalizePath(targetPath));
  const candidates = [
    normalizedTargetPath,
    ...CODE_EXTENSIONS.map(
      (extension) => `${normalizedTargetPath}${extension}`,
    ),
    ...CODE_EXTENSIONS.map(
      (extension) => `${normalizedTargetPath}/index${extension}`,
    ),
    ...CODE_EXTENSIONS.map(
      (extension) => `${normalizedTargetPath}/main${extension}`,
    ),
    ...CODE_EXTENSIONS.map(
      (extension) => `${normalizedTargetPath}/mod${extension}`,
    ),
  ];

  return candidates.find((candidate) => knownFiles.has(candidate)) ?? null;
}
