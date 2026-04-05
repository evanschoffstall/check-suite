import { join } from "node:path";

import type {
  ArchitectureAnalyzerConfig,
  BoundaryDirectory,
  CodeRoots,
  DirectoryFacts,
} from "@/quality/module-boundaries/foundation/index.ts";

import {
  getCodeStem,
  normalizePath,
} from "@/quality/module-boundaries/foundation/index.ts";
import {
  directoryContainsCode,
  isIgnoredDirectory,
  isIncludedCodeFile,
  safeReadDir,
  visitCodeDirectories,
} from "@/quality/module-boundaries/scan/index.ts";

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

/** Collects directory-level implementation facts for later structure analysis. */
export function collectDirectoryFacts(
  cwd: string,
  codeRoots: CodeRoots,
  config: Required<ArchitectureAnalyzerConfig>,
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
          .filter((entry) => entry.isFile() && isIncludedCodeFile(entry.name))
          .map((entry) =>
            normalizePath(`${relativeDirectoryPath}/${entry.name}`),
          )
          .sort((left, right) => left.localeCompare(right));
        const entrypointPaths = codeFilePaths.filter((filePath) =>
          config.entrypointNames.includes(
            getCodeStem(filePath.split("/").pop() ?? filePath),
          ),
        );
        const childDirectoryPaths = entries
          .filter(
            (entry) =>
              entry.isDirectory() &&
              !isIgnoredDirectory(entry.name, config) &&
              !config.testDirectoryNames.includes(entry.name) &&
              directoryContainsCode(
                join(absoluteDirectoryPath, entry.name),
                config,
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
            !config.testDirectoryNames.includes(entry.name) &&
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
