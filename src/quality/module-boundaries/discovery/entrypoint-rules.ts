import type { ArchitectureEntrypointRule } from "@/quality/module-boundaries/foundation/index.ts";

import { isRecord } from "@/foundation/index.ts";
import * as architectureDefaults from "@/quality/module-boundaries/foundation/index.ts";

import { normalizeStringListConfig } from "./normalization.ts";

/** Normalizes default and explicit public-entrypoint rules into a stable sorted list. */
export function normalizeEntrypointRules(
  record: Record<string, unknown>,
): ArchitectureEntrypointRule[] {
  const rulesByName = createDefaultEntrypointRuleMap(record.entrypointNames);

  if (Array.isArray(record.entrypointRules)) {
    for (const candidate of record.entrypointRules) {
      mergeEntrypointRuleCandidate(rulesByName, candidate);
    }
  }

  return sortEntrypointRules(rulesByName);
}

function createDefaultEntrypointRuleMap(
  entrypointNames: unknown,
): Map<string, ArchitectureEntrypointRule> {
  return new Map(
    normalizeStringListConfig(
      entrypointNames,
      architectureDefaults.DEFAULT_ENTRYPOINT_NAMES,
    ).map((name) => [
      name,
      { allowSiblingEntrypoints: false, allowTopLevelStatements: false, name },
    ]),
  );
}

function mergeEntrypointRuleCandidate(
  rulesByName: Map<string, ArchitectureEntrypointRule>,
  candidate: unknown,
): void {
  const name = readEntrypointRuleName(candidate);
  if (!name || !isRecord(candidate)) return;

  const previousRule = rulesByName.get(name);
  rulesByName.set(name, {
    allowSiblingEntrypoints: readBooleanConfig(
      candidate.allowSiblingEntrypoints,
      previousRule?.allowSiblingEntrypoints ?? false,
    ),
    allowTopLevelStatements: readBooleanConfig(
      candidate.allowTopLevelStatements,
      previousRule?.allowTopLevelStatements ?? false,
    ),
    name,
  });
}

function readBooleanConfig(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function readEntrypointRuleName(candidate: unknown): null | string {
  if (!isRecord(candidate) || typeof candidate.name !== "string") return null;
  const name = candidate.name.trim();
  return name.length > 0 ? name : null;
}

function sortEntrypointRules(
  rulesByName: Map<string, ArchitectureEntrypointRule>,
): ArchitectureEntrypointRule[] {
  return [...rulesByName.values()].sort((left, right) =>
    left.name.localeCompare(right.name),
  );
}
