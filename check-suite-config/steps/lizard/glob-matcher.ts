import { normalizePath } from "./normalize-path.ts";

export function createGlobMatcher(pattern: string): (value: string) => boolean {
  const escapedPattern = pattern
    .replaceAll("\\", "\\\\")
    .replaceAll(".", "\\.")
    .replaceAll("+", "\\+")
    .replaceAll("?", "\\?")
    .replaceAll("^", "\\^")
    .replaceAll("$", "\\$")
    .replaceAll("{", "\\{")
    .replaceAll("}", "\\}")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)")
    .replaceAll("|", "\\|")
    .replaceAll("[", "\\[")
    .replaceAll("]", "\\]")
    .replaceAll("**", "\\u0000")
    .replaceAll("*", "[^/]*")
    .replaceAll("\\u0000", ".*");
  const patternRegex = new RegExp(`^${escapedPattern}$`, "u");

  return (value: string): boolean => patternRegex.test(normalizePath(value));
}
