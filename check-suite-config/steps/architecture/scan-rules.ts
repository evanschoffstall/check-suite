import type { ArchitectureAnalyzerConfig } from "./types.ts";

import {
  CODE_FILE_REGEX,
  DECLARATION_FILE_REGEX,
  TEST_DIRECTORY_NAMES,
  TEST_FILE_REGEX,
} from "./constants.ts";

export function isIgnoredDirectory(
  directoryName: string,
  config: Required<ArchitectureAnalyzerConfig>,
): boolean {
  return (
    config.ignoredDirectoryNames.includes(directoryName) ||
    config.vendorManagedDirectoryNames.includes(directoryName)
  );
}

export function isIncludedCodeFile(fileName: string): boolean {
  return (
    CODE_FILE_REGEX.test(fileName) &&
    !DECLARATION_FILE_REGEX.test(fileName) &&
    !TEST_FILE_REGEX.test(fileName)
  );
}

export function shouldSkipDirectory(
  directoryName: string,
  config: Required<ArchitectureAnalyzerConfig>,
): boolean {
  return (
    isIgnoredDirectory(directoryName, config) ||
    TEST_DIRECTORY_NAMES.has(directoryName)
  );
}
