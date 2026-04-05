import { join } from "node:path";
import { pathToFileURL } from "node:url";

import type { CheckConfig } from "@/types/index.ts";

import { parseCheckConfigModule } from "@/config-schema/index.ts";
import { resolveTimeoutMs } from "@/timeout/index.ts";

import { resolveCheckSuiteConfigPath } from "./config-files.ts";

export const CHECK_SUITE_CONFIG_PATH = resolveCheckSuiteConfigPath();

export const CFG: CheckConfig = await loadCheckSuiteConfig();

export const SUITE_TIMEOUT_MS = resolveTimeoutMs(
  CFG.suite?.timeoutEnvVar ?? "",
  CFG.suite?.timeoutMs,
  120_000,
);

export const SUITE_LABEL =
  process.env.npm_lifecycle_event?.trim() ?? "quality suite";

export const PATH_TOKENS: Record<string, string> = (() => {
  const tokens: Record<string, string> = {};
  for (const [key, value] of Object.entries(CFG.paths)) {
    tokens[`{${key}}`] = join(process.cwd(), value);
  }
  return tokens;
})();

async function loadCheckSuiteConfig(): Promise<CheckConfig> {
  const moduleNamespace = (await import(
    pathToFileURL(CHECK_SUITE_CONFIG_PATH).href
  )) as Record<string, unknown>;
  return parseCheckConfigModule(moduleNamespace);
}