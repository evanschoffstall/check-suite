import { ZodError } from "zod";

import type { CheckConfig, CheckConfigEntry, StepConfig } from "@/types/index.ts";

import { isRecord } from "@/foundation/index.ts";

import { checkConfigSchema } from "./schemas.ts";

export function defineCheckSuiteConfig(entries: CheckConfigEntry[]): CheckConfig {
  const steps: StepConfig[] = [];
  let paths: Record<string, string> = {};
  let suite: CheckConfig["suite"];
  for (const entry of entries) {
    if ("key" in entry) {
      steps.push(entry);
    } else if ("paths" in entry) {
      paths = entry.paths;
    } else {
      suite = entry.suite;
    }
  }
  return parseCheckConfig({ paths, steps, suite });
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

function formatConfigError(error: unknown): string {
  if (!(error instanceof ZodError)) {
    return error instanceof Error ? error.message : String(error);
  }

  const issues = error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "config";
    return `${path}: ${issue.message}`;
  });
  return `invalid check-suite config\n${issues.join("\n")}`;
}
