import { type CheckConfig, isRecord } from "../types/index.ts";
import { checkConfigSchema } from "./check-schema.ts";
import { formatConfigError } from "./utils.ts";

export function defineCheckSuiteConfig<TConfig extends CheckConfig>(
  config: TConfig,
): TConfig {
  return parseCheckConfig(config) as TConfig;
}

export function parseCheckConfig(config: unknown): CheckConfig {
  try {
    return checkConfigSchema.parse(config) as CheckConfig;
  } catch (error) {
    throw new Error(formatConfigError(error), { cause: error });
  }
}

export function parseCheckConfigModule(moduleNamespace: unknown): CheckConfig {
  if (!isRecord(moduleNamespace)) {
    throw new Error("check-suite config module did not export an object");
  }

  const configValue =
    "default" in moduleNamespace
      ? moduleNamespace.default
      : "config" in moduleNamespace
        ? moduleNamespace.config
        : undefined;

  if (configValue === undefined) {
    throw new Error(
      "check-suite config module must export the config as `default` or `config`",
    );
  }

  return parseCheckConfig(configValue);
}
