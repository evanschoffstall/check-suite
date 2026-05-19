import { ZodError } from "zod";

import type {
  CheckConfig,
  CheckConfigEntry,
  StepConfig,
  StepEntryHandlers,
} from "@/types/index.ts";

import { isRecord } from "@/foundation/index.ts";

import { defineStepEntries, defineStepEntryHandlers } from "./entries.ts";
import { checkConfigSchema } from "./schemas.ts";

/**
 * Normalizes either the legacy flat entry array or the concise object form
 * into the validated runtime config consumed by the suite runner.
 */
export function defineCheckSuiteConfig(
  entriesOrConfig: CheckConfig | CheckConfigEntry[],
): CheckConfig {
  return parseCheckConfig(entriesOrConfig);
}

export function parseCheckConfig(config: unknown): CheckConfig {
  try {
    return checkConfigSchema.parse(
      isCheckConfigEntryArray(config)
        ? normalizeCheckConfigEntries(config)
        : config,
    ) as CheckConfig;
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

function collectConfigRegistries(entries: CheckConfigEntry[]): {
  kinds: StepEntryHandlers;
  paths: Record<string, string>;
  suite?: CheckConfig["suite"];
} {
  const registries: {
    kinds: StepEntryHandlers;
    paths: Record<string, string>;
    suite?: CheckConfig["suite"];
  } = { kinds: {}, paths: {} };

  for (const entry of entries) {
    if ("kinds" in entry && isRecord(entry.kinds)) {
      registries.kinds = defineStepEntryHandlers(entry.kinds);
      continue;
    }
    if ("paths" in entry && isStringRecord(entry.paths)) {
      registries.paths = entry.paths;
      continue;
    }
    if (!("kind" in entry) && "suite" in entry) {
      registries.suite = entry.suite;
    }
  }

  return registries;
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

function isCheckConfigEntryArray(
  config: unknown,
): config is CheckConfigEntry[] {
  return Array.isArray(config);
}

function isStepConfigEntry(entry: CheckConfigEntry): entry is StepConfig {
  return "key" in entry && "label" in entry && !("kind" in entry);
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    isRecord(value) &&
    Object.values(value).every((item) => typeof item === "string")
  );
}

function normalizeCheckConfigEntries(entries: CheckConfigEntry[]): CheckConfig {
  const { kinds, paths, suite } = collectConfigRegistries(entries);
  const steps = entries.flatMap((entry) =>
    normalizeCheckConfigStepEntry(entry, kinds),
  );
  return { paths, steps, suite };
}

function normalizeCheckConfigStepEntry(
  entry: CheckConfigEntry,
  kinds: StepEntryHandlers,
): StepConfig[] {
  if (isStepConfigEntry(entry)) return [entry];
  if ("kind" in entry) {
    return defineStepEntries([entry], kinds);
  }
  return [];
}
