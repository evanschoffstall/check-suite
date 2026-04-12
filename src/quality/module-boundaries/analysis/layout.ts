import { join } from "node:path";

import type {
  BoundaryDirectory,
  CodeRoots,
  DirectoryFacts,
  NormalizedArchitectureAnalyzerConfig,
} from "@/quality/module-boundaries/foundation/index.ts";

import {
  getCodeStem,
  isArchitectureEntrypoint,
  normalizePath,
} from "@/quality/module-boundaries/foundation/index.ts";
import {
  directoryContainsCode,
  isIgnoredDirectory,
  isIncludedCodeFile,
  isTestDirectory,
  safeReadDir,
  visitCodeDirectories,
} from "@/quality/module-boundaries/scan/index.ts";

/** Collects all non-test code files under the discovered roots. */
export function collectCodeFiles(
  cwd: string,
  codeRoots: CodeRoots,
  config: NormalizedArchitectureAnalyzerConfig,
): string[] {
  const files = new Set<string>(codeRoots.files);
  for (const rootDirectory of codeRoots.directories) {
    visitCodeDirectories(
      cwd,
      rootDirectory,
      config,
      (relativeDirectoryPath) => {
        for (const entry of safeReadDir(join(cwd, relativeDirectoryPath))) {
          if (entry.isFile() && isIncludedCodeFile(entry.name, config)) {
            files.add(normalizePath(`${relativeDirectoryPath}/${entry.name}`));
          }
        }
      },
    );
  }
  return [...files].sort();
}

/** Collects directory-level implementation facts for later structure analysis. */
export function collectDirectoryFacts(
  cwd: string,
  codeRoots: CodeRoots,
  config: NormalizedArchitectureAnalyzerConfig,
): DirectoryFacts[] {
  const directoryFacts: DirectoryFacts[] = [];

  for (const rootDirectory of codeRoots.directories) {
    visitCodeDirectories(
      cwd,
      rootDirectory,
      config,
      (relativeDirectoryPath) => {
        const absoluteDirectoryPath = join(cwd, relativeDirectoryPath);
        const entries = safeReadDir(absoluteDirectoryPath);
        const codeFilePaths = entries
          .filter((entry) => entry.isFile() && isIncludedCodeFile(entry.name, config))
          .map((entry) =>
            normalizePath(`${relativeDirectoryPath}/${entry.name}`),
          )
          .sort((left, right) => left.localeCompare(right));
        const entrypointPaths = codeFilePaths.filter((filePath) =>
          isArchitectureEntrypoint(
            config,
            getCodeStem(filePath.split("/").pop() ?? filePath),
          ),
        );
        const childDirectoryPaths = entries
          .filter(
            (entry) =>
              entry.isDirectory() &&
              !isIgnoredDirectory(
                normalizePath(`${relativeDirectoryPath}/${entry.name}`),
                config,
              ) &&
              !isTestDirectory(
                normalizePath(`${relativeDirectoryPath}/${entry.name}`),
                config,
              ) &&
              directoryContainsCode(
                join(absoluteDirectoryPath, entry.name),
                config,
                normalizePath(`${relativeDirectoryPath}/${entry.name}`),
              ),
          )
          .map((entry) =>
            normalizePath(`${relativeDirectoryPath}/${entry.name}`),
          )
          .sort((left, right) => left.localeCompare(right));

        directoryFacts.push({
          childDirectoryPaths,
          codeFilePaths,
          entrypointPaths,
          path: relativeDirectoryPath,
        });
      },
    );
  }

  return directoryFacts.sort((left, right) =>
    left.path.localeCompare(right.path),
  );
}

/** Discovers directories that expose a stable public entrypoint. */
export function discoverBoundaryDirectories(
  cwd: string,
  codeRoots: CodeRoots,
  config: NormalizedArchitectureAnalyzerConfig,
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
          (entry) => entry.isFile() && isIncludedCodeFile(entry.name, config),
        );
        const entrypointPaths = codeFiles
          .filter((entry) => isArchitectureEntrypoint(config, getCodeStem(entry.name)))
          .map((entry) =>
            normalizePath(`${relativeDirectoryPath}/${entry.name}`),
          );
        const hasChildImplementation = entries.some(
          (entry) =>
            entry.isDirectory() &&
            !isIgnoredDirectory(
              normalizePath(`${relativeDirectoryPath}/${entry.name}`),
              config,
            ) &&
            !isTestDirectory(
              normalizePath(`${relativeDirectoryPath}/${entry.name}`),
              config,
            ) &&
            directoryContainsCode(
              join(absoluteDirectoryPath, entry.name),
              config,
              normalizePath(`${relativeDirectoryPath}/${entry.name}`),
            ),
        );
        const hasLocalImplementation = codeFiles.some(
          (entry) => !isArchitectureEntrypoint(config, getCodeStem(entry.name)),
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
