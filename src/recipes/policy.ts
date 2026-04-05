import type {
  ArchitectureDependencyPolicy,
  ArchitectureDependencyPolicyRole,
  ArchitectureSurfaceTier,
} from "@/quality/module-boundaries/foundation/index.ts";

/** Ordered policy collection keyed by policy name. */
export type PolicyCollection = Record<string, PolicyOptions>;

/** Shorthand options for {@link definePolicy}. */
export interface PolicyOptions {
  /** Policies allowed to import from this surface (`allowedDependents`). Defaults to `[]`. */
  dependents?: string[];
  /** Policies this surface may import from (`mayDependOn`). Defaults to `[]`. */
  dependsOn?: string[];
  /** Path prefixes this policy owns. Defaults to `["src/${name}"]`. */
  paths?: string[];
  /** Semantic role for orchestration-level budget exemptions. */
  role?: ArchitectureDependencyPolicyRole;
  /** Policies allowed to perform runtime-only imports (`allowedRuntimeImporters`). Defaults to `[]`. */
  runtimeImporters?: string[];
  /** Stability tier of the exported surface. Defaults to `"internal-public"`. */
  tier?: ArchitectureSurfaceTier;
  /** When `true`, only type imports may cross this surface boundary. Defaults to `false`. */
  typeOnly?: boolean;
}

/** Expands a keyed policy declaration into analyzer-ready policy entries. */
export function definePolicies(
  policies: PolicyCollection,
): ArchitectureDependencyPolicy[] {
  return Object.entries(policies).map(([name, options]) =>
    definePolicy(name, options),
  );
}

/**
 * Builds an {@link ArchitectureDependencyPolicy} with minimal boilerplate.
 *
 * Omitted fields fall back to the same defaults the architecture analyzer
 * applies during normalization, so a declaration only states what differs.
 *
 * @example
 * ```ts
 * definePolicy("cli", {
 *   dependsOn: ["config", "types"],
 *   dependents: ["public-api"],
 * });
 * ```
 */
export function definePolicy(
  name: string,
  opts: PolicyOptions = {},
): ArchitectureDependencyPolicy {
  return {
    ...resolvePolicyDefaults(name, opts),
    ...resolveOptionalRole(opts.role),
    ...resolveOptionalSurfaceTier(opts.tier),
  };
}

/** Resolves the dependent allowlist, defaulting to an empty list. */
function resolveAllowedDependents(opts: PolicyOptions): string[] {
  return opts.dependents ?? [];
}

/** Resolves runtime importers, defaulting to an empty list. */
function resolveAllowedRuntimeImporters(opts: PolicyOptions): string[] {
  return opts.runtimeImporters ?? [];
}

/** Resolves whether the policy enforces type-only imports. */
function resolveIsTypeOnly(opts: PolicyOptions): boolean {
  return opts.typeOnly ?? false;
}

/** Resolves outgoing dependency policies, defaulting to none. */
function resolveMayDependOn(opts: PolicyOptions): string[] {
  return opts.dependsOn ?? [];
}

/** Resolves the optional orchestration role field when the caller provides one. */
function resolveOptionalRole(
  role: ArchitectureDependencyPolicyRole | undefined,
): Partial<Pick<ArchitectureDependencyPolicy, "role">> {
  return role === undefined ? {} : { role };
}

/** Resolves the optional surface-tier field when the caller provides one. */
function resolveOptionalSurfaceTier(
  tier: ArchitectureSurfaceTier | undefined,
): Partial<Pick<ArchitectureDependencyPolicy, "surfaceTier">> {
  return tier === undefined ? {} : { surfaceTier: tier };
}

/** Resolves owned paths, defaulting to the conventional src-based location. */
function resolvePathPrefixes(name: string, opts: PolicyOptions): string[] {
  return opts.paths ?? [`src/${name}`];
}

/** Resolves the always-present policy fields and their default values. */
function resolvePolicyDefaults(
  name: string,
  opts: PolicyOptions,
): Omit<ArchitectureDependencyPolicy, "role" | "surfaceTier"> {
  return {
    allowedDependents: resolveAllowedDependents(opts),
    allowedRuntimeImporters: resolveAllowedRuntimeImporters(opts),
    isTypeOnly: resolveIsTypeOnly(opts),
    mayDependOn: resolveMayDependOn(opts),
    name,
    pathPrefixes: resolvePathPrefixes(name, opts),
  };
}
