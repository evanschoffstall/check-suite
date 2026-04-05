import safeRegex from "safe-regex";

const MAX_REGEX_PATTERN_LENGTH = 500;
const RegExpCtor: RegExpConstructor = RegExp;
const REGEXP_SPECIAL_CHARACTERS = /[|\\{}()[\]^$+*?.-]/g;

export function countSafeMatches(
  input: string,
  pattern: string,
  flags = "gim",
): number {
  return Array.from(input.matchAll(createSafeRegExp(pattern, flags))).length;
}

/** Creates a RegExp only after validating that the provided pattern is safe. */
export function createSafeRegExp(pattern: string, flags = ""): RegExp {
  if (!isSafeRegExpPattern(pattern)) {
    throw new Error(`unsafe regex pattern: ${pattern}`);
  }

  return new RegExpCtor(pattern, flags);
}

/** Escapes a literal string so it is safe to embed inside a regular expression. */
export function escapeRegExpLiteral(value: string): string {
  return value.replace(REGEXP_SPECIAL_CHARACTERS, "\\$&");
}

export function execSafeRegExp(
  input: string,
  pattern: string,
  flags = "i",
): null | RegExpExecArray {
  return createSafeRegExp(pattern, flags).exec(input);
}

export function isSafeRegExpPattern(pattern: string): boolean {
  if (pattern.length === 0 || pattern.length > MAX_REGEX_PATTERN_LENGTH) {
    return false;
  }

  try {
    return safeRegex(new RegExpCtor(pattern));
  } catch {
    return false;
  }
}

export function testSafeRegExp(
  input: string,
  pattern: string,
  flags = "i",
): boolean {
  return createSafeRegExp(pattern, flags).test(input);
}
