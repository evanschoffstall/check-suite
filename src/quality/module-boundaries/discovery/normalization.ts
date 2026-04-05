import type {
  ArchitectureDependencyPolicy,
  ArchitectureDependencyPolicyRole,
  ArchitectureLayerGroup,
  ArchitectureSurfaceTier,
} from "@/quality/module-boundaries/foundation/index.ts";

import {
  DEFAULT_DEPENDENCY_POLICIES,
  normalizePath,
  trimLeadingDotSlash,
} from "@/quality/module-boundaries/foundation/index.ts";

/** Returns whether a value is a non-null plain object record. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Normalizes an optional boolean config entry while preserving the fallback. */
export function normalizeBooleanConfig(
  value: unknown,
  fallback: boolean,
): boolean {
  return typeof value === "boolean" ? value : fallback;
}

/** Normalizes repository dependency policies, falling back to an empty list. */
export function normalizeDependencyPolicies(
  value: unknown,
): ArchitectureDependencyPolicy[] {
  return toDependencyPolicies(value) ?? [...DEFAULT_DEPENDENCY_POLICIES];
}

/** Normalizes one integer config entry while enforcing a minimum. */
export function normalizeIntegerConfig(
  value: unknown,
  minimum: number,
  fallback: number,
): number {
  return toIntegerAtLeast(value, minimum) ?? fallback;
}

/** Normalizes optional layer groups, falling back to an empty list. */
export function normalizeLayerGroups(value: unknown): ArchitectureLayerGroup[] {
  return toLayerPatternGroups(value) ?? [];
}

/** Normalizes an optional list of strings, preserving the provided fallback. */
export function normalizeStringListConfig(
  value: unknown,
  fallback: readonly string[],
): string[] {
  return toStringList(value) ?? [...fallback];
}

function normalizeDependencyPolicyPathPrefix(value: string): string {
  return trimTrailingSlash(trimLeadingDotSlash(normalizePath(value))).trim();
}

function toDependencyPolicies(
  value: unknown,
): ArchitectureDependencyPolicy[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const policies = value
    .map((entry) => {
      if (!isRecord(entry)) {
        return null;
      }

      const name = entry.name;
      const allowedDependents = toStringList(entry.allowedDependents) ?? [];
      const allowedRuntimeImporters =
        toStringList(entry.allowedRuntimeImporters) ?? [];
      const isTypeOnly = entry.isTypeOnly;
      const mayDependOn = toStringList(entry.mayDependOn);
      const rawPathPrefixes = toStringList(entry.pathPrefixes);
      const role = toDependencyPolicyRole(entry.role);
      const surfaceTier = toSurfaceTier(entry.surfaceTier);

      if (
        typeof name !== "string" ||
        name.length === 0 ||
        mayDependOn === null ||
        rawPathPrefixes === null ||
        (typeof isTypeOnly !== "boolean" && isTypeOnly !== undefined) ||
        (entry.role !== undefined && role === null) ||
        (entry.surfaceTier !== undefined && surfaceTier === null)
      ) {
        return null;
      }

      const pathPrefixes = rawPathPrefixes.map(
        normalizeDependencyPolicyPathPrefix,
      );

      return pathPrefixes.length > 0 &&
        pathPrefixes.every((prefix) => prefix.length > 0)
        ? {
            allowedDependents: [...new Set(allowedDependents)],
            allowedRuntimeImporters: [...new Set(allowedRuntimeImporters)],
            isTypeOnly: isTypeOnly === true,
            mayDependOn: [...new Set(mayDependOn)],
            name,
            pathPrefixes,
            role: role ?? undefined,
            surfaceTier: surfaceTier ?? undefined,
          }
        : null;
    })
    .filter((entry) => entry !== null) as ArchitectureDependencyPolicy[];

  return policies.length === value.length ? policies : null;
}

function toDependencyPolicyRole(
  value: unknown,
): ArchitectureDependencyPolicyRole | null {
  return value === "orchestration" || value === "standard" ? value : null;
}

function toIntegerAtLeast(value: unknown, minimum: number): null | number {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= minimum
    ? value
    : null;
}

function toLayerPatternGroups(
  value: unknown,
): null | { name: string; patterns: string[] }[] {
  if (!Array.isArray(value)) {
    return null;
  }

  const groups = value
    .map((entry) => {
      if (!isRecord(entry)) {
        return null;
      }

      const name = entry.name;
      const patterns = toStringList(entry.patterns);

      return typeof name === "string" && name.length > 0 && patterns !== null
        ? { name, patterns }
        : null;
    })
    .filter(
      (
        entry,
      ): entry is {
        name: string;
        patterns: string[];
      } => entry !== null,
    );

  return groups.length === value.length ? groups : null;
}

function toStringList(value: unknown): null | string[] {
  return Array.isArray(value) &&
    value.every((entry) => typeof entry === "string")
    ? value
    : null;
}

function toSurfaceTier(value: unknown): ArchitectureSurfaceTier | null {
  return value === "internal-public" ||
    value === "private-runtime" ||
    value === "public"
    ? value
    : null;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/u, "");
}
