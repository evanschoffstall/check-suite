import { describe, expect, test } from "bun:test";

import type { ArchitectureAnalyzerConfig } from "@/quality/module-boundaries/foundation/index.ts";

import { analyzeArchitecture as analyzeArchitectureBase } from "@/quality/module-boundaries/analyze.ts";

import { createTempRepoFactory } from "./temp-repo";
import { withTestCodeTargets } from "./test-code-targets";

const createTempRepo = createTempRepoFactory("check-suite-architecture-");
const analyzeArchitecture = (
  repoDir: string,
  config: Partial<ArchitectureAnalyzerConfig>,
) => analyzeArchitectureBase(repoDir, withTestCodeTargets(config));

describe("architecture analyzer", () => {
  test("flags unowned root files beneath a code root", () => {
    const repoDir = createTempRepo({
      "src/rogue.ts": "export const rogue = true;\n",
    });

    const violations = analyzeArchitecture(repoDir, {
      allowedRootFileStems: [],
      rootDirectories: ["src"],
    });

    expect(
      violations.some(
        (violation) =>
          violation.code === "root-file-ownership" &&
          violation.message.includes("src/rogue.ts"),
      ),
    ).toBe(true);
  });

  test("flags nested files whose names match configured junk-drawer glob patterns", () => {
    const repoDir = createTempRepo({
      "src/process/index.ts": 'export { runtimeCoordinator } from "./runtime-coordinator.ts";\n',
      "src/process/runtime-coordinator.ts":
        "export const runtimeCoordinator = true;\n",
    });

    const violations = analyzeArchitecture(repoDir, {
      junkDrawerFileNamePatterns: ["*runtime*"],
      rootDirectories: ["src"],
    });

    expect(
      violations.some(
        (violation) =>
          violation.code === "junk-drawer-file" &&
          violation.message.includes("src/process/runtime-coordinator.ts"),
      ),
    ).toBe(true);
  });

  test("flags imports that violate explicit dependency policies", () => {
    const repoDir = createTempRepo({
      "src/process/index.ts": 'export { run } from "./runner.ts";\n',
      "src/process/runner.ts":
        'import { summarize } from "../summary/index.ts";\nexport const run = () => summarize();\n',
      "src/summary/index.ts": "export const summarize = () => 'done';\n",
    });

    const violations = analyzeArchitecture(repoDir, {
      dependencyPolicies: [
        {
          mayDependOn: [],
          name: "process",
          pathPrefixes: ["src/process"],
        },
        {
          mayDependOn: [],
          name: "summary",
          pathPrefixes: ["src/summary"],
        },
      ],
      rootDirectories: ["src"],
    });

    expect(
      violations.some((violation) => violation.code === "dependency-policy"),
    ).toBe(true);
  });

  test("uses configured shared-home names instead of hardcoded ones", () => {
    const repoDir = createTempRepo({
      "src/bar/index.ts":
        'import { shared } from "../foo/shared-types.ts";\nexport const read = () => shared;\n',
      "src/foo/index.ts": "export const foo = true;\n",
      "src/foo/shared-types.ts": "export const shared = 'feature';\n",
      "src/shared-types/index.ts": "export const canonical = 'root';\n",
    });

    const violations = analyzeArchitecture(repoDir, {
      rootDirectories: ["src"],
      sharedHomeNames: ["shared-types"],
    });

    expect(
      violations.some(
        (violation) => violation.code === "mixed-shared-types-home",
      ),
    ).toBe(true);
  });

  test("flags directories that exceed the configured depth budget", () => {
    const repoDir = createTempRepo({
      "src/a/b/c/d/index.ts": "export const value = 1;\n",
      "src/a/index.ts": 'export { value } from "./b/c/d/index.ts";\n',
    });

    const violations = analyzeArchitecture(repoDir, {
      maxDirectoryDepth: 3,
      rootDirectories: ["src"],
    });

    expect(
      violations.some(
        (violation) =>
          violation.code === "directory-depth" &&
          violation.message.includes("src/a/b/c/d"),
      ),
    ).toBe(true);
  });

  test("accepts grouped discovery and rule config", () => {
    const repoDir = createTempRepo({
      "src/a/b/c/d/index.ts": "export const value = 1;\n",
      "src/a/index.ts": 'export { value } from "./b/c/d/index.ts";\n',
    });

    const violations = analyzeArchitecture(repoDir, {
      discovery: {
        rootDirectories: ["src"],
      },
      rules: {
        "directory-depth": { maxDepth: 3 },
      },
    });

    expect(
      violations.some(
        (violation) =>
          violation.code === "directory-depth" &&
          violation.message.includes("src/a/b/c/d"),
      ),
    ).toBe(true);
  });

  test("flags wildcard exports on explicit public surfaces", () => {
    const repoDir = createTempRepo({
      "src/check.ts": 'export * from "./types/index.ts";\n',
      "src/types/index.ts": "export const value = 1;\n",
    });

    const violations = analyzeArchitecture(repoDir, {
      explicitPublicSurfacePaths: ["src/check.ts"],
      maxWildcardExportsPerPublicSurface: 0,
      rootDirectories: ["src"],
    });

    expect(
      violations.some(
        (violation) => violation.code === "public-surface-wildcard-export",
      ),
    ).toBe(true);
  });

  test("flags impure explicit public surfaces", () => {
    const repoDir = createTempRepo({
      "src/check.ts": "const value = 1;\nexport { value };\n",
    });

    const violations = analyzeArchitecture(repoDir, {
      explicitPublicSurfacePaths: ["src/check.ts"],
      rootDirectories: ["src"],
    });

    expect(
      violations.some(
        (violation) => violation.code === "public-surface-purity",
      ),
    ).toBe(true);
  });

  test("accepts implementation entrypoints that explicitly allow sibling surfaces", () => {
    const repoDir = createTempRepo({
      "src/app/api/feeds/route.ts":
        "export async function GET() { return Response.json({ ok: true }); }\n",
      "src/app/dashboard/page.tsx":
        "export default function DashboardPage() { return <main>dashboard</main>; }\n",
      "src/app/global-error.tsx":
        "export default function GlobalError() { return <main>error</main>; }\n",
      "src/app/layout.tsx":
        "export default function Layout({ children }: { children: React.ReactNode }) { return children; }\n",
      "src/app/not-found.tsx":
        "export default function NotFound() { return <main>missing</main>; }\n",
      "src/app/page.tsx":
        "export default function Page() { return <main>home</main>; }\n",
    });

    const violations = analyzeArchitecture(repoDir, {
      dependencyPolicies: [],
      entrypointNames: [
        "global-error",
        "layout",
        "not-found",
        "page",
        "route",
      ],
      entrypointRules: [
        {
          allowSiblingEntrypoints: true,
          allowTopLevelStatements: true,
          name: "global-error",
        },
        {
          allowSiblingEntrypoints: true,
          allowTopLevelStatements: true,
          name: "layout",
        },
        {
          allowSiblingEntrypoints: true,
          allowTopLevelStatements: true,
          name: "not-found",
        },
        {
          allowSiblingEntrypoints: true,
          allowTopLevelStatements: true,
          name: "page",
        },
        {
          allowSiblingEntrypoints: true,
          allowTopLevelStatements: true,
          name: "route",
        },
      ],
      requireAcyclicDependencyPolicies: false,
      requireCompleteDependencyPolicyCoverage: false,
      rootDirectories: ["src"],
    });

    expect(
      violations.some((violation) =>
        [
          "missing-public-entrypoint",
          "multiple-entrypoints",
          "public-surface-purity",
        ].includes(violation.code),
      ),
    ).toBe(false);
  });

  test("ignores namespace-only peers when checking boundary consistency", () => {
    const repoDir = createTempRepo({
      "src/app/api/account/route.ts": "export async function GET() { return Response.json({ ok: true }); }\n",
      "src/app/api/auth/login/route.ts": "export async function POST() { return Response.json({ ok: true }); }\n",
      "src/app/components/Card.tsx": "export function Card() { return null; }\n",
      "src/app/components/index.ts": 'export { Card } from "./Card.tsx";\n',
      "src/app/dashboard/page.tsx": "export default function DashboardPage() { return null; }\n",
      "src/app/layout.tsx": "export default function Layout({ children }: { children: React.ReactNode }) { return children; }\n",
      "src/app/page.tsx": "export default function Page() { return null; }\n",
    });

    const entrypointRules = [
      "index",
      "layout",
      "page",
      "route",
    ].map((name) => ({
      allowSiblingEntrypoints: name !== "index",
      allowTopLevelStatements: name !== "index",
      name,
    }));

    const violations = analyzeArchitecture(repoDir, {
      dependencyPolicies: [],
      entrypointNames: entrypointRules.map((entrypointRule) => entrypointRule.name),
      entrypointRules,
      requireAcyclicDependencyPolicies: false,
      requireCompleteDependencyPolicyCoverage: false,
      rootDirectories: ["src"],
    });

    expect(
      violations.some(
        (violation) => violation.code === "peer-boundary-inconsistency",
      ),
    ).toBe(false);
  });

  test("flags public-surface re-export chains across top-level owners", () => {
    const repoDir = createTempRepo({
      "src/check.ts": 'export { runCli } from "./cli/index.ts";\n',
      "src/cli/index.ts": 'export { runCli } from "./runner.ts";\n',
      "src/cli/runner.ts": "export const runCli = () => true;\n",
    });

    const violations = analyzeArchitecture(repoDir, {
      allowPublicSurfaceReExportChains: false,
      explicitPublicSurfacePaths: ["src/check.ts"],
      rootDirectories: ["src"],
    });

    expect(
      violations.some(
        (violation) => violation.code === "public-surface-re-export-chain",
      ),
    ).toBe(true);
  });

  test("flags runtime operations outside allowed runtime modules", () => {
    const repoDir = createTempRepo({
      "src/inline-ts/runtime.ts":
        "const cwd = process.cwd();\nexport { cwd };\n",
    });

    const violations = analyzeArchitecture(repoDir, {
      rootDirectories: ["src"],
    });

    expect(
      violations.some((violation) => violation.code === "runtime-only-path"),
    ).toBe(true);
  });

  test("flags uncovered top-level directories when policy coverage is required", () => {
    const repoDir = createTempRepo({
      "src/cli/index.ts": "export const runCli = () => true;\n",
    });

    const violations = analyzeArchitecture(repoDir, {
      dependencyPolicies: [],
      requireCompleteDependencyPolicyCoverage: true,
      rootDirectories: ["src"],
    });

    expect(
      violations.some(
        (violation) => violation.code === "dependency-policy-coverage",
      ),
    ).toBe(true);
  });

  test("flags dependency policy cycles when owner graphs must stay acyclic", () => {
    const repoDir = createTempRepo({
      "src/a/index.ts": 'export { a } from "./runner.ts";\n',
      "src/a/runner.ts":
        'import { b } from "../b/index.ts";\nexport const a = () => b();\n',
      "src/b/index.ts": 'export { b } from "./runner.ts";\n',
      "src/b/runner.ts":
        'import { a } from "../a/index.ts";\nexport const b = () => a();\n',
    });

    const violations = analyzeArchitecture(repoDir, {
      dependencyPolicies: [
        { mayDependOn: ["b"], name: "a", pathPrefixes: ["src/a"] },
        { mayDependOn: ["a"], name: "b", pathPrefixes: ["src/b"] },
      ],
      requireAcyclicDependencyPolicies: true,
      rootDirectories: ["src"],
    });

    expect(
      violations.some(
        (violation) => violation.code === "dependency-policy-cycle",
      ),
    ).toBe(true);
  });

  test("flags owner fan-out beyond the configured budget", () => {
    const repoDir = createTempRepo({
      "src/a/index.ts": 'export { a } from "./runner.ts";\n',
      "src/a/runner.ts": [
        'import { b } from "../b/index.ts";',
        'import { c } from "../c/index.ts";',
        'import { d } from "../d/index.ts";',
        "export const a = () => [b(), c(), d()];",
        "",
      ].join("\n"),
      "src/b/index.ts": "export const b = () => true;\n",
      "src/c/index.ts": "export const c = () => true;\n",
      "src/d/index.ts": "export const d = () => true;\n",
    });

    const violations = analyzeArchitecture(repoDir, {
      dependencyPolicies: [
        { mayDependOn: ["b", "c", "d"], name: "a", pathPrefixes: ["src/a"] },
        { mayDependOn: [], name: "b", pathPrefixes: ["src/b"] },
        { mayDependOn: [], name: "c", pathPrefixes: ["src/c"] },
        { mayDependOn: [], name: "d", pathPrefixes: ["src/d"] },
      ],
      maxPolicyFanOut: 2,
      rootDirectories: ["src"],
    });

    expect(
      violations.some(
        (violation) => violation.code === "dependency-policy-fan-out",
      ),
    ).toBe(true);
  });

  test("flags inbound dependency violations against target allowlists", () => {
    const repoDir = createTempRepo(createProcessToConfigRepo());

    const violations = analyzeArchitecture(repoDir, {
      dependencyPolicies: createProcessToConfigPolicies({
        configAllowedDependents: ["cli"],
      }),
      rootDirectories: ["src"],
    });

    expect(
      violations.some(
        (violation) => violation.code === "dependency-dependent-allowlist",
      ),
    ).toBe(true);
  });

  test("flags runtime-only imports from undeclared importer owners", () => {
    const repoDir = createTempRepo({
      ...createProcessToConfigRepo(),
      "src/process/runner.ts":
        'import { cfg } from "../runtime-config/index.ts";\nexport const run = () => cfg;\n',
      "src/runtime-config/index.ts": "export const cfg = process.cwd();\n",
    });

    const violations = analyzeArchitecture(repoDir, {
      dependencyPolicies: createProcessToConfigPolicies({
        allowedRuntimeImporters: ["config"],
      }),
      rootDirectories: ["src"],
    });

    expect(
      violations.some(
        (violation) => violation.code === "runtime-importer-allowlist",
      ),
    ).toBe(true);
  });

  test("flags value imports from type-only policies", () => {
    const repoDir = createTempRepo({
      "src/process/index.ts": 'export { run } from "./runner.ts";\n',
      "src/process/runner.ts":
        'import { Thing } from "../types/index.ts";\nexport const run = (input: Thing) => input;\n',
      "src/types/index.ts": "export interface Thing { value: string }\n",
    });

    const violations = analyzeArchitecture(repoDir, {
      dependencyPolicies: [
        {
          mayDependOn: ["types"],
          name: "process",
          pathPrefixes: ["src/process"],
        },
        {
          isTypeOnly: true,
          mayDependOn: [],
          name: "types",
          pathPrefixes: ["src/types"],
        },
      ],
      requireTypeOnlyImportsForTypeOnlyPolicies: true,
      rootDirectories: ["src"],
    });

    expect(
      violations.some(
        (violation) => violation.code === "type-only-policy-import",
      ),
    ).toBe(true);
  });

  test("flags explicit public surfaces that are not owned by public-tier policies", () => {
    const repoDir = createTempRepo({
      "src/check.ts": 'export { run } from "./process/index.ts";\n',
      "src/process/index.ts": "export const run = () => true;\n",
    });

    const violations = analyzeArchitecture(repoDir, {
      dependencyPolicies: [
        {
          mayDependOn: ["process"],
          name: "public-api",
          pathPrefixes: ["src/check.ts"],
          surfaceTier: "internal-public",
        },
        {
          mayDependOn: [],
          name: "process",
          pathPrefixes: ["src/process"],
          surfaceTier: "internal-public",
        },
      ],
      explicitPublicSurfacePaths: ["src/check.ts"],
      rootDirectories: ["src"],
    });

    expect(
      violations.some((violation) => violation.code === "public-surface-tier"),
    ).toBe(true);
  });
});

/** Builds a reusable policy graph for tests that exercise inbound allowlists. */
function createProcessToConfigPolicies(overrides: {
  allowedRuntimeImporters?: string[];
  configAllowedDependents?: string[];
}): {
  allowedDependents?: string[];
  allowedRuntimeImporters?: string[];
  mayDependOn: string[];
  name: string;
  pathPrefixes: string[];
  surfaceTier?: "internal-public" | "private-runtime";
}[] {
  return [
    {
      mayDependOn: ["config", "runtime-config"],
      name: "process",
      pathPrefixes: ["src/process"],
      surfaceTier: "internal-public",
    },
    {
      allowedDependents: overrides.configAllowedDependents,
      mayDependOn: [],
      name: "config",
      pathPrefixes: ["src/config"],
      surfaceTier: "internal-public",
    },
    {
      allowedRuntimeImporters: overrides.allowedRuntimeImporters,
      mayDependOn: ["config"],
      name: "runtime-config",
      pathPrefixes: ["src/runtime-config"],
      surfaceTier: "private-runtime",
    },
  ];
}

/** Creates a minimal process-to-config repository fixture shared by multiple tests. */
function createProcessToConfigRepo(): Record<string, string> {
  return {
    "src/config/index.ts": "export const config = true;\n",
    "src/process/index.ts": 'export { run } from "./runner.ts";\n',
    "src/process/runner.ts":
      'import { config } from "../config/index.ts";\nexport const run = () => config;\n',
  };
}
