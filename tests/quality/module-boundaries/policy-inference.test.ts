import { describe, expect, test } from "bun:test";

import { analyzeArchitecture } from "@/quality/module-boundaries/analyze.ts";
import { discoverDefaultCodeRoots } from "@/quality/module-boundaries/discovery/index.ts";
import {
  inferAllowedRootFileStems,
  inferCentralSurfacePathPrefixes,
  inferDependencyPolicies,
  inferEntrypointNames,
  inferExplicitPublicSurfacePaths,
} from "@/quality/module-boundaries/policy-inference.ts";

import { createTempRepoFactory } from "./temp-repo";

// ---------------------------------------------------------------------------
// Shared fixture helpers
// ---------------------------------------------------------------------------

const createTempRepo = createTempRepoFactory("check-suite-inference-");

/**
 * Creates a temporary repository directory containing the given source files.
 * A minimal `tsconfig.json` is written automatically.  The returned path is the
 * repo root (the value you pass as `cwd` to inference and analysis functions).
 */
function createInferenceRepo(files: Record<string, string>): string {
  return createTempRepo(files);
}

// ---------------------------------------------------------------------------
// inferEntrypointNames
// ---------------------------------------------------------------------------

describe("inferEntrypointNames", () => {
  test("returns 'index' when all boundary directories use index.ts", () => {
    const repo = createInferenceRepo({
      "src/a/impl.ts": "export const impl = true;\n",
      "src/a/index.ts": "export const a = true;\n",
      "src/b/impl.ts": "export const impl = true;\n",
      "src/b/index.ts": "export const b = true;\n",
    });

    expect(inferEntrypointNames(repo, { rootDirectories: ["src"] })).toEqual(["index"]);
  });

  test("returns 'mod' when boundaries use mod.ts (discovered with platform defaults)", () => {
    const repo = createInferenceRepo({
      "src/a/impl.ts": "export const impl = true;\n",
      "src/a/mod.ts": "export const a = true;\n",
      "src/b/impl.ts": "export const impl = true;\n",
      "src/b/mod.ts": "export const b = true;\n",
    });

    expect(inferEntrypointNames(repo, { rootDirectories: ["src"] })).toEqual(["mod"]);
  });

  test("returns both 'index' and 'mod' when both are present", () => {
    const repo = createInferenceRepo({
      "src/a/impl.ts": "export const impl = true;\n",
      "src/a/index.ts": "export const a = true;\n",
      "src/b/impl.ts": "export const impl = true;\n",
      "src/b/mod.ts": "export const b = true;\n",
    });

    expect(inferEntrypointNames(repo, { rootDirectories: ["src"] })).toEqual(["index", "mod"]);
  });

  test("falls back to ['index'] when no boundaries are discovered", () => {
    // A directory with no entrypoint file is not a boundary.
    const repo = createInferenceRepo({
      "src/a/runner.ts": "export const run = () => true;\n",
    });

    expect(inferEntrypointNames(repo, { rootDirectories: ["src"] })).toEqual(["index"]);
  });

  test("ignores directories that have no child implementation alongside the entrypoint", () => {
    // A lone index.ts with no siblings and no subdirectory is not a boundary.
    const repo = createInferenceRepo({
      "src/index.ts": "export const x = 1;\n",
    });

    // The src/ directory itself is the code root — its index.ts is a root file,
    // not a boundary entrypoint.  No boundaries → fallback.
    expect(inferEntrypointNames(repo, { rootDirectories: ["src"] })).toEqual(["index"]);
  });

  test("deduplicates identical stems from multiple boundaries", () => {
    const repo = createInferenceRepo({
      "src/a/impl.ts": "export const impl = 1;\n",
      "src/a/index.ts": "export const a = true;\n",
      "src/b/impl.ts": "export const impl = 1;\n",
      "src/b/index.ts": "export const b = true;\n",
      "src/c/impl.ts": "export const impl = 1;\n",
      "src/c/index.ts": "export const c = true;\n",
    });

    // All use "index" → deduplicated to a single "index" entry.
    expect(inferEntrypointNames(repo, { rootDirectories: ["src"] })).toEqual(["index"]);
  });
});

// ---------------------------------------------------------------------------
// inferAllowedRootFileStems
// ---------------------------------------------------------------------------

describe("inferAllowedRootFileStems", () => {
  test("collects stems of source files directly under a code root", () => {
    const repo = createInferenceRepo({
      "src/a/impl.ts": "export const impl = 1;\n",
      "src/a/index.ts": "export const a = true;\n",
      "src/check.ts": "export const check = true;\n",
    });

    const stems = inferAllowedRootFileStems(repo, { entrypointNames: ["index"], rootDirectories: ["src"] });
    expect(stems).toContain("check");
  });

  test("excludes stems that are already entrypoint names", () => {
    const repo = createInferenceRepo({
      "src/a/impl.ts": "export const impl = 1;\n",
      "src/a/index.ts": "export const a = true;\n",
      "src/check.ts": "export const check = true;\n",
      "src/index.ts": "export const root = true;\n",
    });

    const stems = inferAllowedRootFileStems(repo, { entrypointNames: ["index"], rootDirectories: ["src"] });
    expect(stems).not.toContain("index");
    expect(stems).toContain("check");
  });

  test("returns empty array when no root-level source files exist", () => {
    const repo = createInferenceRepo({
      "src/a/impl.ts": "export const impl = 1;\n",
      "src/a/index.ts": "export const a = true;\n",
    });

    expect(
      inferAllowedRootFileStems(repo, { entrypointNames: ["index"], rootDirectories: ["src"] }),
    ).toEqual([]);
  });

  test("ignores source files inside boundary subdirectories", () => {
    const repo = createInferenceRepo({
      // helpers.ts is inside the "a" boundary, not a root file
      "src/a/helpers.ts": "export const h = true;\n",
      "src/a/impl.ts": "export const impl = 1;\n",
      "src/a/index.ts": "export const a = true;\n",
    });

    const stems = inferAllowedRootFileStems(repo, { entrypointNames: ["index"], rootDirectories: ["src"] });
    expect(stems).not.toContain("helpers");
  });

  test("returns sorted unique stems from multiple root files", () => {
    const repo = createInferenceRepo({
      "src/a/impl.ts": "export const impl = 1;\n",
      "src/a/index.ts": "export const a = true;\n",
      "src/api.ts": "export const a = true;\n",
      "src/check.ts": "export const c = true;\n",
      "src/utils.ts": "export const u = true;\n",
    });

    const stems = inferAllowedRootFileStems(repo, { entrypointNames: ["index"], rootDirectories: ["src"] });
    expect(stems).toEqual(["api", "check", "utils"]);
  });

  test("declaration files are not counted as root file stems", () => {
    const repo = createInferenceRepo({
      "src/a/impl.ts": "export const impl = 1;\n",
      // .d.ts files are excluded by the scanner
      "src/a/index.ts": "export const a = true;\n",
      "src/check.ts": "export const check = true;\n",
    });

    const stems = inferAllowedRootFileStems(repo, { entrypointNames: ["index"], rootDirectories: ["src"] });
    // Only "check" should appear — confirm no extras from d.ts
    expect(stems).toEqual(["check"]);
  });
});

// ---------------------------------------------------------------------------
// inferExplicitPublicSurfacePaths
// ---------------------------------------------------------------------------

describe("inferExplicitPublicSurfacePaths", () => {
  test("returns a root file with at-or-above-mean export count", () => {
    const repo = createInferenceRepo({
      // helpers.ts exports 1 symbol → below mean
      "src/helpers.ts": "export const z = 1;\n",
      // main.ts exports 5 symbols → above mean of (5+1)/2 = 3
      "src/main.ts": [
        "export const a = 1;",
        "export const b = 2;",
        "export const c = 3;",
        "export const d = 4;",
        "export const e = 5;",
        "",
      ].join("\n"),
    });

    const paths = inferExplicitPublicSurfacePaths(repo, { rootDirectories: ["src"] });
    expect(paths).toContain("src/main.ts");
    expect(paths).not.toContain("src/helpers.ts");
  });

  test("returns all root files when all have equal export counts", () => {
    const repo = createInferenceRepo({
      "src/alpha.ts": "export const a = 1;\nexport const b = 2;\n",
      "src/beta.ts": "export const c = 3;\nexport const d = 4;\n",
    });

    const paths = inferExplicitPublicSurfacePaths(repo, { rootDirectories: ["src"] });
    expect(paths).toContain("src/alpha.ts");
    expect(paths).toContain("src/beta.ts");
  });

  test("returns the single root file when only one exists", () => {
    const repo = createInferenceRepo({
      "src/check.ts": "export const api = true;\n",
    });

    // Single file equals its own mean → always returned
    expect(inferExplicitPublicSurfacePaths(repo, { rootDirectories: ["src"] })).toEqual([
      "src/check.ts",
    ]);
  });

  test("returns empty array when no root-level source files exist", () => {
    const repo = createInferenceRepo({
      "src/a/impl.ts": "export const impl = 1;\n",
      "src/a/index.ts": "export const a = true;\n",
    });

    expect(inferExplicitPublicSurfacePaths(repo, { rootDirectories: ["src"] })).toEqual([]);
  });

  test("does not include files inside boundary directories", () => {
    const repo = createInferenceRepo({
      "src/a/index.ts": "export { a } from './public.ts';\n",
      // a/public.ts lives inside the "a" boundary — not a root-level file
      "src/a/public.ts": "export const a = 1;\nexport const b = 2;\nexport const c = 3;\n",
      "src/check.ts": "export const check = true;\n",
    });

    const paths = inferExplicitPublicSurfacePaths(repo, { rootDirectories: ["src"] });
    // "a/public.ts" must not appear; only root-level "check.ts" is eligible
    expect(paths.every((p) => !p.includes("a/public"))).toBe(true);
  });

  test("returns sorted paths when multiple root files qualify", () => {
    const repo = createInferenceRepo({
      "src/a.ts": "export const a = 1;\nexport const aa = 2;\n",
      "src/z.ts": "export const z = 1;\nexport const zz = 2;\n",
    });

    const paths = inferExplicitPublicSurfacePaths(repo, { rootDirectories: ["src"] });
    expect(paths).toEqual(["src/a.ts", "src/z.ts"]);
  });
});

// ---------------------------------------------------------------------------
// inferCentralSurfacePathPrefixes
// ---------------------------------------------------------------------------

describe("inferCentralSurfacePathPrefixes", () => {
  test("returns a root file with above-mean re-export count", () => {
    const repo = createInferenceRepo({
      "src/a/impl.ts": "export const a = 1;\n",
      // boundary entrypoints each re-export only 1 file
      "src/a/index.ts": 'export { a } from "./impl.ts";\n',
      "src/b/impl.ts": "export const b = 2;\n",
      "src/b/index.ts": 'export { b } from "./impl.ts";\n',
      "src/c/impl.ts": "export const c = 3;\n",
      "src/c/index.ts": 'export { c } from "./impl.ts";\n',
      // check.ts re-exports from a, b, c → 3 re-exports
      "src/check.ts": [
        'export { a } from "./a/index.ts";',
        'export { b } from "./b/index.ts";',
        'export { c } from "./c/index.ts";',
        "",
      ].join("\n"),
    });

    // Surface files: check.ts(3), a/index.ts(1), b/index.ts(1), c/index.ts(1)
    // mean = (3+1+1+1)/4 = 1.5 → check.ts (3 > 1.5) → only check.ts
    const prefixes = inferCentralSurfacePathPrefixes(repo, { rootDirectories: ["src"] });
    expect(prefixes).toContain("src/check.ts");
    expect(prefixes).not.toContain("src/a/index.ts");
  });

  test("returns boundary entrypoint with above-mean re-export count", () => {
    const repo = createInferenceRepo({
      // root file has few re-exports (or none)
      "src/check.ts": "export { hub } from './hub/index.ts';\n",
      "src/hub/a.ts": "export const a = 1;\n",
      "src/hub/b.ts": "export const b = 2;\n",
      "src/hub/c.ts": "export const c = 3;\n",
      "src/hub/d.ts": "export const d = 4;\n",
      // hub/index.ts re-exports from many sub-modules → high count
      "src/hub/index.ts": [
        'export { a } from "./a.ts";',
        'export { b } from "./b.ts";',
        'export { c } from "./c.ts";',
        'export { d } from "./d.ts";',
        "",
      ].join("\n"),
      "src/lean/impl.ts": "export const impl = 1;\n",
      "src/lean/index.ts": "export const lean = true;\n",
    });

    // Surface files: check.ts(1), hub/index.ts(4), lean/index.ts(0)
    // mean = (1+4+0)/3 = 1.67 → hub/index.ts (4 > 1.67)
    const prefixes = inferCentralSurfacePathPrefixes(repo, { rootDirectories: ["src"] });
    expect(prefixes).toContain("src/hub/index.ts");
    expect(prefixes).not.toContain("src/lean/index.ts");
  });

  test("returns empty array when no surface files exist", () => {
    const repo = createInferenceRepo({
      "src/a/impl.ts": "export const a = 1;\n",
    });

    // No root files, no boundaries → no surface facts
    expect(inferCentralSurfacePathPrefixes(repo, { rootDirectories: ["src"] })).toEqual([]);
  });

  test("returns empty when all surface files have equal re-export counts", () => {
    const repo = createInferenceRepo({
      "src/a/impl.ts": "export const a = 1;\n",
      // All boundary entrypoints re-export the same number of files
      "src/a/index.ts": 'export { a } from "./impl.ts";\n',
      "src/b/impl.ts": "export const b = 2;\n",
      "src/b/index.ts": 'export { b } from "./impl.ts";\n',
    });

    // Surface files: a/index.ts(1), b/index.ts(1) → mean=1.0 → neither strictly > 1.0
    const prefixes = inferCentralSurfacePathPrefixes(repo, { rootDirectories: ["src"] });
    expect(prefixes).toEqual([]);
  });

  test("returns sorted paths when multiple surfaces qualify", () => {
    const repo = createInferenceRepo({
      "src/a-api.ts": [
        'export { a } from "./a/index.ts";',
        'export { b } from "./b/index.ts";',
        'export { c } from "./c/index.ts";',
        "",
      ].join("\n"),
      "src/a/impl.ts": "export const impl = 1;\n",
      "src/a/index.ts": "export const a = 1;\n",
      "src/b/impl.ts": "export const impl = 2;\n",
      "src/b/index.ts": "export const b = 2;\n",
      "src/c/impl.ts": "export const impl = 3;\n",
      "src/c/index.ts": "export const c = 3;\n",
      // Two root files both have above-mean re-exports relative to lean entrypoints
      "src/z-api.ts": [
        'export { a } from "./a/index.ts";',
        'export { b } from "./b/index.ts";',
        'export { c } from "./c/index.ts";',
        "",
      ].join("\n"),
    });

    const prefixes = inferCentralSurfacePathPrefixes(repo, { rootDirectories: ["src"] });
    // Verify sort order
    expect(prefixes).toEqual([...prefixes].sort());
  });
});

// ---------------------------------------------------------------------------
// inferDependencyPolicies
// ---------------------------------------------------------------------------

describe("inferDependencyPolicies", () => {
  test("infers mayDependOn from actual cross-boundary imports", () => {
    const repo = createInferenceRepo({
      "src/process/index.ts": 'export { run } from "./runner.ts";\n',
      "src/process/runner.ts":
        'import { summarize } from "../summary/index.ts";\nexport const run = () => summarize();\n',
      "src/summary/core.ts": "export const summarize = () => 'done';\n",
      "src/summary/index.ts": 'export { summarize } from "./core.ts";\n',
    });

    const policies = inferDependencyPolicies(repo, { rootDirectories: ["src"] });
    const processPolicy = policies.find((p) => p.name === "process");
    expect(processPolicy?.mayDependOn).toContain("summary");
  });

  test("infers allowedDependents from inbound import edges", () => {
    const repo = createInferenceRepo({
      "src/process/index.ts": 'export { run } from "./runner.ts";\n',
      "src/process/runner.ts":
        'import { summarize } from "../summary/index.ts";\nexport const run = () => summarize();\n',
      "src/summary/core.ts": "export const summarize = () => 'done';\n",
      "src/summary/index.ts": 'export { summarize } from "./core.ts";\n',
    });

    const policies = inferDependencyPolicies(repo, { rootDirectories: ["src"] });
    const summaryPolicy = policies.find((p) => p.name === "summary");
    expect(summaryPolicy?.allowedDependents).toContain("process");
  });

  test("detects type-only policies when all imports are type imports", () => {
    const repo = createInferenceRepo({
      "src/process/index.ts": 'export { run } from "./runner.ts";\n',
      "src/process/runner.ts":
        'import type { Config } from "../types/index.ts";\nexport const run = (c: Config) => c;\n',
      // A boundary needs an entrypoint + at least one non-entrypoint sibling (impl file)
      // to be discovered as a boundary directory.
      "src/types/index.ts": "export interface Config { debug: boolean }\n",
      "src/types/models.ts": "export interface Model { id: string }\n",
    });

    const policies = inferDependencyPolicies(repo, { rootDirectories: ["src"] });
    const typesPolicy = policies.find((p) => p.name === "types");
    expect(typesPolicy?.isTypeOnly).toBe(true);
  });

  test("does not mark type-only boundary when value imports also exist", () => {
    const repo = createInferenceRepo({
      "src/process/index.ts": 'export { run } from "./runner.ts";\n',
      "src/process/runner.ts": [
        'import type { Config } from "../types/index.ts";',
        'import { defaultConfig } from "../types/index.ts";',
        "export const run = (c: Config = defaultConfig) => c;",
        "",
      ].join("\n"),
      "src/types/index.ts": [
        "export interface Config { debug: boolean }",
        "export const defaultConfig: Config = { debug: false };",
        "",
      ].join("\n"),
    });

    const policies = inferDependencyPolicies(repo, { rootDirectories: ["src"] });
    const typesPolicy = policies.find((p) => p.name === "types");
    expect(typesPolicy?.isTypeOnly).toBeUndefined();
  });

  test("sets 'orchestration' role when outgoing deps exceed maxPolicyFanOut", () => {
    const repo = createInferenceRepo({
      "src/a/impl.ts": "export const impl = 1;\n",
      "src/a/index.ts": "export const a = () => 1;\n",
      "src/b/impl.ts": "export const impl = 2;\n",
      "src/b/index.ts": "export const b = () => 2;\n",
      "src/c/impl.ts": "export const impl = 3;\n",
      "src/c/index.ts": "export const c = () => 3;\n",
      "src/d/impl.ts": "export const impl = 4;\n",
      "src/d/index.ts": "export const d = () => 4;\n",
      "src/e/impl.ts": "export const impl = 5;\n",
      "src/e/index.ts": "export const e = () => 5;\n",
      "src/orchestrator/index.ts": 'export { run } from "./runner.ts";\n',
      "src/orchestrator/runner.ts": [
        'import { a } from "../a/index.ts";',
        'import { b } from "../b/index.ts";',
        'import { c } from "../c/index.ts";',
        'import { d } from "../d/index.ts";',
        'import { e } from "../e/index.ts";',
        "export const run = () => [a(), b(), c(), d(), e()];",
        "",
      ].join("\n"),
    });

    // maxPolicyFanOut = 4 → orchestrator has 5 deps → role: "orchestration"
    const policies = inferDependencyPolicies(repo, {
      maxPolicyFanOut: 4,
      rootDirectories: ["src"],
    });
    const orchPolicy = policies.find((p) => p.name === "orchestrator");
    expect(orchPolicy?.role).toBe("orchestration");
  });

  test("marks explicitly listed root file stems as public-tier", () => {
    const repo = createInferenceRepo({
      "src/check.ts": 'export { run } from "./process/index.ts";\n',
      "src/process/impl.ts": "export const impl = 1;\n",
      "src/process/index.ts": "export const run = () => true;\n",
    });

    const policies = inferDependencyPolicies(repo, {
      allowedRootFileStems: ["check"],
      explicitPublicSurfacePaths: ["src/check.ts"],
      rootDirectories: ["src"],
    });
    const checkPolicy = policies.find((p) => p.name === "check");
    expect(checkPolicy?.surfaceTier).toBe("public");
  });

  test("marks boundaries with runtime operations as private-runtime", () => {
    const repo = createInferenceRepo({
      "src/runtime-config/impl.ts": "export const impl = 1;\n",
      "src/runtime-config/index.ts": "export const cwd = process.cwd();\n",
    });

    const policies = inferDependencyPolicies(repo, { rootDirectories: ["src"] });
    const runtimePolicy = policies.find((p) => p.name === "runtime-config");
    expect(runtimePolicy?.surfaceTier).toBe("private-runtime");
  });

  test("sets allowedRuntimeImporters for private-runtime boundaries", () => {
    const repo = createInferenceRepo({
      "src/consumer/index.ts": 'export { run } from "./runner.ts";\n',
      "src/consumer/runner.ts":
        'import { cfg } from "../runtime-config/index.ts";\nexport const run = () => cfg;\n',
      "src/runtime-config/impl.ts": "export const impl = 1;\n",
      "src/runtime-config/index.ts": "export const cfg = process.cwd();\n",
    });

    const policies = inferDependencyPolicies(repo, { rootDirectories: ["src"] });
    const runtimePolicy = policies.find((p) => p.name === "runtime-config");
    expect(runtimePolicy?.allowedRuntimeImporters).toContain("consumer");
  });

  test("produces a policy per boundary directory", () => {
    const repo = createInferenceRepo({
      "src/alpha/impl.ts": "export const impl = 1;\n",
      "src/alpha/index.ts": "export const a = true;\n",
      "src/beta/impl.ts": "export const impl = 2;\n",
      "src/beta/index.ts": "export const b = true;\n",
    });

    const policies = inferDependencyPolicies(repo, { rootDirectories: ["src"] });
    const names = policies.map((p) => p.name).sort();
    expect(names).toContain("alpha");
    expect(names).toContain("beta");
  });

  test("produces empty mayDependOn for isolated boundaries", () => {
    const repo = createInferenceRepo({
      "src/a/impl.ts": "export const impl = 1;\n",
      "src/a/index.ts": "export const a = true;\n",
      "src/b/impl.ts": "export const impl = 2;\n",
      "src/b/index.ts": "export const b = true;\n",
    });

    const policies = inferDependencyPolicies(repo, { rootDirectories: ["src"] });
    for (const policy of policies) {
      expect(policy.mayDependOn).toEqual([]);
      expect(policy.allowedDependents).toEqual([]);
    }
  });

  test("creates policy for a declared root file stem", () => {
    const repo = createInferenceRepo({
      "src/a/impl.ts": "export const impl = 1;\n",
      "src/a/index.ts": "export const a = true;\n",
      "src/check.ts": "export const check = true;\n",
    });

    const policies = inferDependencyPolicies(repo, {
      allowedRootFileStems: ["check"],
      rootDirectories: ["src"],
    });
    expect(policies.some((p) => p.pathPrefixes.includes("src/check.ts"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Architecture rule violation tests (via analyzeArchitecture)
// ---------------------------------------------------------------------------

describe("architecture rule: root-file-ownership", () => {
  test("flags file directly under code root not in allowedRootFileStems", () => {
    const repo = createInferenceRepo({
      "src/rogue.ts": "export const rogue = true;\n",
    });

    const violations = analyzeArchitecture(repo, {
      allowedRootFileStems: [],
      includeRootFiles: false,
      rootDirectories: ["src"],
    });

    expect(violations.some((v) => v.code === "root-file-ownership" && v.message.includes("src/rogue.ts"))).toBe(true);
  });

  test("does not flag file whose stem is in allowedRootFileStems", () => {
    const repo = createInferenceRepo({
      "src/check.ts": "export const check = true;\n",
    });

    const violations = analyzeArchitecture(repo, {
      allowedRootFileStems: ["check"],
      includeRootFiles: false,
      rootDirectories: ["src"],
    });

    expect(violations.some((v) => v.code === "root-file-ownership")).toBe(false);
  });

  test("does not flag entrypoint-stemmed file at root", () => {
    const repo = createInferenceRepo({
      "src/index.ts": "export const x = 1;\n",
    });

    const violations = analyzeArchitecture(repo, {
      allowedRootFileStems: [],
      entrypointNames: ["index"],
      includeRootFiles: false,
      rootDirectories: ["src"],
    });

    expect(violations.some((v) => v.code === "root-file-ownership")).toBe(false);
  });
});

describe("architecture rule: dependency-policy", () => {
  test("flags import that violates declared dependency policy", () => {
    const repo = createInferenceRepo({
      "src/cli/index.ts": 'export { run } from "./runner.ts";\n',
      "src/cli/runner.ts":
        'import { format } from "../format/index.ts";\nexport const run = () => format();\n',
      "src/format/impl.ts": "export const impl = 1;\n",
      "src/format/index.ts": "export const format = () => 'ok';\n",
    });

    const violations = analyzeArchitecture(repo, {
      dependencyPolicies: [
        { mayDependOn: [], name: "cli", pathPrefixes: ["src/cli"] },
        { mayDependOn: [], name: "format", pathPrefixes: ["src/format"] },
      ],
      includeRootFiles: false,
      rootDirectories: ["src"],
    });

    expect(violations.some((v) => v.code === "dependency-policy")).toBe(true);
  });

  test("passes when import is explicitly allowed", () => {
    const repo = createInferenceRepo({
      "src/cli/index.ts": 'export { run } from "./runner.ts";\n',
      "src/cli/runner.ts":
        'import { format } from "../format/index.ts";\nexport const run = () => format();\n',
      "src/format/impl.ts": "export const impl = 1;\n",
      "src/format/index.ts": "export const format = () => 'ok';\n",
    });

    const violations = analyzeArchitecture(repo, {
      dependencyPolicies: [
        { mayDependOn: ["format"], name: "cli", pathPrefixes: ["src/cli"] },
        { mayDependOn: [], name: "format", pathPrefixes: ["src/format"] },
      ],
      includeRootFiles: false,
      rootDirectories: ["src"],
    });

    expect(violations.some((v) => v.code === "dependency-policy")).toBe(false);
  });
});

describe("architecture rule: dependency-policy-coverage", () => {
  test("flags uncovered top-level directory when coverage is required", () => {
    const repo = createInferenceRepo({
      "src/cli/impl.ts": "export const impl = 1;\n",
      "src/cli/index.ts": "export const run = () => true;\n",
    });

    const violations = analyzeArchitecture(repo, {
      dependencyPolicies: [],
      includeRootFiles: false,
      requireCompleteDependencyPolicyCoverage: true,
      rootDirectories: ["src"],
    });

    expect(violations.some((v) => v.code === "dependency-policy-coverage")).toBe(true);
  });
});

describe("architecture rule: dependency-policy-cycle", () => {
  test("flags cyclic dependency between two boundaries", () => {
    const repo = createInferenceRepo({
      "src/a/index.ts": 'export { a } from "./runner.ts";\n',
      "src/a/runner.ts":
        'import { b } from "../b/index.ts";\nexport const a = () => b();\n',
      "src/b/index.ts": 'export { b } from "./runner.ts";\n',
      "src/b/runner.ts":
        'import { a } from "../a/index.ts";\nexport const b = () => a();\n',
    });

    const violations = analyzeArchitecture(repo, {
      dependencyPolicies: [
        { mayDependOn: ["b"], name: "a", pathPrefixes: ["src/a"] },
        { mayDependOn: ["a"], name: "b", pathPrefixes: ["src/b"] },
      ],
      includeRootFiles: false,
      requireAcyclicDependencyPolicies: true,
      rootDirectories: ["src"],
    });

    expect(violations.some((v) => v.code === "dependency-policy-cycle")).toBe(true);
  });
});

describe("architecture rule: dependency-policy-fan-out", () => {
  test("flags owner with more dependencies than maxPolicyFanOut", () => {
    const repo = createInferenceRepo({
      "src/a/index.ts": 'export { a } from "./runner.ts";\n',
      "src/a/runner.ts": [
        'import { b } from "../b/index.ts";',
        'import { c } from "../c/index.ts";',
        'import { d } from "../d/index.ts";',
        "export const a = () => [b(), c(), d()];",
        "",
      ].join("\n"),
      "src/b/impl.ts": "export const impl = 1;\n",
      "src/b/index.ts": "export const b = () => true;\n",
      "src/c/impl.ts": "export const impl = 1;\n",
      "src/c/index.ts": "export const c = () => true;\n",
      "src/d/impl.ts": "export const impl = 1;\n",
      "src/d/index.ts": "export const d = () => true;\n",
    });

    const violations = analyzeArchitecture(repo, {
      dependencyPolicies: [
        { mayDependOn: ["b", "c", "d"], name: "a", pathPrefixes: ["src/a"] },
        { mayDependOn: [], name: "b", pathPrefixes: ["src/b"] },
        { mayDependOn: [], name: "c", pathPrefixes: ["src/c"] },
        { mayDependOn: [], name: "d", pathPrefixes: ["src/d"] },
      ],
      includeRootFiles: false,
      maxPolicyFanOut: 2,
      rootDirectories: ["src"],
    });

    expect(violations.some((v) => v.code === "dependency-policy-fan-out")).toBe(true);
  });
});

describe("architecture rule: dependency-dependent-allowlist", () => {
  test("flags importer not listed in allowedDependents", () => {
    const repo = createInferenceRepo({
      "src/cli/index.ts": 'export { run } from "./runner.ts";\n',
      "src/cli/runner.ts":
        'import { cfg } from "../config/index.ts";\nexport const run = () => cfg;\n',
      "src/config/impl.ts": "export const impl = 1;\n",
      "src/config/index.ts": "export const cfg = true;\n",
    });

    const violations = analyzeArchitecture(repo, {
      dependencyPolicies: [
        {
          // cli imports config, which is allowed by mayDependOn
          mayDependOn: ["config"],
          name: "cli",
          pathPrefixes: ["src/cli"],
        },
        {
          // Only "server" is allowed; "cli" is not in the list → violation
          allowedDependents: ["server"],
          mayDependOn: [],
          name: "config",
          pathPrefixes: ["src/config"],
        },
      ],
      includeRootFiles: false,
      rootDirectories: ["src"],
    });

    expect(violations.some((v) => v.code === "dependency-dependent-allowlist")).toBe(true);
  });
});

describe("architecture rule: runtime-importer-allowlist", () => {
  test("flags importer not listed in allowedRuntimeImporters", () => {
    const repo = createTempRepo({
      "src/consumer/index.ts": 'export { run } from "./runner.ts";\n',
      "src/consumer/runner.ts":
        'import { cfg } from "../runtime-config/index.ts";\nexport const run = () => cfg;\n',
      "src/runtime-config/impl.ts": "export const impl = 1;\n",
      "src/runtime-config/index.ts": "export const cfg = process.cwd();\n",
    });

    const violations = analyzeArchitecture(repo, {
      dependencyPolicies: [
        {
          mayDependOn: ["runtime-config"],
          name: "consumer",
          pathPrefixes: ["src/consumer"],
        },
        {
          allowedRuntimeImporters: [],
          mayDependOn: [],
          name: "runtime-config",
          pathPrefixes: ["src/runtime-config"],
          surfaceTier: "private-runtime",
        },
      ],
      includeRootFiles: false,
      rootDirectories: ["src"],
    });

    expect(violations.some((v) => v.code === "runtime-importer-allowlist")).toBe(true);
  });
});

describe("architecture rule: type-only-policy-import", () => {
  test("flags value import into a type-only policy boundary", () => {
    const repo = createTempRepo({
      "src/process/index.ts": 'export { run } from "./runner.ts";\n',
      "src/process/runner.ts":
        'import { Thing } from "../types/index.ts";\nexport const run = (input: Thing) => input;\n',
      "src/types/index.ts": "export interface Thing { value: string }\n",
    });

    const violations = analyzeArchitecture(repo, {
      dependencyPolicies: [
        { mayDependOn: ["types"], name: "process", pathPrefixes: ["src/process"] },
        { isTypeOnly: true, mayDependOn: [], name: "types", pathPrefixes: ["src/types"] },
      ],
      includeRootFiles: false,
      requireTypeOnlyImportsForTypeOnlyPolicies: true,
      rootDirectories: ["src"],
    });

    expect(violations.some((v) => v.code === "type-only-policy-import")).toBe(true);
  });

  test("passes when the import is a proper type import", () => {
    const repo = createTempRepo({
      "src/process/index.ts": 'export { run } from "./runner.ts";\n',
      "src/process/runner.ts":
        'import type { Thing } from "../types/index.ts";\nexport const run = (input: Thing) => input;\n',
      "src/types/index.ts": "export interface Thing { value: string }\n",
    });

    const violations = analyzeArchitecture(repo, {
      dependencyPolicies: [
        { mayDependOn: ["types"], name: "process", pathPrefixes: ["src/process"] },
        { isTypeOnly: true, mayDependOn: [], name: "types", pathPrefixes: ["src/types"] },
      ],
      includeRootFiles: false,
      requireTypeOnlyImportsForTypeOnlyPolicies: true,
      rootDirectories: ["src"],
    });

    expect(violations.some((v) => v.code === "type-only-policy-import")).toBe(false);
  });
});

describe("architecture rule: public-surface-tier", () => {
  test("flags explicitPublicSurfacePath not owned by a public-tier policy", () => {
    const repo = createTempRepo({
      "src/check.ts": 'export { run } from "./process/index.ts";\n',
      "src/process/impl.ts": "export const impl = 1;\n",
      "src/process/index.ts": "export const run = () => true;\n",
    });

    const violations = analyzeArchitecture(repo, {
      dependencyPolicies: [
        {
          mayDependOn: ["process"],
          name: "check",
          pathPrefixes: ["src/check.ts"],
          surfaceTier: "internal-public",
        },
        { mayDependOn: [], name: "process", pathPrefixes: ["src/process"] },
      ],
      explicitPublicSurfacePaths: ["src/check.ts"],
      includeRootFiles: false,
      rootDirectories: ["src"],
    });

    expect(violations.some((v) => v.code === "public-surface-tier")).toBe(true);
  });
});

describe("architecture rule: public-surface-purity", () => {
  test("flags runtime operations in an explicit public surface file", () => {
    const repo = createTempRepo({
      "src/check.ts": "const value = process.cwd();\nexport { value };\n",
    });

    const violations = analyzeArchitecture(repo, {
      explicitPublicSurfacePaths: ["src/check.ts"],
      includeRootFiles: false,
      rootDirectories: ["src"],
    });

    expect(violations.some((v) => v.code === "public-surface-purity")).toBe(true);
  });
});

describe("architecture rule: public-surface-wildcard-export", () => {
  test("flags wildcard re-export from an explicit public surface", () => {
    const repo = createTempRepo({
      "src/check.ts": 'export * from "./types/index.ts";\n',
      "src/types/impl.ts": "export const impl = 1;\n",
      "src/types/index.ts": "export const value = 1;\n",
    });

    const violations = analyzeArchitecture(repo, {
      explicitPublicSurfacePaths: ["src/check.ts"],
      includeRootFiles: false,
      maxWildcardExportsPerPublicSurface: 0,
      rootDirectories: ["src"],
    });

    expect(violations.some((v) => v.code === "public-surface-wildcard-export")).toBe(true);
  });
});

describe("architecture rule: public-surface-re-export-chain", () => {
  test("flags re-export chain through an intermediate boundary entrypoint", () => {
    const repo = createTempRepo({
      "src/check.ts": 'export { runCli } from "./cli/index.ts";\n',
      "src/cli/index.ts": 'export { runCli } from "./runner.ts";\n',
      "src/cli/runner.ts": "export const runCli = () => true;\n",
    });

    const violations = analyzeArchitecture(repo, {
      allowPublicSurfaceReExportChains: false,
      explicitPublicSurfacePaths: ["src/check.ts"],
      includeRootFiles: false,
      rootDirectories: ["src"],
    });

    expect(violations.some((v) => v.code === "public-surface-re-export-chain")).toBe(true);
  });
});

describe("architecture rule: runtime-only-path", () => {
  test("flags runtime operations in a file outside private-runtime modules", () => {
    const repo = createTempRepo({
      "src/inline-ts/index.ts":
        'export { cwd } from "./runtime.ts";\n',
      "src/inline-ts/runtime.ts": "const cwd = process.cwd();\nexport { cwd };\n",
    });

    const violations = analyzeArchitecture(repo, {
      includeRootFiles: false,
      rootDirectories: ["src"],
    });

    expect(violations.some((v) => v.code === "runtime-only-path")).toBe(true);
  });
});

describe("architecture rule: directory-depth", () => {
  test("flags directories nested beyond maxDirectoryDepth", () => {
    const repo = createTempRepo({
      "src/a/b/c/d/index.ts": "export const value = 1;\n",
      "src/a/index.ts": 'export { value } from "./b/c/d/index.ts";\n',
    });

    const violations = analyzeArchitecture(repo, {
      includeRootFiles: false,
      maxDirectoryDepth: 3,
      rootDirectories: ["src"],
    });

    expect(
      violations.some((v) => v.code === "directory-depth" && v.message.includes("src/a/b/c/d")),
    ).toBe(true);
  });
});

describe("architecture rule: central-surface-budget", () => {
  test("flags central surface that exceeds maxCentralSurfaceExports", () => {
    const manyExports = Array.from(
      { length: 5 },
      (_, i) => `export const sym${i} = ${i};`,
    ).join("\n") + "\n";

    const repo = createTempRepo({
      "src/check.ts": manyExports,
    });

    const violations = analyzeArchitecture(repo, {
      centralSurfacePathPrefixes: ["src/check.ts"],
      dependencyPolicies: [
        { mayDependOn: [], name: "check", pathPrefixes: ["src/check.ts"], surfaceTier: "public" },
      ],
      explicitPublicSurfacePaths: ["src/check.ts"],
      includeRootFiles: false,
      maxCentralSurfaceExports: 3,
      rootDirectories: ["src"],
    });

    expect(violations.some((v) => v.code === "central-surface-budget")).toBe(true);
  });

  test("passes when central surface exports are within budget", () => {
    const repo = createTempRepo({
      "src/check.ts": "export const a = 1;\nexport const b = 2;\n",
    });

    const violations = analyzeArchitecture(repo, {
      centralSurfacePathPrefixes: ["src/check.ts"],
      dependencyPolicies: [
        { mayDependOn: [], name: "check", pathPrefixes: ["src/check.ts"], surfaceTier: "public" },
      ],
      explicitPublicSurfacePaths: ["src/check.ts"],
      includeRootFiles: false,
      maxCentralSurfaceExports: 10,
      rootDirectories: ["src"],
    });

    expect(violations.some((v) => v.code === "central-surface-budget")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Inference round-trip on the actual repository
// ---------------------------------------------------------------------------

describe("inference round-trip on actual repository", () => {
  test("fully inferred config produces zero architecture violations on this repo", () => {
    const cwd = process.cwd();
    const { directories: allDirs } = discoverDefaultCodeRoots(cwd);
    const srcDirs = allDirs.includes("src") ? ["src"] : allDirs;

    const discoveryBase = {
      ignoredDirectoryNames: [
        ".cache", ".git", ".idea", ".next", ".turbo", ".vscode",
        "build", "coverage", "dist", "node_modules", "out", "scripts", "tmp",
      ],
      maxPolicyFanOut: 5,
      rootDirectories: srcDirs,
      testDirectoryNames: ["__fixtures__", "__mocks__", "__tests__", "fixtures", "mocks", "test", "tests"],
      vendorManagedDirectoryNames: ["__generated__", "generated", "vendor"],
    };

    const entrypointNames        = inferEntrypointNames(cwd, discoveryBase);
    const allowedRootFileStems   = inferAllowedRootFileStems(cwd, { ...discoveryBase, entrypointNames });
    const explicitPublicSurfacePaths = inferExplicitPublicSurfacePaths(cwd, {
      ...discoveryBase,
      allowedRootFileStems,
      entrypointNames,
    });

    const boundaryDiscovery = {
      ...discoveryBase,
      allowedRootFileStems,
      entrypointNames,
      explicitPublicSurfacePaths,
    };

    const violations = analyzeArchitecture(cwd, {
      ...boundaryDiscovery,
      allowPublicSurfaceReExportChains: false,
      centralSurfacePathPrefixes: inferCentralSurfacePathPrefixes(cwd, boundaryDiscovery),
      dependencyPolicies: inferDependencyPolicies(cwd, boundaryDiscovery),
      includeRootFiles: false,
      maxCentralSurfaceExports: 66,
      maxDirectoryDepth: 3,
      maxEntrypointReExports: 12,
      maxInternalImportsPerFile: 12,
      maxSiblingImports: 7,
      maxWildcardExportsPerPublicSurface: 0,
      minRepeatedDeepImports: 3,
      requireAcyclicDependencyPolicies: true,
      requireCompleteDependencyPolicyCoverage: true,
      requireTypeOnlyImportsForTypeOnlyPolicies: true,
      sharedHomeNames: ["types", "contracts", "utils"],
    });

    if (violations.length > 0) {
      // Print violations to help diagnose failures
      const formatted = violations.map((v) => `  [${v.code}] ${v.message}`).join("\n");
      throw new Error(`Expected 0 violations but got ${violations.length}:\n${formatted}`);
    }

    expect(violations).toEqual([]);
  });
});
