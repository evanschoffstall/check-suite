import safeRegex from "safe-regex";

const MAX_REGEX_PATTERN_LENGTH = 500;
const RegExpCtor: RegExpConstructor = RegExp;

export function countSafeMatches(
  input: string,
  pattern: string,
  flags = "gim",
): number {
  return Array.from(input.matchAll(createSafeRegExp(pattern, flags))).length;
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

function createSafeRegExp(pattern: string, flags: string): RegExp {
  if (!isSafeRegExpPattern(pattern)) {
    throw new Error(`unsafe regex pattern: ${pattern}`);
  }

  return new RegExpCtor(pattern, flags);
}
