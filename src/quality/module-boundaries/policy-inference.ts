import type {
  ArchitectureAnalyzerConfig,
  ArchitectureDependencyPolicy,
} from "@/quality/module-boundaries/foundation/index.ts";

import {
  discoverArchitectureProject,
  normalizeArchitectureConfig,
} from "@/quality/module-boundaries/discovery/index.ts";
import {
  getCodeStem,
  getLastPathSegment,
} from "@/quality/module-boundaries/foundation/index.ts";

// ---------------------------------------------------------------------------
// Structural inference helpers
// ---------------------------------------------------------------------------

type ArchitectureProject = ReturnType<typeof discoverArchitectureProject>;

/** Import-edge collections used while inferring dependency policies. */
interface PolicyConnectionState {
  incoming: Map<string, Set<string>>;
  nonTypeOnlyTargets: Set<string>;
  outgoing: Map<string, Set<string>>;
}

interface PolicyInferenceContext {
  codeRootSet: Set<string>;
  normalized: ReturnType<typeof normalizeArchitectureConfig>;
  project: ArchitectureProject;
}

/** A single unit for which an {@link ArchitectureDependencyPolicy} is generated. */
interface PolicyUnit {
  name: string;
  /** Single path prefix — directory path for a boundary, file path for a root file. */
  pathPrefix: string;
}

/**
 * Discovers the stems of all source files living directly under a code root
 * directory.  These files are intentional root surfaces — the project has
 * already committed to their presence at the top level of a source tree.
 * Any stem also present in `config.entrypointNames` is omitted because the
 * rule engine already treats entrypoints as exempt from ownership checks.
 *
 * The result is suitable as `ArchitectureAnalyzerConfig.allowedRootFileStems`.
 *
 * @example
 * ```ts
 * const entrypointNames = inferEntrypointNames(process.cwd(), { rootDirectories: ["src"] });
 * const allowedRootFileStems = inferAllowedRootFileStems(process.cwd(), {
 *   rootDirectories: ["src"],
 *   entrypointNames,
 * });
 * ```
 */
export function inferAllowedRootFileStems(
  cwd: string,
  config?: Partial<
    Omit<
      ArchitectureAnalyzerConfig,
      "allowedRootFileStems" | "dependencyPolicies"
    >
  >,
): string[] {
  const { codeRootSet, normalized, project } = createPolicyInferenceContext(
    cwd,
    config,
  );
  const entrypointStemsSet = new Set(normalized.entrypointNames);
  const stems = new Set<string>();

  for (const fact of project.sourceFacts) {
    if (
      codeRootSet.has(fact.directoryPath) &&
      !entrypointStemsSet.has(fact.stem)
    ) {
      stems.add(fact.stem);
    }
  }

  return [...stems].sort();
}

/**
 * Finds "central surface" files — root-level files and boundary entrypoints
 * whose `reExports` count is strictly above the mean across all such surfaces.
 * A high re-export count is the signature of a broad aggregation hub, exactly
 * the kind of file that warrants the `maxCentralSurfaceExports` budget check.
 *
 * The result is suitable as `ArchitectureAnalyzerConfig.centralSurfacePathPrefixes`.
 *
 * @example
 * ```ts
 * const centralSurfacePathPrefixes = inferCentralSurfacePathPrefixes(process.cwd(), {
 *   rootDirectories: ["src"],
 *   entrypointNames: inferEntrypointNames(process.cwd(), { rootDirectories: ["src"] }),
 * });
 * ```
 */
export function inferCentralSurfacePathPrefixes(
  cwd: string,
  config?: Partial<
    Omit<
      ArchitectureAnalyzerConfig,
      "centralSurfacePathPrefixes" | "dependencyPolicies"
    >
  >,
): string[] {
  const { codeRootSet, project } = createPolicyInferenceContext(cwd, config);
  const boundaryEntrypointSet = new Set(
    project.boundaries.flatMap((b) => b.entrypointPaths),
  );

  const surfaceFacts = project.sourceFacts.filter(
    (f) =>
      codeRootSet.has(f.directoryPath) || boundaryEntrypointSet.has(f.path),
  );

  return selectPathsByMean(surfaceFacts, (fact) => fact.reExports.length, "gt");
}

/**
 * Infers {@link ArchitectureDependencyPolicy} entries for a repository by
 * performing static analysis of its actual import graph.
 *
 * Every discovered boundary directory and every declared root file (from
 * `allowedRootFileStems` and `explicitPublicSurfacePaths`) receives a policy
 * whose `mayDependOn` and `allowedDependents` are derived from the real
 * cross-boundary import edges in the codebase.  No module names, paths, or
 * dependency directions are supplied by the caller.
 *
 * Additional fields inferred automatically:
 * - `isTypeOnly` — set when every cross-boundary import into the boundary uses
 *   `import type { … }` syntax, indicating a pure-types surface.
 * - `role: "orchestration"` — set when the number of outgoing dependencies
 *   exceeds `config.maxPolicyFanOut`, which is the correct semantic meaning of
 *   an orchestration layer.
 * - `surfaceTier: "public"` — set for any unit whose path is listed in
 *   `config.explicitPublicSurfacePaths`.
 *
 * The result is suitable as `ArchitectureAnalyzerConfig.dependencyPolicies`.
 * Passing it back into `analyzeArchitecture` enforces the inferred graph: any
 * new cross-boundary import added later will trigger a policy violation.
 *
 * @example
 * ```ts
 * const architecture = {
 *   dependencyPolicies: inferDependencyPolicies(process.cwd(), {
 *     ignoredDirectories: ["scripts"],
 *     rootDirectories: srcDirs,
 *   }),
 *   requireAcyclicDependencyPolicies: true,
 *   requireCompleteDependencyPolicyCoverage: true,
 * };
 * ```
 */
export function inferDependencyPolicies(
  cwd: string,
  config?: Partial<Omit<ArchitectureAnalyzerConfig, "dependencyPolicies">>,
): ArchitectureDependencyPolicy[] {
  const normalized = normalizeArchitectureConfig({
    ...config,
    dependencyPolicies: [],
  });
  const project = discoverArchitectureProject(cwd, normalized);
  const units = buildPolicyUnits(
    project.boundaries.map((b) => b.path),
    project.files,
    normalized,
  );
  const prefixToUnit = new Map(units.map((unit) => [unit.pathPrefix, unit]));
  const connectionState = collectPolicyConnections(
    units,
    project.imports,
    prefixToUnit,
  );
  const explicitPublicPaths = new Set(normalized.explicitPublicSurfacePaths);
  const runtimeBoundaries = collectRuntimeBoundaryPrefixes(
    project.sourceFacts,
    prefixToUnit,
  );

  return units.map((unit) =>
    buildDependencyPolicy(
      unit,
      connectionState,
      explicitPublicPaths,
      runtimeBoundaries,
      normalized.maxPolicyFanOut,
    ),
  );
}

/**
 * Detects which file stems are used as the designated entrypoints of boundary
 * directories by performing a discovery pass with the platform's default
 * entrypoint names (`["index", "mod"]`).  Only stems that genuinely appear in
 * `boundary.entrypointPaths` across the actual codebase are returned.  Falls
 * back to `["index"]` when no boundaries are found.
 *
 * Do **not** supply an `entrypointNames` override in `config`; let the function
 * use the platform defaults so the result reflects actual usage rather than
 * echoing back a caller-supplied value.
 *
 * The result is suitable as `ArchitectureAnalyzerConfig.entrypointNames`.
 *
 * @example
 * ```ts
 * const entrypointNames = inferEntrypointNames(process.cwd(), { rootDirectories: ["src"] });
 * ```
 */
export function inferEntrypointNames(
  cwd: string,
  config?: Partial<Omit<ArchitectureAnalyzerConfig, "dependencyPolicies">>,
): string[] {
  const normalized = normalizeArchitectureConfig({
    ...config,
    dependencyPolicies: [],
  });
  const project = discoverArchitectureProject(cwd, normalized);
  const stems = new Set<string>();

  for (const boundary of project.boundaries) {
    for (const ep of boundary.entrypointPaths) {
      stems.add(getCodeStem(getLastPathSegment(ep)));
    }
  }

  return stems.size > 0 ? [...stems].sort() : ["index"];
}

/**
 * Identifies files that serve as intentional public API surfaces by finding
 * root-level source files — direct children of a code root directory, not
 * inside any feature boundary — whose `exportedSymbolCount` is at or above the
 * mean of all such root-level files.  These candidates are the most likely
 * external entry points for downstream consumers.
 *
 * The result is suitable as `ArchitectureAnalyzerConfig.explicitPublicSurfacePaths`.
 *
 * @example
 * ```ts
 * const explicitPublicSurfacePaths = inferExplicitPublicSurfacePaths(process.cwd(), {
 *   rootDirectories: ["src"],
 *   entrypointNames: inferEntrypointNames(process.cwd(), { rootDirectories: ["src"] }),
 * });
 * ```
 */
export function inferExplicitPublicSurfacePaths(
  cwd: string,
  config?: Partial<
    Omit<
      ArchitectureAnalyzerConfig,
      "dependencyPolicies" | "explicitPublicSurfacePaths"
    >
  >,
): string[] {
  const { codeRootSet, project } = createPolicyInferenceContext(cwd, config);

  const rootFacts = project.sourceFacts.filter((f) =>
    codeRootSet.has(f.directoryPath),
  );

  return selectPathsByMean(
    rootFacts,
    (fact) => fact.exportedSymbolCount,
    "gte",
  );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Builds one inferred dependency policy from the collected relationship state. */
function buildDependencyPolicy(
  unit: PolicyUnit,
  state: PolicyConnectionState,
  explicitPublicPaths: Set<string>,
  runtimeBoundaries: Set<string>,
  maxPolicyFanOut: number,
): ArchitectureDependencyPolicy {
  const mayDependOn = [...(state.outgoing.get(unit.pathPrefix) ?? [])].sort();
  const allowedDependents = [
    ...(state.incoming.get(unit.pathPrefix) ?? []),
  ].sort();
  const isTypeOnly =
    allowedDependents.length > 0 &&
    !state.nonTypeOnlyTargets.has(unit.pathPrefix);
  const role =
    mayDependOn.length > maxPolicyFanOut ? "orchestration" : undefined;
  const surfaceTier = explicitPublicPaths.has(unit.pathPrefix)
    ? "public"
    : runtimeBoundaries.has(unit.pathPrefix)
      ? "private-runtime"
      : undefined;

  return {
    allowedDependents,
    ...(surfaceTier === "private-runtime"
      ? { allowedRuntimeImporters: allowedDependents }
      : {}),
    ...(isTypeOnly ? { isTypeOnly } : {}),
    mayDependOn,
    name: unit.name,
    pathPrefixes: [unit.pathPrefix],
    ...(role !== undefined ? { role } : {}),
    ...(surfaceTier !== undefined ? { surfaceTier } : {}),
  };
}

function buildPolicyUnits(
  boundaryPaths: string[],
  files: string[],
  config: ReturnType<typeof normalizeArchitectureConfig>,
): PolicyUnit[] {
  const units: PolicyUnit[] = boundaryPaths.map((path) => ({
    name: getLastPathSegment(path),
    pathPrefix: path,
  }));

  const boundaryPathSet = new Set(boundaryPaths);
  const rootFileStems = new Set(config.allowedRootFileStems);
  const explicitSurfaces = new Set(config.explicitPublicSurfacePaths);

  for (const file of files) {
    // Only root files (single depth inside a code root, not inside a boundary).
    if (isInsideBoundary(file, boundaryPathSet)) continue;
    const stem = getCodeStem(getLastPathSegment(file));
    if (rootFileStems.has(stem) || explicitSurfaces.has(file)) {
      units.push({ name: stem, pathPrefix: file });
    }
  }

  return units;
}

/** Collects cross-unit import relationships from the discovered import graph. */
function collectPolicyConnections(
  units: PolicyUnit[],
  imports: ArchitectureProject["imports"],
  prefixToUnit: Map<string, PolicyUnit>,
): PolicyConnectionState {
  const state = createPolicyConnectionState(units);

  for (const entry of imports) {
    if (!entry.resolvedPath) {
      continue;
    }

    const sourceUnit = resolveUnit(entry.sourcePath, prefixToUnit);
    const targetUnit = resolveUnit(entry.resolvedPath, prefixToUnit);
    if (
      sourceUnit === null ||
      targetUnit === null ||
      sourceUnit.pathPrefix === targetUnit.pathPrefix
    ) {
      continue;
    }

    state.outgoing.get(sourceUnit.pathPrefix)?.add(targetUnit.name);
    state.incoming.get(targetUnit.pathPrefix)?.add(sourceUnit.name);
    if (!entry.isTypeOnly) {
      state.nonTypeOnlyTargets.add(targetUnit.pathPrefix);
    }
  }

  return state;
}

/** Collects unit prefixes that contain runtime operations and must stay private. */
function collectRuntimeBoundaryPrefixes(
  sourceFacts: ArchitectureProject["sourceFacts"],
  prefixToUnit: Map<string, PolicyUnit>,
): Set<string> {
  const runtimeBoundaries = new Set<string>();

  for (const fact of sourceFacts) {
    if (fact.runtimeOperationCount === 0) {
      continue;
    }

    const unit = resolveUnit(fact.path, prefixToUnit);
    if (unit !== null) {
      runtimeBoundaries.add(unit.pathPrefix);
    }
  }

  return runtimeBoundaries;
}

/** Initializes inbound and outbound relationship sets for each discovered unit. */
function createPolicyConnectionState(
  units: PolicyUnit[],
): PolicyConnectionState {
  const incoming = new Map<string, Set<string>>();
  const outgoing = new Map<string, Set<string>>();

  for (const { pathPrefix } of units) {
    incoming.set(pathPrefix, new Set());
    outgoing.set(pathPrefix, new Set());
  }

  return {
    incoming,
    nonTypeOnlyTargets: new Set<string>(),
    outgoing,
  };
}

/** Normalizes config once so each inference helper shares the same project view. */
function createPolicyInferenceContext(
  cwd: string,
  config?: Partial<Omit<ArchitectureAnalyzerConfig, "dependencyPolicies">>,
): PolicyInferenceContext {
  const normalized = normalizeArchitectureConfig({
    ...config,
    dependencyPolicies: [],
  });
  const project = discoverArchitectureProject(cwd, normalized);

  return {
    codeRootSet: new Set(project.codeRoots.directories),
    normalized,
    project,
  };
}

function isInsideBoundary(
  filePath: string,
  boundaryPaths: Set<string>,
): boolean {
  for (const bp of boundaryPaths) {
    if (filePath.startsWith(`${bp}/`)) return true;
  }
  return false;
}

/** Matches a file path to its owning policy unit, preferring the deepest (longest) prefix. */
function resolveUnit(
  filePath: string,
  prefixToUnit: Map<string, PolicyUnit>,
): null | PolicyUnit {
  let best: null | PolicyUnit = null;
  for (const [prefix, unit] of prefixToUnit) {
    if (filePath === prefix || filePath.startsWith(`${prefix}/`)) {
      if (!best || prefix.length > best.pathPrefix.length) {
        best = unit;
      }
    }
  }
  return best;
}

/** Selects path values whose metric stands above the collection mean. */
function selectPathsByMean(
  facts: ArchitectureProject["sourceFacts"],
  metric: (fact: ArchitectureProject["sourceFacts"][number]) => number,
  mode: "gt" | "gte",
): string[] {
  if (facts.length === 0) {
    return [];
  }

  const mean =
    facts.reduce((sum, fact) => sum + metric(fact), 0) / facts.length;

  return facts
    .filter((fact) =>
      mode === "gt" ? metric(fact) > mean : metric(fact) >= mean,
    )
    .map((fact) => fact.path)
    .sort();
}
