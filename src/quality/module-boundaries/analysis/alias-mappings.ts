import { readFileSync } from "node:fs";
import { join } from "node:path";

import type {
  AliasMapping,
  CodeRoots,
} from "@/quality/module-boundaries/foundation/index.ts";

import {
  normalizePath,
  trimLeadingDotSlash,
} from "@/quality/module-boundaries/foundation/index.ts";

/** Discovers broad root aliases from tsconfig or jsconfig path mappings. */
export function discoverAliasMappings(
  cwd: string,
  codeRoots: CodeRoots,
): AliasMapping[] {
  for (const configFileName of ["tsconfig.json", "jsconfig.json"]) {
    try {
      const parsed = JSON.parse(
        readFileSync(join(cwd, configFileName), "utf8"),
      ) as {
        compilerOptions?: {
          baseUrl?: string;
          paths?: Record<string, string[]>;
        };
      };
      const baseUrl = normalizePath(parsed.compilerOptions?.baseUrl ?? ".");
      const mappings = Object.entries(parsed.compilerOptions?.paths ?? {})
        .flatMap(([aliasPattern, targets]) =>
          mapAliasTargets(aliasPattern, targets, baseUrl, codeRoots),
        )
        .sort((left, right) => right.prefix.length - left.prefix.length);
      if (mappings.length > 0) return mappings;
    } catch {
      continue;
    }
  }
  return [];
}

function mapAliasTargets(
  aliasPattern: string,
  targets: string[],
  baseUrl: string,
  codeRoots: CodeRoots,
): AliasMapping[] {
  if (!aliasPattern.endsWith("/*") || targets.length === 0) return [];
  const prefix = aliasPattern.slice(0, -1);
  const targetRoots = targets
    .filter((target) => target.endsWith("/*"))
    .map((target) => normalizePath(join(baseUrl, target.slice(0, -2))))
    .filter((targetRoot) => matchesCodeRoot(targetRoot, codeRoots))
    .map(trimLeadingDotSlash);

  return targetRoots.length === 0 ? [] : [{ prefix, targetRoots }];
}

function matchesCodeRoot(targetRoot: string, codeRoots: CodeRoots): boolean {
  return codeRoots.directories.some(
    (directory) =>
      targetRoot === directory ||
      targetRoot === `./${directory}` ||
      targetRoot.endsWith(`/${directory}`),
  );
}
