import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import type { CheckConfig, PackageManifest } from "./types.ts";

import { parseCheckConfigModule } from "./config-schema.ts";
import { resolveTimeoutMs } from "./timeout.ts";

// ---------------------------------------------------------------------------
// Suite configuration
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG_FILE_NAMES = [
  "check-suite.config.ts",
  "check-suite.config.mts",
  "check-suite.config.js",
  "check-suite.config.mjs",
];
const CONFIG_PATH_ENV_VAR = "CHECK_SUITE_CONFIG";

/** Absolute path to the resolved check-suite config module. */
export const CHECK_SUITE_CONFIG_PATH = resolveCheckSuiteConfigPath();

/** Loaded check-suite config module. */
export const CFG: CheckConfig = await loadCheckSuiteConfig();

// ---------------------------------------------------------------------------
// Package manifest — used to enumerate declared bunx targets
// ---------------------------------------------------------------------------

const PROJECT_MANIFEST: PackageManifest = (() => {
  try {
    return JSON.parse(
      readFileSync(join(process.cwd(), "package.json"), "utf8"),
    ) as PackageManifest;
  } catch {
    return {};
  }
})();

/**
 * All binary names that the project has declared as a direct or dev dependency.
 * Used to validate `bunx` command availability before spawning.
 */
export const DECLARED_BUNX_TARGETS: Set<string> = (() => {
  const targets = new Set<string>();
  const dependencyNames = new Set<string>([
    ...Object.keys(PROJECT_MANIFEST.dependencies ?? {}),
    ...Object.keys(PROJECT_MANIFEST.devDependencies ?? {}),
    ...Object.keys(PROJECT_MANIFEST.optionalDependencies ?? {}),
    ...Object.keys(PROJECT_MANIFEST.peerDependencies ?? {}),
  ]);

  for (const dependencyName of dependencyNames) {
    targets.add(dependencyName);

    try {
      const packageJson = JSON.parse(
        readFileSync(
          join(process.cwd(), "node_modules", dependencyName, "package.json"),
          "utf8",
        ),
      ) as { bin?: Record<string, string> | string };

      if (typeof packageJson.bin === "string") {
        targets.add(
          dependencyName.includes("/")
            ? (dependencyName.split("/").at(-1) ?? dependencyName)
            : dependencyName,
        );
        continue;
      }

      for (const binName of Object.keys(packageJson.bin ?? {}))
        targets.add(binName);
    } catch {
      continue;
    }
  }

  return targets;
})();

// ---------------------------------------------------------------------------
// Suite-level constants derived from config
// ---------------------------------------------------------------------------

/** Resolved suite-level wall-clock timeout in milliseconds. */
export const SUITE_TIMEOUT_MS = resolveTimeoutMs(
  CFG.suite?.timeoutEnvVar ?? "",
  CFG.suite?.timeoutMs,
  120_000,
);

/** Display label for the suite, derived from the npm lifecycle event. */
export const SUITE_LABEL =
  process.env.npm_lifecycle_event?.trim() ?? "quality suite";

/**
 * Token map derived from `paths` in the check-suite config module.
 * Every key becomes a `{key}` substitution resolving to a cwd-joined absolute path.
 */
export const PATH_TOKENS: Record<string, string> = (() => {
  const t: Record<string, string> = {};
  for (const [k, v] of Object.entries(CFG.paths))
    t[`{${k}}`] = join(process.cwd(), v);
  return t;
})();

async function loadCheckSuiteConfig(): Promise<CheckConfig> {
  const moduleNamespace = (await import(
    pathToFileURL(CHECK_SUITE_CONFIG_PATH).href
  )) as Record<string, unknown>;
  return parseCheckConfigModule(moduleNamespace);
}

function resolveCheckSuiteConfigPath(): string {
  const explicitPath = process.env[CONFIG_PATH_ENV_VAR]?.trim();
  if (explicitPath) {
    const resolvedPath = resolve(process.cwd(), explicitPath);
    if (!existsSync(resolvedPath)) {
      throw new Error(
        `Configured check-suite config path does not exist: ${resolvedPath}`,
      );
    }
    return resolvedPath;
  }

  const discoveredPaths = DEFAULT_CONFIG_FILE_NAMES.map((fileName) =>
    join(process.cwd(), fileName),
  ).filter((filePath) => existsSync(filePath));

  if (discoveredPaths.length === 1) {
    return discoveredPaths[0];
  }

  if (discoveredPaths.length > 1) {
    throw new Error(
      `Multiple check-suite config files found: ${discoveredPaths.join(", ")}`,
    );
  }

  throw new Error(
    `No check-suite config file found. Create one of ${DEFAULT_CONFIG_FILE_NAMES.join(", ")} or set ${CONFIG_PATH_ENV_VAR}.`,
  );
}
