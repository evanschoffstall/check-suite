import { escapeRegExpLiteral, testSafeRegExp } from "@/regex.ts";

/**
 * Creates a safe glob matcher that supports `*` and `**` and normalizes path
 * separators before evaluating the pattern.
 */
export function createGlobMatcher(pattern: string): (value: string) => boolean {
  const escapedPattern = pattern
    .replaceAll("\\", "\\\\")
    .replaceAll(".", escapeRegExpLiteral("."))
    .replaceAll("+", escapeRegExpLiteral("+"))
    .replaceAll("?", escapeRegExpLiteral("?"))
    .replaceAll("^", escapeRegExpLiteral("^"))
    .replaceAll("$", escapeRegExpLiteral("$"))
    .replaceAll("{", escapeRegExpLiteral("{"))
    .replaceAll("}", escapeRegExpLiteral("}"))
    .replaceAll("(", escapeRegExpLiteral("("))
    .replaceAll(")", escapeRegExpLiteral(")"))
    .replaceAll("|", escapeRegExpLiteral("|"))
    .replaceAll("[", escapeRegExpLiteral("["))
    .replaceAll("]", escapeRegExpLiteral("]"))
    .replaceAll("**", "\\u0000")
    .replaceAll("*", "[^/]*")
    .replaceAll("\\u0000", ".*");
  const safePattern = `^${escapedPattern}$`;

  return (value: string): boolean =>
    testSafeRegExp(value.replaceAll("\\", "/"), safePattern, "u");
}