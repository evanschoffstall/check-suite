import type {
  ArchitectureProject,
  ArchitectureViolation,
} from "@/quality/module-boundaries/foundation/index.ts";

import { createGlobMatcher } from "@/foundation/index.ts";
import {
  getCodeStem,
  normalizePath,
} from "@/quality/module-boundaries/foundation/index.ts";

import { normalizeParentPath } from "./ownership";

type FileNameCaseStyle =
  | "camelCase"
  | "kebab-case"
  | "PascalCase"
  | "singlecase"
  | "this_case";

const orderedFileNameCaseStyles: readonly FileNameCaseStyle[] = [
  "PascalCase",
  "camelCase",
  "kebab-case",
  "singlecase",
  "this_case",
];
const globMatcherCache = new Map<string, (value: string) => boolean>();

/**
 * Flags directories that mix multiple recognized file-name case styles among
 * sibling source files.
 */
export function buildMixedFileNameCaseViolations(
  parentPath: string,
  siblingFiles: string[],
  project: ArchitectureProject,
): ArchitectureViolation[] {
  if (!project.config.enforceConsistentFileNameCase) {
    return [];
  }

  const groupedFiles = collectGroupedCaseFiles(parentPath, siblingFiles, project);
  if (groupedFiles.size < 2) {
    return [];
  }

  const styleSummary = [...groupedFiles.keys()].join(", ");
  const fileSummary = [...groupedFiles.entries()]
    .map(([style, files]) => `${style}: ${files.join(", ")}`)
    .join("; ");

  return [
    {
      code: "mixed-file-name-case",
      message: `${normalizeParentPath(parentPath)} mixes ${styleSummary} file naming within one folder (${fileSummary}); either rename the mis-cased file or move that responsibility into the correct subfolder or owner location`,
    },
  ];
}

/** Classifies one code-file stem into the rule's recognized case-style buckets. */
function classifyFileNameCase(stem: string): FileNameCaseStyle | null {
  if (isDelimitedLowerAlphaNumeric(stem, "-")) {
    return "kebab-case";
  }

  if (isDelimitedLowerAlphaNumeric(stem, "_")) {
    return "this_case";
  }

  if (matchesLeadingAlphaNumericStyle(stem, "upper", false)) {
    return "PascalCase";
  }

  if (matchesLeadingAlphaNumericStyle(stem, "lower", true)) {
    return "camelCase";
  }

  if (isLowerAlphaNumeric(stem)) {
    return "singlecase";
  }

  return null;
}

/** Collects sibling files into recognized case-style groups after ignores are applied. */
function collectGroupedCaseFiles(
  parentPath: string,
  siblingFiles: string[],
  project: ArchitectureProject,
): Map<FileNameCaseStyle, string[]> {
  const filesByStyle = new Map<FileNameCaseStyle, string[]>();

  for (const fileName of siblingFiles.slice().sort((left, right) => left.localeCompare(right))) {
    const filePath = parentPath.length === 0 ? fileName : `${parentPath}/${fileName}`;
    if (shouldIgnoreFileNameCase(fileName, filePath, project)) {
      continue;
    }

    const style = classifyFileNameCase(getCodeStem(fileName));
    if (style === null) {
      continue;
    }

    const files = filesByStyle.get(style) ?? [];
    files.push(fileName);
    filesByStyle.set(style, files);
  }

  return new Map(
    [...filesByStyle.entries()]
      .sort(([leftStyle], [rightStyle]) =>
        orderedFileNameCaseStyles.indexOf(leftStyle) -
        orderedFileNameCaseStyles.indexOf(rightStyle),
      )
      .map(([style, files]) => [style, files.sort((left, right) => left.localeCompare(right))]),
  );
}

/** Reuses compiled glob matchers for the new rule's ignore surfaces. */
function getGlobMatcher(pattern: string): (value: string) => boolean {
  const normalizedPattern = normalizePath(pattern)
    .replace(/^\.\//u, "")
    .replace(/\/+$/u, "");
  const cachedMatcher = globMatcherCache.get(normalizedPattern);
  if (cachedMatcher !== undefined) {
    return cachedMatcher;
  }

  const matcher = createGlobMatcher(normalizedPattern);
  globMatcherCache.set(normalizedPattern, matcher);
  return matcher;
}

function isAsciiAlphaNumeric(codePoint: number): boolean {
  return isAsciiDigit(codePoint) ||
    isAsciiLowercaseLetter(codePoint) ||
    isAsciiUppercaseLetter(codePoint);
}

function isAsciiDigit(codePoint: number): boolean {
  return codePoint >= 48 && codePoint <= 57;
}

function isAsciiLowercaseLetter(codePoint: number): boolean {
  return codePoint >= 97 && codePoint <= 122;
}

function isAsciiUppercaseLetter(codePoint: number): boolean {
  return codePoint >= 65 && codePoint <= 90;
}

/** Returns whether the value is delimited by one separator and each segment is lowercase alphanumeric. */
function isDelimitedLowerAlphaNumeric(
  value: string,
  delimiter: "-" | "_",
): boolean {
  const segments = value.split(delimiter);
  return segments.length > 1 && segments.every((segment) => isLowerAlphaNumeric(segment));
}

/** Returns whether the value consists of lowercase letters and digits only. */
function isLowerAlphaNumeric(value: string): boolean {
  if (value.length === 0) {
    return false;
  }

  for (let index = 0; index < value.length; index += 1) {
    const codePoint = value.charCodeAt(index);
    const isDigit = codePoint >= 48 && codePoint <= 57;
    const isLowercaseLetter = codePoint >= 97 && codePoint <= 122;
    if (!isDigit && !isLowercaseLetter) {
      return false;
    }
  }

  return true;
}

/** Returns whether the stem starts with the requested case and otherwise stays alphanumeric. */
function matchesLeadingAlphaNumericStyle(
  value: string,
  firstCharacterCase: "lower" | "upper",
  requireUppercaseLater: boolean,
): boolean {
  if (value.length === 0) {
    return false;
  }

  const firstCodePoint = value.charCodeAt(0);
  const firstCharacterMatches = firstCharacterCase === "lower"
    ? isAsciiLowercaseLetter(firstCodePoint)
    : isAsciiUppercaseLetter(firstCodePoint);
  if (!firstCharacterMatches) {
    return false;
  }

  let containsUppercaseLetter = !requireUppercaseLater;
  for (let index = 1; index < value.length; index += 1) {
    const codePoint = value.charCodeAt(index);
    if (!isAsciiAlphaNumeric(codePoint)) {
      return false;
    }

    containsUppercaseLetter ||= isAsciiUppercaseLetter(codePoint);
  }

  return containsUppercaseLetter;
}

/** Returns whether this sibling should be excluded from mixed file-name case checks. */
function shouldIgnoreFileNameCase(
  fileName: string,
  filePath: string,
  project: ArchitectureProject,
): boolean {
  const normalizedFilePath = normalizePath(filePath)
    .replace(/^\.\//u, "")
    .replace(/\/+$/u, "");
  const stem = getCodeStem(fileName);

  return project.config.fileNameCaseIgnorePathGlobs.some((pattern) =>
    getGlobMatcher(pattern)(normalizedFilePath),
  ) ||
    project.config.fileNameCaseIgnoreFileGlobs.some((pattern) => {
      const matchesPattern = getGlobMatcher(pattern);
      return matchesPattern(fileName) || matchesPattern(stem);
    });
}