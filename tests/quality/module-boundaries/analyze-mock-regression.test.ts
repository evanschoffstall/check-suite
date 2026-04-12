import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dir, "../../..");

const isolatedScenarioPreamble = String.raw`
import { mock } from "bun:test";
import type {
  ArchitectureAnalyzerConfig,
  ArchitectureProject,
  ArchitectureViolation,
  ImportRecord,
} from "@/quality/module-boundaries/foundation/index.ts";

function createViolation(code: string, message: string): ArchitectureViolation {
  return { code, message };
}

function createArchitectureProject(
  overrides: Partial<ArchitectureProject> = {},
): ArchitectureProject {
  const defaultConfig: Required<ArchitectureAnalyzerConfig> = {
    allowedImpurePublicSurfacePaths: [],
    allowedRootFileStems: [],
    allowPublicSurfaceReExportChains: false,
    centralSurfacePathPrefixes: [],
    codeTargets: {
      declarationFilePatterns: ["**/*.d.ts"],
      includePatterns: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx", "**/*.mjs", "**/*.cjs"],
      resolutionEntrypointNames: ["index", "main", "mod"],
      resolutionExtensions: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"],
      testFilePatterns: ["**/*.spec.*", "**/*.test.*"],
    },
    dependencyPolicies: [],
    entrypointNames: ["index"],
    explicitPublicSurfacePaths: [],
    ignoredDirectories: [],
    junkDrawerDirectoryNames: [],
    junkDrawerFileNamePatterns: [],
    junkDrawerFileStems: [],
    layerGroups: [],
    maxCentralSurfaceExports: 0,
    maxDirectoryDepth: 3,
    maxEntrypointReExports: 0,
    maxInternalImportsPerFile: 1,
    maxPolicyFanOut: 5,
    maxSiblingImports: 1,
    maxWildcardExportsPerPublicSurface: 0,
    minRepeatedDeepImports: 2,
    requireAcyclicDependencyPolicies: false,
    requireCompleteDependencyPolicyCoverage: false,
    requireTypeOnlyImportsForTypeOnlyPolicies: false,
    rootDirectories: ["src"],
    sharedHomeNames: ["types"],
    testDirectories: ["**/tests"],
  };

  return {
    aliasMappings: [],
    boundaries: [],
    codeRoots: {
      directories: ["src"],
      files: [],
    },
    config: {
      ...defaultConfig,
      ...overrides.config,
    },
    directories: [],
    directoryFacts: [],
    files: [],
    imports: [],
    sourceFacts: [],
    ...overrides,
  };
}
`;

/**
 * Runs a mock-heavy architecture scenario inside an isolated Bun subprocess so
 * global mock.module state cannot leak into parallel test files.
 */
async function runIsolatedScenario<TResult>(
  scenarioBody: string,
): Promise<TResult> {
  const process = Bun.spawn({
    cmd: ["bun", "--eval", `${isolatedScenarioPreamble}\n${scenarioBody}`],
    cwd: repoRoot,
    stderr: "pipe",
    stdout: "pipe",
  });

  const [stderr, stdout, exitCode] = await Promise.all([
    new Response(process.stderr).text(),
    new Response(process.stdout).text(),
    process.exited,
  ]);

  if (exitCode !== 0) {
    throw new Error(
      `Isolated scenario failed with exit code ${exitCode}\n${stderr}`,
    );
  }

  return JSON.parse(stdout) as TResult;
}

describe("architecture mock regressions", () => {
  test("analyzeArchitecture normalizes discovery input and returns sorted unique rule output", async () => {
    const result = await runIsolatedScenario<{
      discoveryCalls: { config: unknown; cwd: string }[];
      importProjectMatched: boolean;
      normalizeCalls: unknown[];
      structureProjectMatched: boolean;
      violations: { code: string; message: string }[];
    }>(String.raw`
const rawConfig = { rootDirectories: ["src"] };
const normalizedConfig = { rootDirectories: ["source"] };
const project = createArchitectureProject();
const importViolation = createViolation("import-rule", "zeta import message");
const sharedViolation = createViolation("shared-rule", "middle shared message");
const structureViolation = createViolation("structure-rule", "alpha structure message");
const discoveryCalls: Array<{ config: unknown; cwd: string }> = [];
const importCalls: ArchitectureProject[] = [];
const normalizeCalls: unknown[] = [];
const structureCalls: ArchitectureProject[] = [];

mock.module("@/quality/module-boundaries/discovery/index.ts", () => ({
  discoverArchitectureProject: (cwd: string, config: unknown): ArchitectureProject => {
    discoveryCalls.push({ config, cwd });
    return project;
  },
  normalizeArchitectureConfig: (configValue: unknown): unknown => {
    normalizeCalls.push(configValue);
    return normalizedConfig;
  },
}));
mock.module("@/quality/module-boundaries/import/index.ts", () => ({
  analyzeImportRules: (candidateProject: ArchitectureProject): ArchitectureViolation[] => {
    importCalls.push(candidateProject);
    return [importViolation, sharedViolation];
  },
}));
mock.module("@/quality/module-boundaries/structure/index.ts", () => ({
  analyzeStructureRules: (candidateProject: ArchitectureProject): ArchitectureViolation[] => {
    structureCalls.push(candidateProject);
    return [sharedViolation, structureViolation];
  },
}));

const { analyzeArchitecture } = await import("@/quality/module-boundaries/analyze.ts?scenario=orchestrator");
const violations = analyzeArchitecture("/repo", rawConfig);

console.log(JSON.stringify({
  discoveryCalls,
  importProjectMatched: importCalls[0] === project,
  normalizeCalls,
  structureProjectMatched: structureCalls[0] === project,
  violations,
}));
`);

    expect(result.normalizeCalls).toEqual([
      { rootDirectories: ["src"] },
    ]);
    expect(result.discoveryCalls).toEqual([
      {
        config: { rootDirectories: ["source"] },
        cwd: "/repo",
      },
    ]);
    expect(result.importProjectMatched).toBe(true);
    expect(result.structureProjectMatched).toBe(true);
    expect(result.violations).toEqual([
      { code: "structure-rule", message: "alpha structure message" },
      { code: "shared-rule", message: "middle shared message" },
      { code: "import-rule", message: "zeta import message" },
    ]);
  });

  test("analyzeImportRules shares repeated deep import state across entries before deduping", async () => {
    const result = await runIsolatedScenario<{
      repeatedMapWasShared: boolean;
      seenSources: string[];
      violations: { code: string; message: string }[];
    }>(String.raw`
const sharedTargetPath = "src/shared/internal.ts";
const repeatedMapReferences: Array<Map<string, Set<string>>> = [];
const seenSources: string[] = [];
const duplicateViolation = createViolation("duplicate-rule", "duplicate message");
const project = createArchitectureProject({
  imports: [
    {
      isReExport: false,
      isSideEffectOnly: false,
      isTypeOnly: false,
      resolvedPath: sharedTargetPath,
      sourcePath: "src/process/a.ts",
      specifier: "../shared/internal.ts",
    },
    {
      isReExport: false,
      isSideEffectOnly: false,
      isTypeOnly: false,
      resolvedPath: sharedTargetPath,
      sourcePath: "src/process/b.ts",
      specifier: "../shared/internal.ts",
    },
  ] satisfies ImportRecord[],
});

mock.module("@/quality/module-boundaries/import/rule/index.ts", () => ({
  buildImportEntryViolations: (
    _project: ArchitectureProject,
    entry: ImportRecord,
    repeatedDeepImports: Map<string, Set<string>>,
  ): ArchitectureViolation[] => {
    repeatedMapReferences.push(repeatedDeepImports);
    seenSources.push(entry.sourcePath);
    const sources = repeatedDeepImports.get(sharedTargetPath) ?? new Set<string>();
    sources.add(entry.sourcePath);
    repeatedDeepImports.set(sharedTargetPath, sources);

    return [
      duplicateViolation,
      createViolation("entry-" + entry.sourcePath, "entry " + entry.sourcePath),
    ];
  },
  collectInternalImports: (): Map<string, Set<string>> =>
    new Map([
      [
        "src/process/a.ts",
        new Set(["src/process/internal-one.ts", "src/process/internal-two.ts"]),
      ],
    ]),
  collectSiblingImports: (): Map<string, Set<string>> =>
    new Map([
      [
        "src/process/b.ts",
        new Set(["src/process/c.ts", "src/process/d.ts"]),
      ],
    ]),
}));

const { analyzeImportRules } = await import("@/quality/module-boundaries/import/analysis.ts?scenario=imports");
const violations = analyzeImportRules(project);

console.log(JSON.stringify({
  repeatedMapWasShared: repeatedMapReferences[0] === repeatedMapReferences[1],
  seenSources,
  violations,
}));
`);

    expect(result.seenSources).toEqual([
      "src/process/a.ts",
      "src/process/b.ts",
    ]);
    expect(result.repeatedMapWasShared).toBe(true);
    expect(result.violations).toEqual([
      { code: "duplicate-rule", message: "duplicate message" },
      { code: "entry-src/process/a.ts", message: "entry src/process/a.ts" },
      { code: "entry-src/process/b.ts", message: "entry src/process/b.ts" },
      {
        code: "repeated-deep-import",
        message:
          "src/shared/internal.ts is imported directly from 2 files; expose a stable public surface instead of repeating internal imports",
      },
      {
        code: "sibling-import-cohesion",
        message:
          "src/process/b.ts imports 2 sibling modules; extract a smaller owner or move shared code to the actual boundary",
      },
      {
        code: "too-many-internal-dependencies",
        message:
          "src/process/a.ts imports 2 internal modules; split responsibilities or move shared code behind a smaller public seam",
      },
    ]);
  });

  test("analyzeStructureRules wires sibling-layout and policy builders with normalized parent facts", async () => {
    const result = await runIsolatedScenario<{
      directoryFactsByPathChecks: boolean[];
      flattenedFeatureEntrypointCalls: string[][];
      mixedTypeCalls: string[][];
      sameNameCalls: {
        directories: string[];
        files: string[];
        parentPath: string;
      }[];
      violations: { code: string; message: string }[];
    }>(String.raw`
const siblingDirectories = new Set(["process"]);
const siblingFiles = ["process.ts"];
const parentPath = "src";
const duplicateViolation = createViolation("duplicate-rule", "duplicate message");
const directoryFactViolation = createViolation("directory-fact", "directory fact message");
const siblingLayoutViolation = createViolation("same-name-file-directory", "same-name message");
const policyViolation = createViolation("dependency-policy-coverage", "coverage message");
const directoryFactsByPathChecks: boolean[] = [];
const flattenedFeatureEntrypointCalls: string[][] = [];
const mixedTypeCalls: string[][] = [];
const sameNameCalls: Array<{ directories: string[]; files: string[]; parentPath: string }> = [];
const project = createArchitectureProject({
  config: {
    ...createArchitectureProject().config,
    entrypointNames: ["index", "mod"],
    sharedHomeNames: ["shared-types"],
  },
  directoryFacts: [
    {
      childDirectoryPaths: ["src/process/internal"],
      codeFilePaths: ["src/process/index.ts"],
      entrypointPaths: ["src/process/index.ts"],
      path: "src/process",
    },
  ],
  files: ["src/process.ts"],
});

mock.module("@/quality/module-boundaries/structure/rule/index.ts", () => ({
  buildBroadBarrelViolations: (): ArchitectureViolation[] => [duplicateViolation],
  buildCentralSurfaceBudgetViolations: (): ArchitectureViolation[] => [],
  buildDependencyPolicyCoverageViolations: (): ArchitectureViolation[] => [policyViolation],
  buildDependencyPolicyCycleViolations: (): ArchitectureViolation[] => [],
  buildDirectoryDepthViolations: (): ArchitectureViolation[] => [],
  buildDirectoryFactViolations: (): ArchitectureViolation[] => [directoryFactViolation],
  buildFlattenedFeatureViolations: (
    _parentPath: string,
    _siblingDirectories: Set<string>,
    _siblingFiles: string[],
    entrypointNames: string[],
  ): ArchitectureViolation[] => {
    flattenedFeatureEntrypointCalls.push(entrypointNames);
    return [];
  },
  buildJunkDrawerViolations: (): ArchitectureViolation[] => [],
  buildMixedFileNameCaseViolations: (): ArchitectureViolation[] => [],
  buildMultipleEntrypointViolations: (): ArchitectureViolation[] => [],
  buildMixedTypesViolations: (sharedHomeNames: string[]): ArchitectureViolation[] => {
    mixedTypeCalls.push(sharedHomeNames);
    return [duplicateViolation];
  },
  buildPeerBoundaryConsistencyViolations: (
    _parentPath: string,
    _siblingDirectories: Set<string>,
    directoryFactsByPath: Map<string, { path: string }>,
  ): ArchitectureViolation[] => {
    directoryFactsByPathChecks.push(directoryFactsByPath.has("src/process"));
    return [];
  },
  buildPolicyFanOutViolations: (): ArchitectureViolation[] => [],
  buildPublicSurfacePurityViolations: (): ArchitectureViolation[] => [],
  buildPublicSurfaceReExportChainViolations: (): ArchitectureViolation[] => [],
  buildPublicSurfaceTierViolations: (): ArchitectureViolation[] => [],
  buildRootFileOwnershipViolations: (): ArchitectureViolation[] => [],
  buildRuntimeOnlyPathViolations: (): ArchitectureViolation[] => [],
  buildSameNameFileDirectoryViolations: (
    currentParentPath: string,
    currentSiblingDirectories: Set<string>,
    currentSiblingFiles: string[],
  ): ArchitectureViolation[] => {
    sameNameCalls.push({
      directories: [...currentSiblingDirectories],
      files: currentSiblingFiles,
      parentPath: currentParentPath,
    });
    return [siblingLayoutViolation];
  },
  buildScatteredFeatureHomeViolations: (): ArchitectureViolation[] => [],
  buildSplitHomeViolations: (): ArchitectureViolation[] => [],
  buildWildcardExportViolations: (): ArchitectureViolation[] => [],
  collectSiblingsByParent: (): {
    directoriesByParent: Map<string, Set<string>>;
    filesByParent: Map<string, string[]>;
  } => ({
    directoriesByParent: new Map([[parentPath, siblingDirectories]]),
    filesByParent: new Map([[parentPath, siblingFiles]]),
  }),
}));

const { analyzeStructureRules } = await import("@/quality/module-boundaries/structure/analysis.ts?scenario=structure");
const violations = analyzeStructureRules(project);

console.log(JSON.stringify({
  directoryFactsByPathChecks,
  flattenedFeatureEntrypointCalls,
  mixedTypeCalls,
  sameNameCalls,
  violations,
}));
`);

    expect(result.sameNameCalls).toEqual([
      {
        directories: ["process"],
        files: ["process.ts"],
        parentPath: "src",
      },
    ]);
    expect(result.flattenedFeatureEntrypointCalls).toEqual([["index", "mod"]]);
    expect(result.mixedTypeCalls).toEqual([["shared-types"]]);
    expect(result.directoryFactsByPathChecks).toEqual([true]);
    expect(result.violations).toEqual([
      { code: "directory-fact", message: "directory fact message" },
      { code: "duplicate-rule", message: "duplicate message" },
      { code: "same-name-file-directory", message: "same-name message" },
      { code: "dependency-policy-coverage", message: "coverage message" },
    ]);
  });

  test("fresh analyzer imports can swap to a new mocked dependency graph in one isolated run", async () => {
    const result = await runIsolatedScenario<{
      firstViolations: { code: string; message: string }[];
      secondViolations: { code: string; message: string }[];
    }>(String.raw`
const firstProject = createArchitectureProject({ directories: ["src/first"] });
const secondProject = createArchitectureProject({ directories: ["src/second"] });

mock.module("@/quality/module-boundaries/discovery/index.ts", () => ({
  discoverArchitectureProject: (): ArchitectureProject => firstProject,
  normalizeArchitectureConfig: (configValue: unknown): unknown => configValue,
}));
mock.module("@/quality/module-boundaries/import/index.ts", () => ({
  analyzeImportRules: (): ArchitectureViolation[] => [
    createViolation("first-import", "first import message"),
  ],
}));
mock.module("@/quality/module-boundaries/structure/index.ts", () => ({
  analyzeStructureRules: (): ArchitectureViolation[] => [
    createViolation("first-structure", "first structure message"),
  ],
}));

const firstModule = await import("@/quality/module-boundaries/analyze.ts?scenario=swap-first");
const firstViolations = firstModule.analyzeArchitecture("/repo-one", {
  rootDirectories: ["src"],
});

mock.restore();

mock.module("@/quality/module-boundaries/discovery/index.ts", () => ({
  discoverArchitectureProject: (): ArchitectureProject => secondProject,
  normalizeArchitectureConfig: (configValue: unknown): unknown => configValue,
}));
mock.module("@/quality/module-boundaries/import/index.ts", () => ({
  analyzeImportRules: (): ArchitectureViolation[] => [
    createViolation("second-import", "second import message"),
  ],
}));
mock.module("@/quality/module-boundaries/structure/index.ts", () => ({
  analyzeStructureRules: (): ArchitectureViolation[] => [
    createViolation("second-structure", "second structure message"),
  ],
}));

const secondModule = await import("@/quality/module-boundaries/analyze.ts?scenario=swap-second");
const secondViolations = secondModule.analyzeArchitecture("/repo-two", {
  rootDirectories: ["src"],
});

console.log(JSON.stringify({ firstViolations, secondViolations }));
`);

    expect(result.firstViolations).toEqual([
      { code: "first-import", message: "first import message" },
      { code: "first-structure", message: "first structure message" },
    ]);
    expect(result.secondViolations).toEqual([
      { code: "second-import", message: "second import message" },
      { code: "second-structure", message: "second structure message" },
    ]);
  });
});