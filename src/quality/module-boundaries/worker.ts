import { flattenArchitectureConfigSections } from "@/quality/module-boundaries/discovery/index.ts";

import { analyzeArchitecture, formatArchitectureViolations } from "./analyze";
import {
  inferAllowedRootFileStems,
  inferCentralSurfacePathPrefixes,
  inferDependencyPolicies,
  inferEntrypointNames,
  inferExplicitPublicSurfacePaths,
} from "./policy-inference";

interface ArchitectureWorkerInput {
  configValue: unknown;
  cwd: string;
}

interface ArchitectureWorkerOutput {
  output: string;
  violationCount: number;
}

type RawDependencyPolicyEntry = Record<string, unknown>;

interface ResolvedInferenceConfig {
  allowedRootFileStems: string[];
  centralSurfacePathPrefixes: string[];
  dependencyPolicies: unknown[];
  entrypointNames: string[];
  explicitPublicSurfacePaths: string[];
}

type WorkerConfig = Record<string, unknown>;

/**
 * Creates the config snapshot used as the base for all worker-side inference.
 * The infer flag is a worker concern only and must never reach the analyzer.
 */
function buildBaseConfig(rawConfig: WorkerConfig): WorkerConfig {
  const baseConfig: WorkerConfig = { ...rawConfig };
  delete baseConfig.inferPolicies;
  return baseConfig;
}

/**
 * Matches policy owners by semantic name when the caller overrides an inferred owner.
 */
function hasMatchingPolicyName(
  inferredPolicy: ReturnType<typeof inferDependencyPolicies>[number],
  configuredPolicy: RawDependencyPolicyEntry,
): boolean {
  return typeof configuredPolicy.name === "string"
    && configuredPolicy.name === inferredPolicy.name;
}

/**
 * Matches policy owners by exact shared path prefix when names differ but the owned surface is the same.
 */
function hasSharedPathPrefix(
  inferredPathPrefixes: string[],
  configuredPathPrefixes: unknown,
): boolean {
  if (!Array.isArray(configuredPathPrefixes)) {
    return false;
  }

  return configuredPathPrefixes.some(
    (configuredPathPrefix) =>
      typeof configuredPathPrefix === "string"
      && inferredPathPrefixes.includes(configuredPathPrefix),
  );
}

/**
 * Guards dependency-policy overrides before the worker merges them into inferred policy state.
 */
function isRawDependencyPolicyEntry(value: unknown): value is RawDependencyPolicyEntry {
  return typeof value === "object" && value !== null;
}

/**
 * CLI entrypoint for the spawned architecture worker. The parent process
 * validates both the argv payload and the JSON result it reads back.
 */
function main(): void {
  const { configValue, cwd } = parseWorkerInput(process.argv.slice(2));
  const record = flattenArchitectureConfigSections(configValue);
  const resolvedConfig = resolveConfig(cwd, record);
  const violations = analyzeArchitecture(cwd, resolvedConfig);
  writeWorkerOutput({
    output: formatArchitectureViolations(violations),
    violationCount: violations.length,
  });
}

/**
 * Resolves whether a configured policy should override a specific inferred owner.
 */
function matchesConfiguredPolicy(
  inferredPolicy: ReturnType<typeof inferDependencyPolicies>[number],
  configuredPolicy: RawDependencyPolicyEntry,
): boolean {
  return hasMatchingPolicyName(inferredPolicy, configuredPolicy)
    || hasSharedPathPrefix(inferredPolicy.pathPrefixes, configuredPolicy.pathPrefixes);
}

/**
 * Merges explicit dependency policy overrides into inferred policies by exact
 * name match or shared path prefix. Matching explicit entries replace fields on
 * the inferred policy; unmatched entries are appended as new declared owners.
 */
function mergeDependencyPolicies(
  inferredPolicies: ReturnType<typeof inferDependencyPolicies>,
  configuredPolicies: RawDependencyPolicyEntry[],
): unknown[] {
  const mergedPolicies: unknown[] = [...inferredPolicies];

  for (const configuredPolicy of configuredPolicies) {
    const matchingIndex = inferredPolicies.findIndex((inferredPolicy) =>
      matchesConfiguredPolicy(inferredPolicy, configuredPolicy)
    );

    if (matchingIndex === -1) {
      mergedPolicies.push(configuredPolicy);
      continue;
    }

    mergedPolicies[matchingIndex] = {
      ...inferredPolicies[matchingIndex],
      ...configuredPolicy,
    };
  }

  return mergedPolicies;
}

function parseWorkerInput(argv: string[]): ArchitectureWorkerInput {
  const [cwd, serializedConfig] = argv;
  if (typeof cwd !== "string" || cwd.length === 0) {
    throw new Error("architecture worker requires a target cwd argument");
  }
  if (typeof serializedConfig !== "string") {
    throw new Error("architecture worker requires a serialized config argument");
  }

  let configValue: unknown;
  try {
    configValue = JSON.parse(serializedConfig) as unknown;
  } catch (error) {
    throw new Error(
      `architecture worker config is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }

  return { configValue, cwd };
}

/**
 * Reads caller-supplied dependency policy overrides from serialized worker input.
 */
function readConfiguredDependencyPolicies(
  rawConfig: WorkerConfig,
): RawDependencyPolicyEntry[] | undefined {
  const value = rawConfig.dependencyPolicies;
  return Array.isArray(value)
    ? value.filter(isRawDependencyPolicyEntry)
    : undefined;
}

/**
 * Reads an optional string-array config field from the serialized worker input.
 */
function readConfiguredStringArray(
  rawConfig: WorkerConfig,
  key: string,
): string[] | undefined {
  const value = rawConfig[key];
  return Array.isArray(value) ? value as string[] : undefined;
}

/**
 * Resolves inference flags and calls the appropriate inference helpers before
 * handing the fully-populated config to the analyzer. All inference runs here,
 * inside the subprocess, so no blocking work occurs during config-module load.
 */
function resolveConfig(cwd: string, rawConfig: WorkerConfig): unknown {
  const shouldInfer = rawConfig.inferPolicies === true;
  if (!shouldInfer) {
    return rawConfig;
  }

  const baseConfig = buildBaseConfig(rawConfig);
  const inferredConfig = resolveSurfaceConfig(cwd, rawConfig, baseConfig);
  const dependencyPolicies = resolveDependencyPoliciesConfig(
    cwd,
    rawConfig,
    baseConfig,
    inferredConfig,
  );

  return {
    ...baseConfig,
    ...inferredConfig,
    dependencyPolicies,
  };
}

/**
 * Resolves dependency policies after all prerequisite discovery fields exist.
 */
function resolveDependencyPoliciesConfig(
  cwd: string,
  rawConfig: WorkerConfig,
  baseConfig: WorkerConfig,
  inferredConfig: Omit<ResolvedInferenceConfig, "dependencyPolicies">,
): unknown[] {
  const inferredPolicies = inferDependencyPolicies(cwd, {
    ...baseConfig,
    ...inferredConfig,
  });
  const configuredPolicies = readConfiguredDependencyPolicies(rawConfig);

  return configuredPolicies === undefined
    ? inferredPolicies
    : mergeDependencyPolicies(inferredPolicies, configuredPolicies);
}

/**
 * Resolves the discovery-derived surface fields in the same order as the old
 * config-file IIFE so worker-side inference preserves identical semantics.
 */
function resolveSurfaceConfig(
  cwd: string,
  rawConfig: WorkerConfig,
  baseConfig: WorkerConfig,
): Omit<ResolvedInferenceConfig, "dependencyPolicies"> {
  const entrypointNames =
    readConfiguredStringArray(rawConfig, "entrypointNames")
    ?? inferEntrypointNames(cwd, baseConfig);
  const allowedRootFileStems =
    readConfiguredStringArray(rawConfig, "allowedRootFileStems")
    ?? inferAllowedRootFileStems(cwd, { ...baseConfig, entrypointNames });
  const explicitPublicSurfacePaths =
    readConfiguredStringArray(rawConfig, "explicitPublicSurfacePaths")
    ?? inferExplicitPublicSurfacePaths(cwd, {
      ...baseConfig,
      allowedRootFileStems,
      entrypointNames,
    });
  const centralSurfacePathPrefixes =
    readConfiguredStringArray(rawConfig, "centralSurfacePathPrefixes")
    ?? inferCentralSurfacePathPrefixes(cwd, {
      ...baseConfig,
      allowedRootFileStems,
      entrypointNames,
      explicitPublicSurfacePaths,
    });

  return {
    allowedRootFileStems,
    centralSurfacePathPrefixes,
    entrypointNames,
    explicitPublicSurfacePaths,
  };
}

function writeWorkerOutput(payload: ArchitectureWorkerOutput): void {
  process.stdout.write(JSON.stringify(payload));
}

main();