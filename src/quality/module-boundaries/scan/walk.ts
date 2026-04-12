import { join } from "node:path";

import type { NormalizedArchitectureAnalyzerConfig } from "@/quality/module-boundaries/foundation/index.ts";

import { safeReadDir } from "./io";
import { isIncludedCodeFile, shouldSkipDirectory } from "./rules";

export function directoryContainsCode(
  directoryPath: string,
  config: NormalizedArchitectureAnalyzerConfig,
  relativeDirectoryPath = "",
): boolean {
  for (const entry of safeReadDir(directoryPath)) {
    if (entry.isDirectory()) {
      const childRelativePath = relativeDirectoryPath
        ? `${relativeDirectoryPath}/${entry.name}`
        : entry.name;

      if (shouldSkipDirectory(childRelativePath, config)) {
        continue;
      }

      if (
        directoryContainsCode(
          join(directoryPath, entry.name),
          config,
          childRelativePath,
        )
      ) {
        return true;
      }

      continue;
    }

    if (
      entry.isFile() &&
      isIncludedCodeFile(
        relativeDirectoryPath ? `${relativeDirectoryPath}/${entry.name}` : entry.name,
        config,
      )
    ) return true;
  }

  return false;
}

export function visitCodeDirectories(
  cwd: string,
  rootDirectory: string,
  config: NormalizedArchitectureAnalyzerConfig,
  visitor: (relativeDirectoryPath: string) => void,
): void {
  const queue = [rootDirectory];

  while (queue.length > 0) {
    const relativeDirectoryPath = queue.shift();
    if (relativeDirectoryPath === undefined) continue;
    visitor(relativeDirectoryPath);

    for (const entry of safeReadDir(join(cwd, relativeDirectoryPath))) {
      const childRelativePath = relativeDirectoryPath
        ? `${relativeDirectoryPath}/${entry.name}`
        : entry.name;

      if (!entry.isDirectory() || shouldSkipDirectory(childRelativePath, config)) {
        continue;
      }

      if (!directoryContainsCode(join(cwd, childRelativePath), config, childRelativePath)) {
        continue;
      }

      queue.push(childRelativePath);
    }
  }
}
