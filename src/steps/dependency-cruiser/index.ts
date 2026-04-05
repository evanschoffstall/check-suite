import type {
  ICruiseOptions,
  IForbiddenRuleType,
  IReporterOutput,
} from "dependency-cruiser";

import { cruise } from "dependency-cruiser";
import extractTSConfig from "dependency-cruiser/config-utl/extract-ts-config";
import { readdirSync } from "node:fs";
import { extname, join } from "node:path";

import type { Command, InlineTypeScriptContext } from "@/types/index.ts";

/**
 * Generic dependency-cruiser policy for repository-agnostic dependency checks.
 *
 * The step discovers source roots dynamically so it works across repo layouts
 * without any project-specific configuration.
 */

const DEPENDENCY_CRUISER_SOURCE_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mts",
  ".cts",
  ".mjs",
  ".cjs",
] as const;

const DEPENDENCY_CRUISER_IGNORED_DIRECTORY_NAMES = new Set([
  ".cache",
  ".git",
  ".idea",
  ".next",
  ".nuxt",
  ".output",
  ".pnpm-store",
  ".svelte-kit",
  ".turbo",
  ".vercel",
  ".vscode",
  ".yarn",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "out",
  "tmp",
]);

const GENERIC_DEPENDENCY_CRUISER_RULES: IForbiddenRuleType[] = [
  {
    comment:
      "Break circular references instead of normalizing them as an architecture pattern.",
    from: {},
    name: "no-circular-dependencies",
    severity: "error",
    to: {
      circular: true,
    },
  },
];

interface DependencyCruiserTarget {
  kind: "directory" | "file";
  path: string;
}

/** Runs dependency-cruiser with dynamically discovered repository targets. */
export async function runDependencyCruiserStep({
  cwd,
  existsSync,
  fail,
  ok,
}: InlineTypeScriptContext): Promise<Command> {
  const targets = discoverDependencyCruiserTargets(cwd);
  if (targets.length === 0) {
    return ok("no dependency-cruiser targets found\n");
  }

  const targetPaths = targets.map((target) => target.path);
  const tsConfigFilePath = join(cwd, "tsconfig.json");
  const options = buildDependencyCruiserOptions(targets);
  const result = await cruise(
    targetPaths,
    options,
    undefined,
    existsSync(tsConfigFilePath)
      ? { tsConfig: extractTSConfig(tsConfigFilePath) }
      : undefined,
  );
  const output = normalizeDependencyCruiserOutput(result);

  return result.exitCode === 0 ? ok(output) : fail(output);
}

/** Builds the generic dependency-cruiser options for the discovered targets. */
function buildDependencyCruiserOptions(
  targets: DependencyCruiserTarget[],
): ICruiseOptions {
  return {
    combinedDependencies: true,
    doNotFollow: {
      path: "node_modules",
    },
    enhancedResolveOptions: {
      extensions: [...DEPENDENCY_CRUISER_SOURCE_EXTENSIONS, ".json"],
    },
    includeOnly: createIncludeOnlyPattern(targets),
    outputType: "err",
    ruleSet: {
      forbidden: GENERIC_DEPENDENCY_CRUISER_RULES,
    },
    tsConfig: {
      fileName: "tsconfig.json",
    },
    tsPreCompilationDeps: true,
    validate: true,
  };
}

/** Searches a directory tree until it finds at least one supported source file. */
function containsDependencyCruiserSourceFiles(directoryPath: string): boolean {
  for (const entry of readdirSync(directoryPath, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) {
      continue;
    }

    if (entry.isFile() && isDependencyCruiserSourceFile(entry.name)) {
      return true;
    }

    if (
      entry.isDirectory() &&
      !DEPENDENCY_CRUISER_IGNORED_DIRECTORY_NAMES.has(entry.name) &&
      containsDependencyCruiserSourceFiles(join(directoryPath, entry.name))
    ) {
      return true;
    }
  }

  return false;
}

/** Limits dependency-cruiser analysis to the discovered roots and files. */
function createIncludeOnlyPattern(targets: DependencyCruiserTarget[]): string {
  return targets
    .map((target) =>
      target.kind === "directory"
        ? `^${escapeRegExp(target.path)}(?:/|$)`
        : `^${escapeRegExp(target.path)}$`,
    )
    .join("|");
}

/** Discovers top-level source roots so the step can work across different repo layouts. */
function discoverDependencyCruiserTargets(
  cwd: string,
): DependencyCruiserTarget[] {
  return readdirSync(cwd, { withFileTypes: true })
    .flatMap((entry): DependencyCruiserTarget[] => {
      if (entry.isSymbolicLink()) {
        return [];
      }

      if (entry.isFile()) {
        return isDependencyCruiserSourceFile(entry.name)
          ? [{ kind: "file", path: entry.name }]
          : [];
      }

      if (!entry.isDirectory()) {
        return [];
      }

      if (DEPENDENCY_CRUISER_IGNORED_DIRECTORY_NAMES.has(entry.name)) {
        return [];
      }

      return containsDependencyCruiserSourceFiles(join(cwd, entry.name))
        ? [{ kind: "directory", path: entry.name }]
        : [];
    })
    .sort((left, right) => left.path.localeCompare(right.path));
}

/** Escapes regular expression metacharacters in generated include patterns. */
function escapeRegExp(value: string): string {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

/** Checks whether a file name matches a dependency-cruiser source extension. */
function isDependencyCruiserSourceFile(fileName: string): boolean {
  return DEPENDENCY_CRUISER_SOURCE_EXTENSIONS.includes(
    extname(fileName) as (typeof DEPENDENCY_CRUISER_SOURCE_EXTENSIONS)[number],
  );
}

/** Normalizes dependency-cruiser reporter output into the step command format. */
function normalizeDependencyCruiserOutput({ output }: IReporterOutput): string {
  const normalizedOutput =
    typeof output === "string" ? output : JSON.stringify(output, null, 2);

  return normalizedOutput.endsWith("\n")
    ? normalizedOutput
    : `${normalizedOutput}\n`;
}
