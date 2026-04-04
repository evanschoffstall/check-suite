import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { CheckConfig, PackageManifest } from "./types.ts";

import { resolveTimeoutMs } from "./timeout.ts";

// ---------------------------------------------------------------------------
// Suite configuration
// ---------------------------------------------------------------------------

/** Loaded check-suite.json configuration. */
export const CFG: CheckConfig = JSON.parse(
  readFileSync(join(process.cwd(), "check-suite.json"), "utf8"),
) as CheckConfig;

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
 * Token map derived from `paths` in `check-suite.json`.
 * Every key becomes a `{key}` substitution resolving to a cwd-joined absolute path.
 */
export const PATH_TOKENS: Record<string, string> = (() => {
  const t: Record<string, string> = {};
  for (const [k, v] of Object.entries(CFG.paths))
    t[`{${k}}`] = join(process.cwd(), v);
  return t;
})();
