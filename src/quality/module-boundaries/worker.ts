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

interface ResolvedInferenceConfig {
  allowedRootFileStems: string[];
  centralSurfacePathPrefixes: string[];
  dependencyPolicies: ReturnType<typeof inferDependencyPolicies>;
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
 * CLI entrypoint for the spawned architecture worker. The parent process
 * validates both the argv payload and the JSON result it reads back.
 */
function main(): void {
  const { configValue, cwd } = parseWorkerInput(process.argv.slice(2));
  const record = typeof configValue === "object" && configValue !== null
    ? (configValue as WorkerConfig)
    : {};
  const resolvedConfig = resolveConfig(cwd, record);
  const violations = analyzeArchitecture(cwd, resolvedConfig);
  writeWorkerOutput({
    output: formatArchitectureViolations(violations),
    violationCount: violations.length,
  });
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
 * Returns a preconfigured dependency policy list when one is supplied.
 */
function readConfiguredDependencyPolicies(
  rawConfig: WorkerConfig,
): ReturnType<typeof inferDependencyPolicies> | undefined {
  const value = rawConfig.dependencyPolicies;
  return Array.isArray(value)
    ? value as ReturnType<typeof inferDependencyPolicies>
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
): ReturnType<typeof inferDependencyPolicies> {
  return readConfiguredDependencyPolicies(rawConfig)
    ?? inferDependencyPolicies(cwd, { ...baseConfig, ...inferredConfig });
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