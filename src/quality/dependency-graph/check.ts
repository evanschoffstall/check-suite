import type {
  ICruiseOptions,
  IForbiddenRuleType,
  IReporterOutput,
} from "dependency-cruiser";
import type { existsSync } from "node:fs";

import { cruise } from "dependency-cruiser";
import extractTSConfig from "dependency-cruiser/config-utl/extract-ts-config";
import { readdirSync } from "node:fs";
import { extname, join } from "node:path";

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

export interface DependencyCruiserCheckResult {
  exitCode: number;
  output: string;
}

interface DependencyCruiserTarget {
  kind: "directory" | "file";
  path: string;
}

export async function runDependencyCruiserCheck(
  cwd: string,
  pathExists: typeof existsSync,
): Promise<DependencyCruiserCheckResult> {
  const targets = discoverDependencyCruiserTargets(cwd);
  if (targets.length === 0) {
    return { exitCode: 0, output: "no dependency-cruiser targets found\n" };
  }

  const targetPaths = targets.map((target) => target.path);
  const tsConfigFilePath = join(cwd, "tsconfig.json");
  const options = buildDependencyCruiserOptions(targets);
  const result = await cruise(
    targetPaths,
    options,
    undefined,
    pathExists(tsConfigFilePath)
      ? { tsConfig: extractTSConfig(tsConfigFilePath) }
      : undefined,
  );

  return {
    exitCode: result.exitCode,
    output: normalizeDependencyCruiserOutput(result),
  };
}

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

function createIncludeOnlyPattern(targets: DependencyCruiserTarget[]): string {
  return targets
    .map((target) =>
      target.kind === "directory"
        ? `^${escapeRegExp(target.path)}(?:/|$)`
        : `^${escapeRegExp(target.path)}$`,
    )
    .join("|");
}

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

function escapeRegExp(value: string): string {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function isDependencyCruiserSourceFile(fileName: string): boolean {
  return DEPENDENCY_CRUISER_SOURCE_EXTENSIONS.includes(
    extname(fileName) as (typeof DEPENDENCY_CRUISER_SOURCE_EXTENSIONS)[number],
  );
}

function normalizeDependencyCruiserOutput({ output }: IReporterOutput): string {
  const normalizedOutput =
    typeof output === "string" ? output : JSON.stringify(output, null, 2);

  return normalizedOutput.endsWith("\n")
    ? normalizedOutput
    : `${normalizedOutput}\n`;
}
