import { join } from "node:path";

import type { ArchitectureAnalyzerConfig } from "@/steps/architecture/foundation/index.ts";

import { safeReadDir } from "./io";
import { isIncludedCodeFile, shouldSkipDirectory } from "./rules";

export function directoryContainsCode(
  directoryPath: string,
  config: Required<ArchitectureAnalyzerConfig>,
): boolean {
  for (const entry of safeReadDir(directoryPath)) {
    if (entry.isDirectory()) {
      if (shouldSkipDirectory(entry.name, config)) {
        continue;
      }
      if (directoryContainsCode(join(directoryPath, entry.name), config)) {
        return true;
      }
      continue;
    }

    if (entry.isFile() && isIncludedCodeFile(entry.name)) return true;
  }

  return false;
}

export function visitCodeDirectories(
  cwd: string,
  rootDirectory: string,
  config: Required<ArchitectureAnalyzerConfig>,
  visitor: (relativeDirectoryPath: string) => void,
): void {
  const queue = [rootDirectory];

  while (queue.length > 0) {
    const relativeDirectoryPath = queue.shift();
    if (!relativeDirectoryPath) continue;
    visitor(relativeDirectoryPath);

    for (const entry of safeReadDir(join(cwd, relativeDirectoryPath))) {
      if (!entry.isDirectory() || shouldSkipDirectory(entry.name, config)) {
        continue;
      }

      const childRelativePath = `${relativeDirectoryPath}/${entry.name}`;
      if (!directoryContainsCode(join(cwd, childRelativePath), config)) {
        continue;
      }
      queue.push(childRelativePath);
    }
  }
}
