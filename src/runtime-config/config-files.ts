import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

const DEFAULT_CONFIG_FILE_NAMES = [
  "check-suite.config.ts",
  "check-suite.config.mts",
  "check-suite.config.js",
  "check-suite.config.mjs",
];
const CONFIG_PATH_ENV_VAR = "CHECK_SUITE_CONFIG";

export function resolveCheckSuiteConfigPath(): string {
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
