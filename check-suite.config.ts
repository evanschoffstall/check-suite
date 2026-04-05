import type { TestCoveragePostProcessOptions } from "check-suite/post-process";
import type { LizardConfig } from "check-suite/quality";
import type { CoverageOptions } from "check-suite/recipes";
import type { GitFileScanOptions } from "check-suite/step";
import type { Command, InlineTypeScriptContext, Summary } from "check-suite/types";

import { hasPackageScript } from "check-suite/config";
import { defineCheckSuiteConfig } from "check-suite/config-schema";
import {
  analyzeArchitecture,
  analyzePurgeCss,
  discoverDefaultCodeRoots,
  formatArchitectureViolations,
  formatUnusedSelectorOutput,
  inferAllowedRootFileStems,
  inferCentralSurfacePathPrefixes,
  inferDependencyPolicies,
  inferEntrypointNames,
  inferExplicitPublicSurfacePaths,
  parseBunConsoleCoverage,
  readPurgeCssConfig,
  runDependencyCruiserCheck,
  runLizardCheck,
} from "check-suite/quality";
import { defineCoverageCommandStep } from "check-suite/recipes";
import { defineCommandStep, defineInlineStep, defineLintStep, runGitFileScan } from "check-suite/step";

// ── Tool-specific summary patterns (config-owned, not platform-owned) ─────────
type PatternSummary = Extract<Summary, { type: "pattern" }>;
const pat = (d: string, ps: PatternSummary["patterns"]): Summary => ({ default: d, patterns: ps, type: "pattern" });
const lintSummary     = pat("", [{ format: "{1} problems ({2} errors, {3} warnings)", regex: "[✖xX]\\s+(\\d+)\\s+problems?\\s*\\((\\d+)\\s+errors?,\\s*(\\d+)\\s+warnings?\\)", type: "match" }]);
const typeSummary     = pat("", [{ format: "{count} TypeScript errors", regex: ":\\s+error\\s+TS\\d+:", type: "count" }]);
const coverageSummary = pat("type coverage completed", [{ format: "{3}% ({1}/{2}) · threshold {typeCoverageThreshold}%", regex: "\\((\\d+)\\s*/\\s*(\\d+)\\)\\s*([\\d.]+)%", type: "match" }]);
const depCruiserSummary = pat("dependency cruise completed", [{ format: "0 dependency violations · {1} modules · {2} dependencies", regex: "no dependency violations found \\((\\d+) modules, (\\d+) dependencies cruised\\)", type: "match" }]);
const lizardSummary   = pat("complexity check completed", [{ format: "{1} function violations · {2} file violations", regex: "complexity:\\s+(\\d+)\\s+function violations\\s+·\\s+(\\d+)\\s+file violations", type: "match" }]);
const madgeSummary    = pat("circular dependency check completed", [{ format: "0 circular dependencies", regex: "No circular dependency found", type: "literal" }, { format: "{1} circular dependencies", regex: "Found\\s+(\\d+)\\s+circular\\s+dependenc", type: "match" }]);
const jscpdSummary    = pat("no duplicate stats detected", [{ cellSep: "│", format: "{4} clones · {5} lines · {6} tokens · {1} files", regex: "│ Total:", type: "table-row" }, { format: "{1} clones", regex: "Found\\s+(\\d+)\\s+clones?", type: "match" }]);

// ── Auto-discovered source directories ─────
const { directories: discoveredCodeRoots } = discoverDefaultCodeRoots(process.cwd());

/**
 * Prefer the conventional src root when present so repo-local test trees do
 * not become scan targets for source-only quality checks.
 */
function selectSourceDirectories(directories: string[]): string[] {
  return directories.includes("src") ? ["src"] : directories;
}

const srcDirs = selectSourceDirectories(discoveredCodeRoots);

const typeCoverageThreshold = 98;
const junitLineCoverageThreshold = 85;
const playwrightLineCoverageThreshold = 55;
const testTimeoutMs = 5000;
const junitCoverageTimeoutMs = 120000;
const playwrightCoverageTimeoutMs = 180000;
const playwrightCoverageTimeoutDrainMs = 20000;

const lizardThresholds: LizardConfig["thresholds"] = {
  fileCcn: 60,
  fileFunctionCount: 15,
  fileNloc: 450,
  fileTokenCount: 2200,
  functionCcn: 10,
  functionLength: 80,
  functionNestingDepth: 4,
  functionNloc: 60,
  functionParameterCount: 6,
  functionTokenCount: 240,
};

const lizardConfig: LizardConfig = {
  excludedPaths: ["src/components/ui/*"],
  targets: srcDirs,
  thresholds: lizardThresholds,
};

const lizardStepData = lizardConfig as Record<string, unknown>;

// ── Coverage step factory ─────────────────────────────────────────────────────
const coverage = (
  key: string,
  args: string[],
  data: CoverageOptions,
  defaultThreshold: number,
  options: {
    enabled?: boolean;
    failMsg?: string;
    parseConsoleCoverage?: TestCoveragePostProcessOptions["parseConsoleCoverage"];
    reportDirs?: string[];
    timeoutDrainMs?: number | string;
    timeoutEnvVar?: string;
    timeoutMs?: number | string;
    tokens?: Record<string, number | string>;
  } = {},
) => defineCoverageCommandStep({
  allowSuiteFlagArgs: key === "junit",
  args,
  cmd: "bun",
  coverage: data,
  defaultThreshold,
  enabled: options.enabled,
  ensureDirs: options.reportDirs,
  failMsg: options.failMsg,
  key,
  label: key,
  parseConsoleCoverage: options.parseConsoleCoverage,
  serialGroup: "coverage-tests",
  timeoutDrainMs: options.timeoutDrainMs,
  timeoutEnvVar: options.timeoutEnvVar,
  timeoutMs: options.timeoutMs,
  tokens: options.tokens,
});

const discoveryBase = {
  ignoredDirectoryNames: [".cache", ".git", ".idea", ".next", ".turbo", ".vscode", "build", "coverage", "dist", "node_modules", "out", "scripts", "tmp"],
  maxPolicyFanOut: 5,
  rootDirectories: srcDirs,
  testDirectoryNames: ["__fixtures__", "__mocks__", "__tests__", "fixtures", "mocks", "test", "tests"],
  vendorManagedDirectoryNames: ["__generated__", "generated", "vendor"],
};

const entrypointNames          = inferEntrypointNames(process.cwd(), discoveryBase);
const allowedRootFileStems     = inferAllowedRootFileStems(process.cwd(), { ...discoveryBase, entrypointNames });
const explicitPublicSurfacePaths = inferExplicitPublicSurfacePaths(process.cwd(), { ...discoveryBase, allowedRootFileStems, entrypointNames });

const boundaryDiscovery = {
  ...discoveryBase,
  allowedRootFileStems,
  entrypointNames,
  explicitPublicSurfacePaths,
};

const architecture = {
  ...boundaryDiscovery,
  allowPublicSurfaceReExportChains: false,
  centralSurfacePathPrefixes: inferCentralSurfacePathPrefixes(process.cwd(), boundaryDiscovery),
  dependencyPolicies: inferDependencyPolicies(process.cwd(), boundaryDiscovery),
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
};

export default defineCheckSuiteConfig({
  paths: { junitPath: "coverage/test-results.xml", lcovPath: "coverage/lcov.info", playwrightJunitPath: "coverage/playwright-junit.xml", playwrightLcovPath: "coverage/playwright/lcov.info" },
  steps: [
    defineCommandStep({ args: ["knip", "--config", "knip.json", "--cache"], cmd: "bunx", failMsg: "knip failed", key: "knip", label: "knip" }),
    defineCommandStep({ args: ["madge@8", "--circular", "--extensions", "ts,tsx", ...srcDirs], cmd: "bunx", failMsg: "circular dependencies found", key: "madge", label: "madge", outputFilter: { pattern: "\\b\\d+\\s+warnings?\\b", type: "stripLines" }, summary: madgeSummary }),
    defineInlineStep({ failMsg: "dependency violations found", key: "dependency-cruiser", label: "dependency-cruiser", source: async ({ cwd, existsSync, fail, ok }: InlineTypeScriptContext) => { const result = await runDependencyCruiserCheck(cwd, existsSync); return result.exitCode === 0 ? ok(result.output) : fail(result.output); }, summary: depCruiserSummary }),
    defineInlineStep({ data: architecture as Record<string, unknown>, failMsg: "architecture violations found", key: "architecture", label: "architecture", source: ({ cwd, data, fail, ok }: InlineTypeScriptContext): Command => { const violations = analyzeArchitecture(cwd, data); const output = formatArchitectureViolations(violations); return violations.length === 0 ? ok(output) : fail(output); } }),
    defineInlineStep({ data: { contentGlobs: ["src/components/components.css"], cssFiles: ["src/app/globals.css"], safelists: ["^dark$", "^motion-profile-"], selectorPrefix: "." }, failMsg: "unused CSS selectors found", key: "purgecss", label: "purgecss", source: async ({ cwd, data, fail, importModule, join, ok }: InlineTypeScriptContext) => { const config = readPurgeCssConfig(data); if (!config) return fail("purgecss config is invalid\n"); const result = await analyzePurgeCss({ config, cwd, importModule, joinPath: join }); if (result.kind === "invalid-safelist") return fail(result.message); return result.unusedSelectors.length === 0 ? ok("no unused CSS selectors found\n") : fail(formatUnusedSelectorOutput(result.unusedSelectors)); } }),
    defineCommandStep({ args: ["tsd", "--typings", "next-env.d.ts", "--files", "next-env.test-d.ts"], cmd: "bunx", failMsg: "tsd failed", key: "tsd", label: "tsd" }),
    defineInlineStep({ failMsg: "secretlint failed", key: "secretlint", label: "secretlint", source: ({ cwd }: InlineTypeScriptContext) => runGitFileScan(cwd, { command: "bunx", fallbackArgs: ["secretlint", "**/*", "--secretlintignore", ".secretlintignore"], fileArgs: ["secretlint", "--no-glob", "--secretlintignore", ".secretlintignore"], noFilesMessage: "No tracked or non-ignored files matched for secretlint\n" } satisfies GitFileScanOptions) }),
    defineCommandStep({ args: ["audit"], cmd: "bun", failMsg: "bun audit failed", key: "audit", label: "audit" }),
    defineCommandStep({ args: ["scan", "--config", "p/default", "--error", "--metrics", "off", "--exclude=tests", "--exclude=src/components/ui", "--exclude-rule=javascript.lang.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml", "--exclude-rule=typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml", "--exclude-rule=problem-based-packs.insecure-transport.js-node.bypass-tls-verification.bypass-tls-verification", "--quiet", ...srcDirs], cmd: "semgrep", failMsg: "semgrep failed", key: "semgrep", label: "semgrep" }),
    defineCommandStep({ args: ["@0xts/gitleaks-cli", "detect", "-s", srcDirs[0] ?? ".", "--no-git", "-c", ".gitleaks.toml"], cmd: "bunx", failMsg: "gitleaks failed", key: "@0xts/gitleaks-cli", label: "@0xts/gitleaks-cli" }),
    defineCommandStep({ args: ["type-coverage", "--at-least", "{typeCoverageThreshold}", "--cache", "--cache-directory", ".cache/type-coverage"], cmd: "bunx", failMsg: "type coverage below threshold", key: "type-coverage", label: "type-coverage", summary: coverageSummary, tokens: { typeCoverageThreshold } }),
    defineInlineStep({ data: lizardStepData, failMsg: "complexity limits exceeded", key: "lizard", label: "lizard", source: ({ data, fail, ok }: InlineTypeScriptContext): Command => { const result = runLizardCheck(data as LizardConfig); return result.exitCode === 0 ? ok(result.output) : fail(result.output); }, summary: lizardSummary }),
    defineCommandStep({ args: ["jscpd", "--config", ".jscpd.json"], cmd: "bunx", failMsg: "duplicates found", key: "jscpd", label: "jscpd", summary: jscpdSummary }),
    coverage("junit", ["test", "--timeout={testTimeoutMs}", "--coverage", "--coverage-reporter=lcov", "--coverage-dir=coverage", "--reporter=junit", "--reporter-outfile={junitPath}"], { includedPaths: ["src"], path: "{lcovPath}", reportPath: "{junitPath}" }, junitLineCoverageThreshold, { failMsg: "", reportDirs: ["coverage"], timeoutEnvVar: "CHECK_TEST_COMMAND_TIMEOUT_MS", timeoutMs: junitCoverageTimeoutMs, tokens: { lineCoverageThreshold: junitLineCoverageThreshold, testTimeoutMs } }),
    coverage("playwright", ["run", "test:e2e:coverage"], { includedPaths: ["src"], path: "{playwrightLcovPath}", reportPath: "{playwrightJunitPath}" }, playwrightLineCoverageThreshold, { enabled: hasPackageScript("test:e2e:coverage"), failMsg: "playwright e2e failed", parseConsoleCoverage: parseBunConsoleCoverage, reportDirs: ["coverage/playwright"], timeoutDrainMs: playwrightCoverageTimeoutDrainMs, timeoutEnvVar: "CHECK_PLAYWRIGHT_TIMEOUT_MS", timeoutMs: playwrightCoverageTimeoutMs, tokens: { lineCoverageThreshold: playwrightLineCoverageThreshold } }),
    defineCommandStep({ args: ["tsc", "--noEmit"], cmd: "bunx", failMsg: "typecheck failed", key: "types", label: "tsc", summary: typeSummary }),
    defineLintStep({ args: ["eslint", ".", "--cache", "--cache-strategy", "content", "--cache-location", ".cache/eslint", "--fix", "--concurrency"], label: "eslint", summary: lintSummary }),
  ],
  suite: { timeoutEnvVar: "CHECK_SUITE_TIMEOUT_MS", timeoutMs: 180000 },
});
