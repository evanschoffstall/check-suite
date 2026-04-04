import type { Dirent } from "node:fs";

import { readdirSync } from "node:fs";
import { join } from "node:path";

import type { ArchitectureAnalyzerConfig } from "./types.ts";

import {
  CODE_FILE_REGEX,
  DECLARATION_FILE_REGEX,
  TEST_DIRECTORY_NAMES,
  TEST_FILE_REGEX,
} from "./constants.ts";

function directoryContainsCode(
  directoryPath: string,
  config: Required<ArchitectureAnalyzerConfig>,
): boolean {
  for (const entry of safeReadDir(directoryPath)) {
    if (entry.isDirectory()) {
      if (
        isIgnoredDirectory(entry.name, config) ||
        TEST_DIRECTORY_NAMES.has(entry.name)
      )
        continue;
      if (directoryContainsCode(join(directoryPath, entry.name), config))
        return true;
      continue;
    }

    if (entry.isFile() && isIncludedCodeFile(entry.name)) return true;
  }

  return false;
}

function isIgnoredDirectory(
  directoryName: string,
  config: Required<ArchitectureAnalyzerConfig>,
): boolean {
  return (
    config.ignoredDirectoryNames.includes(directoryName) ||
    config.vendorManagedDirectoryNames.includes(directoryName)
  );
}

function isIncludedCodeFile(fileName: string): boolean {
  return (
    CODE_FILE_REGEX.test(fileName) &&
    !DECLARATION_FILE_REGEX.test(fileName) &&
    !TEST_FILE_REGEX.test(fileName)
  );
}

function safeReadDir(directoryPath: string): Dirent<string>[] {
  try {
    return readdirSync(directoryPath, {
      encoding: "utf8",
      withFileTypes: true,
    });
  } catch {
    return [];
  }
}

function visitCodeDirectories(
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
      if (!entry.isDirectory()) continue;
      if (
        isIgnoredDirectory(entry.name, config) ||
        TEST_DIRECTORY_NAMES.has(entry.name)
      )
        continue;
      const childRelativePath = `${relativeDirectoryPath}/${entry.name}`;
      if (!directoryContainsCode(join(cwd, childRelativePath), config))
        continue;
      queue.push(childRelativePath);
    }
  }
}

export {
  directoryContainsCode,
  isIgnoredDirectory,
  isIncludedCodeFile,
  safeReadDir,
  visitCodeDirectories,
};
