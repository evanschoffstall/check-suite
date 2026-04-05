import type { ArchitectureDependencyPolicy } from "@/quality/module-boundaries/foundation/index.ts";

export function inferDependencyPolicy(
  filePath: string,
  policies: ArchitectureDependencyPolicy[],
): ArchitectureDependencyPolicy | null {
  return (
    policies
      .filter((policy) =>
        policy.pathPrefixes.some(
          (prefix) => filePath === prefix || filePath.startsWith(`${prefix}/`),
        ),
      )
      .sort(
        (left, right) =>
          getLongestPathPrefixLength(right, filePath) -
          getLongestPathPrefixLength(left, filePath),
      )[0] ?? null
  );
}

function getLongestPathPrefixLength(
  policy: ArchitectureDependencyPolicy,
  filePath: string,
): number {
  return Math.max(
    ...policy.pathPrefixes
      .filter(
        (prefix) => filePath === prefix || filePath.startsWith(`${prefix}/`),
      )
      .map((prefix) => prefix.length),
  );
}
