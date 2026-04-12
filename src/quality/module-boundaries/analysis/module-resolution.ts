import { dirname, relative, resolve } from "node:path";

import type {
  AliasMapping,
  NormalizedArchitectureAnalyzerConfig,
} from "@/quality/module-boundaries/foundation/index.ts";

import {
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
  config: Pick<NormalizedArchitectureAnalyzerConfig, "codeTargets">,
): null | string {
  if (specifier.startsWith(".")) {
    return resolveCandidatePath(
      normalizePath(
        relative(cwd, resolve(cwd, dirname(sourcePath), specifier)),
      ),
      knownFiles,
      config,
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
        config,
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
  config: Pick<NormalizedArchitectureAnalyzerConfig, "codeTargets">,
): null | string {
  const normalizedTargetPath = trimLeadingDotSlash(normalizePath(targetPath));
  const resolutionExtensions = config.codeTargets.resolutionExtensions ?? [];
  const resolutionEntrypointNames = config.codeTargets.resolutionEntrypointNames ?? [];
  const candidates = [
    normalizedTargetPath,
    ...resolutionExtensions.map(
      (extension) => `${normalizedTargetPath}${extension}`,
    ),
    ...resolutionEntrypointNames.flatMap((entryName) =>
      resolutionExtensions.map(
        (extension) => `${normalizedTargetPath}/${entryName}${extension}`,
      ),
    ),
  ];

  return candidates.find((candidate) => knownFiles.has(candidate)) ?? null;
}
