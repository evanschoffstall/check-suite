import { join } from "node:path";

import type {
  ArchitectureAnalyzerConfig,
  BoundaryDirectory,
  CodeRoots,
} from "./types.ts";

import { TEST_DIRECTORY_NAMES } from "./constants.ts";
import {
  directoryContainsCode,
  isIgnoredDirectory,
  isIncludedCodeFile,
  safeReadDir,
  visitCodeDirectories,
} from "./scan.ts";
import { getCodeStem, normalizePath } from "./utils.ts";

/** Collects all non-test code files under the discovered roots. */
export function collectCodeFiles(
  cwd: string,
  codeRoots: CodeRoots,
  config: Required<ArchitectureAnalyzerConfig>,
): string[] {
  const files = new Set<string>(codeRoots.files);
  for (const rootDirectory of codeRoots.directories) {
    visitCodeDirectories(
      cwd,
      rootDirectory,
      config,
      (relativeDirectoryPath) => {
        for (const entry of safeReadDir(join(cwd, relativeDirectoryPath))) {
          if (entry.isFile() && isIncludedCodeFile(entry.name)) {
            files.add(normalizePath(`${relativeDirectoryPath}/${entry.name}`));
          }
        }
      },
    );
  }
  return [...files].sort();
}

/** Collects all repository directories that contain code below the discovered roots. */
export function collectDirectories(
  cwd: string,
  codeRoots: CodeRoots,
  config: Required<ArchitectureAnalyzerConfig>,
): string[] {
  const directories = new Set<string>();
  for (const rootDirectory of codeRoots.directories) {
    visitCodeDirectories(
      cwd,
      rootDirectory,
      config,
      (relativeDirectoryPath) => {
        directories.add(relativeDirectoryPath);
      },
    );
  }
  return [...directories].sort();
}

/** Discovers directories that expose a stable public entrypoint. */
export function discoverBoundaryDirectories(
  cwd: string,
  codeRoots: CodeRoots,
  config: Required<ArchitectureAnalyzerConfig>,
): BoundaryDirectory[] {
  const boundaries: BoundaryDirectory[] = [];
  for (const rootDirectory of codeRoots.directories) {
    visitCodeDirectories(
      cwd,
      rootDirectory,
      config,
      (relativeDirectoryPath) => {
        const absoluteDirectoryPath = join(cwd, relativeDirectoryPath);
        const entries = safeReadDir(absoluteDirectoryPath);
        const codeFiles = entries.filter(
          (entry) => entry.isFile() && isIncludedCodeFile(entry.name),
        );
        const entrypointPaths = codeFiles
          .filter((entry) =>
            config.entrypointNames.includes(getCodeStem(entry.name)),
          )
          .map((entry) =>
            normalizePath(`${relativeDirectoryPath}/${entry.name}`),
          );
        const hasChildImplementation = entries.some(
          (entry) =>
            entry.isDirectory() &&
            !isIgnoredDirectory(entry.name, config) &&
            !TEST_DIRECTORY_NAMES.has(entry.name) &&
            directoryContainsCode(
              join(absoluteDirectoryPath, entry.name),
              config,
            ),
        );
        const hasLocalImplementation = codeFiles.some(
          (entry) => !config.entrypointNames.includes(getCodeStem(entry.name)),
        );

        if (
          entrypointPaths.length > 0 &&
          (hasChildImplementation || hasLocalImplementation)
        ) {
          boundaries.push({ entrypointPaths, path: relativeDirectoryPath });
        }
      },
    );
  }
  return boundaries.sort((left, right) => left.path.localeCompare(right.path));
}
