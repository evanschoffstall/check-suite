import type { ComplexityCheckOptions, ComplexityThresholds } from "check-suite/quality";
import type { GitFileScanOptions } from "check-suite/step";
import type {
  Command,
  InlineTypeScriptConfig,
  InlineTypeScriptContext,
  InlineTypeScriptPostProcessContext,
  PostProcessMessage,
  PostProcessSection,
  ProcessedCheck,
  StepConfig,
  StepPostProcessResult,
  Summary,
} from "check-suite/types";

import { hasPackageScript } from "check-suite/config";
import { defineCheckSuiteConfig } from "check-suite/config-schema";
import {
  analyzeArchitecture,
  createSpawnComplexityAdapter,
  discoverDefaultCodeRoots,
  formatArchitectureViolations,
  inferAllowedRootFileStems,
  inferCentralSurfacePathPrefixes,
  inferDependencyPolicies,
  inferEntrypointNames,
  inferExplicitPublicSurfacePaths,
  parseCsvComplexityRows,
  runComplexityCheck,
} from "check-suite/quality";
import { createSafeRegExp, isSafeRegExpPattern } from "check-suite/regex";
import { defineCommandStep, defineInlineStep, defineLintStep, runGitFileScan } from "check-suite/step";

type PatternSummary = Extract<Summary, { type: "pattern" }>;

const pat = (defaultValue: string, patterns: PatternSummary["patterns"]): Summary => ({ default: defaultValue, patterns, type: "pattern" });

const lintSummary = pat("", [{ format: "{1} problems ({2} errors, {3} warnings)", regex: "[✖xX]\\s+(\\d+)\\s+problems?\\s*\\((\\d+)\\s+errors?,\\s*(\\d+)\\s+warnings?\\)", type: "match" }]);
const typeSummary = pat("", [{ format: "{count} TypeScript errors", regex: ":\\s+error\\s+TS\\d+:", type: "count" }]);
const coverageSummary = pat("type coverage completed", [{ format: "{3}% ({1}/{2}) · threshold {typeCoverageThreshold}%", regex: "\\((\\d+)\\s*/\\s*(\\d+)\\)\\s*([\\d.]+)%", type: "match" }]);
const lizardSummary = pat("complexity check completed", [{ format: "{1} function violations · {2} file violations", regex: "complexity:\\s+(\\d+)\\s+function violations\\s+·\\s+(\\d+)\\s+file violations", type: "match" }]);
const madgeSummary = pat("circular dependency check completed", [{ format: "0 circular dependencies", regex: "No circular dependency found", type: "literal" }, { format: "{1} circular dependencies", regex: "Found\\s+(\\d+)\\s+circular\\s+dependenc", type: "match" }]);
const jscpdSummary = pat("no duplicate stats detected", [{ cellSep: "│", format: "{4} clones · {5} lines · {6} tokens · {1} files", regex: "│ Total:", type: "table-row" }, { format: "{1} clones", regex: "Found\\s+(\\d+)\\s+clones?", type: "match" }]);

function selectSourceDirectories(directories: string[]): string[] {
  return directories.includes("src") ? ["src"] : directories;
}

const { directories: discoveredCodeRoots } = discoverDefaultCodeRoots(process.cwd());
const srcDirs = selectSourceDirectories(discoveredCodeRoots);

const paths = {
  junitPath: "coverage/test-results.xml",
  lcovPath: "coverage/lcov.info",
  playwrightJunitPath: "coverage/playwright-junit.xml",
  playwrightLcovPath: "coverage/playwright/lcov.info",
};

const thresholds = {
  junitLineCoverage: 85,
  playwrightLineCoverage: 55,
  typeCoverage: 98,
};

const timeouts = {
  junitCoverageMs: 120000,
  playwrightCoverageDrainMs: 20000,
  playwrightCoverageMs: 180000,
  suiteMs: 180000,
  testMs: 5000,
};

const purgeCss = {
  contentGlobs: ["src/components/components.css"],
  cssFiles: ["src/app/globals.css"],
  safelists: ["^dark$", "^motion-profile-"],
  selectorPrefix: ".",
} satisfies PurgeCssConfig;

const lizardThresholds: ComplexityThresholds = { fileCcn: 60, fileFunctionCount: 15, fileNloc: 450, fileTokenCount: 2200, functionCcn: 10, functionLength: 80, functionNestingDepth: 4, functionNloc: 60, functionParameterCount: 6, functionTokenCount: 240 };

const discoveryBase = {
  ignoredDirectoryNames: [".cache", ".git", ".idea", ".next", ".turbo", ".vscode", "build", "coverage", "dist", "node_modules", "out", "scripts", "tmp"],
  maxPolicyFanOut: 5,
  rootDirectories: srcDirs,
  testDirectoryNames: ["__fixtures__", "__mocks__", "__tests__", "fixtures", "mocks", "test", "tests"],
  vendorManagedDirectoryNames: ["__generated__", "generated", "vendor"],
};

const entrypointNames = inferEntrypointNames(process.cwd(), discoveryBase);
const allowedRootFileStems = inferAllowedRootFileStems(process.cwd(), { ...discoveryBase, entrypointNames });
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

const lizardConfig: ComplexityCheckOptions = {
  analyzer: createSpawnComplexityAdapter({
    buildArgs: (targets, excluded) => ["-m", "lizard", "--csv", "-l", "typescript", "-l", "tsx", ...excluded.flatMap((path) => ["-x", path]), ...targets],
    command: "python3",
    failureLabel: "complexity",
    installHint: "python3 -m pip install lizard",
    parseOutput: (output) => parseCsvComplexityRows(output, { ccn: 1, endLine: 10, functionName: 7, length: 4, location: 5, nloc: 0, parameterCount: 3, path: 6, startLine: 9, tokenCount: 2 }),
  }),
  excludedPaths: ["src/components/ui/*"],
  targets: srcDirs,
  thresholds: lizardThresholds,
};

const BUN_LINE_COVERAGE_PATTERN = /(?:^|\n)\s*[│|]\s*Lines\s*[│|]\s*([\d.]+)\s*%\s*[│|]\s*([\d,]+)\s*[│|]\s*[\d,]+\s*[│|]\s*([\d,]+)\s*[│|]/u;

export default defineCheckSuiteConfig({
  paths,
  steps: createSteps(),
  suite: { timeoutEnvVar: "CHECK_SUITE_TIMEOUT_MS", timeoutMs: timeouts.suiteMs },
});
interface CoverageCommandStepOptions { allowSuiteFlagArgs?: boolean; args: string[]; cmd: string; coverage: CoverageOptions; defaultThreshold: number; enabled?: boolean; ensureDirs?: string[]; failMsg?: string; key: string; label: string; postProcess?: InlineTypeScriptConfig<InlineTypeScriptPostProcessContext, StepPostProcessResult>; serialGroup?: string; timeoutDrainMs?: number | string; timeoutEnvVar?: string; timeoutMs?: number | string; tokens?: Record<string, number | string>; }
interface CoverageOptions { excludedFiles?: string[]; excludedPaths?: string[]; includedPaths?: string[]; label?: string; path?: string; reportPath?: string; threshold?: number | string; }
interface CoverageReportPostProcessOptions { defaultThreshold: number; parseConsoleCoverage?: (output: string) => CoverageTotals | null; readExecutionReport: (reportPath: string, commandOutput: string, existsSync: InlineTypeScriptPostProcessContext["existsSync"], readFileSync: InlineTypeScriptPostProcessContext["readFileSync"]) => ExecutionReport; }
interface CoverageState { coverageExcludedFiles: Set<string>; coverageExcludedPaths: string[]; coverageIncludedPaths: string[]; coverageLabel: string; coveragePath: string; coverageThreshold: number; reportPath: string; }
interface CoverageStepOptions { enabled?: boolean; failMsg?: string; parseConsoleCoverage?: (output: string) => CoverageTotals | null; reportDirs?: string[]; timeoutDrainMs?: number | string; timeoutEnvVar?: string; timeoutMs?: number | string; tokens?: Record<string, number | string>; }
interface CoverageTotals { covered: number; found: number; pct: number; }
interface ExecutionReport { failed: number; failedItems: string[]; passed: number; skipped: number; skippedItems: string[]; }
type PurgeCssCheckResult = { kind: "invalid-safelist"; message: string } | { kind: "ok"; unusedSelectors: string[] };
interface PurgeCssConfig { contentGlobs: string[]; cssFiles: string[]; safelists: string[]; selectorPrefix: string; }

async function analyzePurgeCss({ config, cwd, importModule, joinPath }: { config: PurgeCssConfig; cwd: string; importModule: (specifier: string) => Promise<unknown>; joinPath: InlineTypeScriptContext["join"]; }): Promise<PurgeCssCheckResult> { if (!config.safelists.every((pattern) => isSafeRegExpPattern(pattern))) return { kind: "invalid-safelist", message: "purgecss config contains an unsafe safelist pattern\n" }; const compiledSafelists = config.safelists.map((pattern) => createSafeRegExp(pattern)), safeSelectorPattern = compiledSafelists.length > 0 ? createSafeRegExp(compiledSafelists.map((pattern) => pattern.source).join("|")) : null; const purgeCssModule = (await importModule("purgecss")) as { PurgeCSS: new () => { purge: (options: { content: string[]; css: string[]; rejected: boolean; safelist: { greedy: RegExp[] } }) => Promise<{ rejected?: string[] }[]> } }; const [result] = await new purgeCssModule.PurgeCSS().purge({ content: config.contentGlobs.map((file) => joinPath(cwd, file)), css: config.cssFiles.map((file) => joinPath(cwd, file)), rejected: true, safelist: { greedy: compiledSafelists } }); return { kind: "ok", unusedSelectors: Array.isArray(result.rejected) ? result.rejected.filter((selector) => selector.startsWith(config.selectorPrefix) && !(safeSelectorPattern ? safeSelectorPattern.test(selector) : false)) : [] }; }

function appendCoverageCheckResult(input: { coverageLabel: string; coveragePath?: string; coverageThreshold: number; totals: CoverageTotals | null }, messages: PostProcessMessage[], extraChecks: ProcessedCheck[]): boolean { if (!input.totals) { messages.push({ text: `Coverage report not found: ${input.coveragePath ?? "(unset)"}`, tone: "fail" }); extraChecks.push({ details: `0.00% (0/0) · threshold ${input.coverageThreshold.toFixed(1)}%`, label: input.coverageLabel, status: "fail" }); return true; } const status: "fail" | "pass" = input.totals.found > 0 && input.totals.pct >= input.coverageThreshold ? "pass" : "fail"; extraChecks.push({ details: `${input.totals.pct.toFixed(2)}% (${input.totals.covered}/${input.totals.found}) · threshold ${input.coverageThreshold.toFixed(1)}%`, label: input.coverageLabel, status }); if (input.totals.found === 0) messages.push({ text: "No executable lines found in coverage report", tone: "fail" }); return status === "fail"; }
function appendExecutionResultSections(executionReport: Pick<ExecutionReport, "failedItems" | "skippedItems">, sections: PostProcessSection[], failedTitle: string, skippedTitle: string): boolean { let hasFailures = false; if (executionReport.failedItems.length > 0) { sections.push({ items: executionReport.failedItems, title: failedTitle, tone: "fail" }); hasFailures = true; } if (executionReport.skippedItems.length > 0) sections.push({ items: executionReport.skippedItems, title: skippedTitle, tone: "warn" }); return hasFailures; }
function appendMissingReportMessage(messages: PostProcessMessage[], reportPath?: string): void { messages.push({ text: `Report file not found: ${reportPath ?? "(unset)"}`, tone: "fail" }); }

function buildCommonCoverageState(data: Record<string, unknown>, resolveTokenString: (value: string) => string, defaultThreshold: number): CoverageState { const coverageIncludedPaths = resolveCoverageMatchers(data.coverageIncludedPaths, [], resolveTokenString), coverageExcludedFiles = new Set(resolveCoverageMatchers(data.coverageExcludedFiles, coverageIncludedPaths, resolveTokenString)), coverageExcludedPaths = resolveCoverageMatchers(data.coverageExcludedPaths, coverageIncludedPaths, resolveTokenString); return { coverageExcludedFiles, coverageExcludedPaths, coverageIncludedPaths, coverageLabel: typeof data.coverageLabel === "string" ? data.coverageLabel : "coverage", coveragePath: typeof data.coveragePath === "string" ? resolveTokenString(data.coveragePath) : "", coverageThreshold: typeof data.coverageThreshold === "number" ? data.coverageThreshold : typeof data.coverageThreshold === "string" && Number.isFinite(Number.parseFloat(resolveTokenString(data.coverageThreshold))) ? Number.parseFloat(resolveTokenString(data.coverageThreshold)) : defaultThreshold, reportPath: typeof data.reportPath === "string" ? resolveTokenString(data.reportPath) : "" }; }
function buildConsoleOnlyExecutionReport(commandOutput: string): ExecutionReport { return { failed: parseConsoleCount(commandOutput, "failed"), failedItems: [], passed: parseConsoleCount(commandOutput, "passed"), skipped: parseConsoleCount(commandOutput, "skipped"), skippedItems: [] }; }
function buildCoverageReportPostProcess(options: CoverageReportPostProcessOptions) { return ({ command, data, displayOutput, existsSync, helpers, readFileSync, resolveTokenString }: InlineTypeScriptPostProcessContext): StepPostProcessResult => { const coverageState = buildCommonCoverageState(data, resolveTokenString, options.defaultThreshold), executionReport = options.readExecutionReport(coverageState.reportPath, displayOutput, existsSync, readFileSync), reportExists = Boolean(coverageState.reportPath) && existsSync(coverageState.reportPath); const extraChecks: NonNullable<StepPostProcessResult["extraChecks"]> = [], messages: NonNullable<StepPostProcessResult["messages"]> = [], sections: NonNullable<StepPostProcessResult["sections"]> = []; let status: "fail" | "pass" = command.exitCode === 0 ? "pass" : "fail"; if (!reportExists) status = resolveMissingReportStatus(options, executionReport, messages, coverageState.reportPath, status); else if (appendExecutionResultSections(executionReport, sections, "Failed tests", "Skipped tests")) status = "fail"; if (status === "pass") status = appendCoverageCheckResult({ coverageLabel: coverageState.coverageLabel, coveragePath: coverageState.coveragePath, coverageThreshold: coverageState.coverageThreshold, totals: resolveCoverageTotals(options, coverageState, displayOutput, messages, existsSync, readFileSync) }, messages, extraChecks) ? "fail" : "pass"; return { extraChecks, messages, output: helpers.compactDomAssertionNoise(displayOutput), sections, status, summary: buildExecutionSummary(executionReport, command.exitCode) }; }; }
function buildExecutionSummary(executionReport: Pick<ExecutionReport, "failed" | "passed" | "skipped">, exitCode: number): string { return `${executionReport.passed} passed · ${executionReport.failed} failed · ${executionReport.skipped} skipped${exitCode === 0 ? "" : ` · runner exit ${exitCode}`}`; }
function collectCaseResults(report: string, resultType: "failed" | "skipped"): string[] { const collected: string[] = []; for (const match of report.matchAll(/<testcase\b([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase>)/g)) { const body = match[0].endsWith("/>") ? "" : match[2]; if (!matchesResultType(body, resultType)) continue; collected.push(formatCaseResult(match, body)); } return collected; }
function collectLineCoverage(options: { coveragePath: string; excludedFiles: ReadonlySet<string>; excludedPaths: string[]; existsSync: InlineTypeScriptPostProcessContext["existsSync"]; includedPaths: string[]; readFileSync: InlineTypeScriptPostProcessContext["readFileSync"] }): CoverageTotals | null { if (!options.coveragePath || !options.existsSync(options.coveragePath)) return null; const lineHitCounts = new Map<string, number>(); let activeFile = "", includeActiveFile = false; for (const line of options.readFileSync(options.coveragePath, "utf8").split(/\r?\n/u)) { if (line.startsWith("SF:")) { activeFile = normalizeCoverageFilePath(line.slice(3)); includeActiveFile = shouldIncludeCoverageFile(activeFile, options.includedPaths, options.excludedFiles, options.excludedPaths); continue; } if (!includeActiveFile || !activeFile || !line.startsWith("DA:")) continue; const hitCount = Number.parseInt(line.slice(line.lastIndexOf(",") + 1), 10), lineNumber = line.slice(3, line.lastIndexOf(",")); if (!lineNumber || !Number.isFinite(hitCount)) continue; const lineKey = `${activeFile}:${lineNumber}`, previous = lineHitCounts.get(lineKey); if (previous === undefined || hitCount > previous) lineHitCounts.set(lineKey, hitCount); } let covered = 0, found = 0; for (const hitCount of lineHitCounts.values()) { found += 1; if (hitCount > 0) covered += 1; } return { covered, found, pct: found > 0 ? (covered / found) * 100 : 0 }; }
function createArchitectureStep(): StepConfig { return defineInlineStep({ data: architecture as Record<string, unknown>, failMsg: "architecture violations found", key: "architecture", label: "architecture", source: ({ cwd, data, fail, ok }: InlineTypeScriptContext): Command => { const violations = analyzeArchitecture(cwd, data); const output = formatArchitectureViolations(violations); return violations.length === 0 ? ok(output) : fail(output); } }); }
function createCoverageStep(key: string, args: string[], coverage: CoverageOptions, defaultThreshold: number, options: CoverageStepOptions = {}): StepConfig { return defineCoverageCommandStep({ allowSuiteFlagArgs: key === "junit", args, cmd: "bun", coverage, defaultThreshold, enabled: options.enabled, ensureDirs: options.reportDirs, failMsg: options.failMsg, key, label: key, postProcess: { source: buildCoverageReportPostProcess({ defaultThreshold, parseConsoleCoverage: options.parseConsoleCoverage, readExecutionReport: parseJunitExecutionReport }) }, serialGroup: "coverage-tests", timeoutDrainMs: options.timeoutDrainMs, timeoutEnvVar: options.timeoutEnvVar, timeoutMs: options.timeoutMs, tokens: options.tokens }); }
function createPurgeCssStep(): StepConfig { return defineInlineStep({ data: purgeCss, failMsg: "unused CSS selectors found", key: "purgecss", label: "purgecss", source: async ({ cwd, data, fail, importModule, join, ok }: InlineTypeScriptContext) => { const config = readPurgeCssConfig(data); if (!config) return fail("purgecss config is invalid\n"); const result = await analyzePurgeCss({ config, cwd, importModule, joinPath: join }); if (result.kind === "invalid-safelist") return fail(result.message); return result.unusedSelectors.length === 0 ? ok("no unused CSS selectors found\n") : fail(formatUnusedSelectorOutput(result.unusedSelectors)); } }); }
function createSteps(): StepConfig[] {
  return [
    defineCommandStep({ args: ["knip", "--config", "knip.json", "--cache"], cmd: "bunx", failMsg: "knip failed", key: "knip", label: "knip" }),
    defineCommandStep({ args: ["madge@8", "--circular", "--extensions", "ts,tsx", ...srcDirs], cmd: "bunx", failMsg: "circular dependencies found", key: "madge", label: "madge", outputFilter: { pattern: "\\b\\d+\\s+warnings?\\b", type: "stripLines" }, summary: madgeSummary }),
    createArchitectureStep(),
    createPurgeCssStep(),
    defineCommandStep({ args: ["tsd", "--typings", "next-env.d.ts", "--files", "next-env.test-d.ts"], cmd: "bunx", failMsg: "tsd failed", key: "tsd", label: "tsd" }),
    defineInlineStep({ failMsg: "secretlint failed", key: "secretlint", label: "secretlint", source: ({ cwd }: InlineTypeScriptContext) => runGitFileScan(cwd, { command: "bunx", fallbackArgs: ["secretlint", "**/*", "--secretlintignore", ".secretlintignore"], fileArgs: ["secretlint", "--no-glob", "--secretlintignore", ".secretlintignore"], noFilesMessage: "No tracked or non-ignored files matched for secretlint\n" } satisfies GitFileScanOptions) }),
    defineCommandStep({ args: ["audit"], cmd: "bun", failMsg: "bun audit failed", key: "audit", label: "audit" }),
    defineCommandStep({ args: ["scan", "--config", "p/default", "--error", "--metrics", "off", "--exclude=tests", "--exclude=src/components/ui", "--exclude-rule=javascript.lang.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml", "--exclude-rule=typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml", "--exclude-rule=problem-based-packs.insecure-transport.js-node.bypass-tls-verification.bypass-tls-verification", "--quiet", ...srcDirs], cmd: "semgrep", failMsg: "semgrep failed", key: "semgrep", label: "semgrep" }),
    defineCommandStep({ args: ["@0xts/gitleaks-cli", "detect", "-s", srcDirs[0] ?? ".", "--no-git", "-c", ".gitleaks.toml"], cmd: "bunx", failMsg: "gitleaks failed", key: "@0xts/gitleaks-cli", label: "@0xts/gitleaks-cli" }),
    defineCommandStep({ args: ["type-coverage", "--at-least", "{typeCoverageThreshold}", "--cache", "--cache-directory", ".cache/type-coverage"], cmd: "bunx", failMsg: "type coverage below threshold", key: "type-coverage", label: "type-coverage", summary: coverageSummary, tokens: { typeCoverageThreshold: thresholds.typeCoverage } }),
    defineInlineStep({ failMsg: "complexity limits exceeded", key: "lizard", label: "lizard", source: ({ fail, ok }: InlineTypeScriptContext): Command => { const result = runComplexityCheck(lizardConfig); return result.exitCode === 0 ? ok(result.output) : fail(result.output); }, summary: lizardSummary }),
    defineCommandStep({ args: ["jscpd", "--config", ".jscpd.json"], cmd: "bunx", failMsg: "duplicates found", key: "jscpd", label: "jscpd", summary: jscpdSummary }),
    createCoverageStep("junit", ["test", "--timeout={testTimeoutMs}", "--coverage", "--coverage-reporter=lcov", "--coverage-dir=coverage", "--reporter=junit", "--reporter-outfile={junitPath}"], { includedPaths: ["src"], label: "junit coverage", path: "{lcovPath}", reportPath: "{junitPath}" }, thresholds.junitLineCoverage, { failMsg: "", reportDirs: ["coverage"], timeoutEnvVar: "CHECK_TEST_COMMAND_TIMEOUT_MS", timeoutMs: timeouts.junitCoverageMs, tokens: { lineCoverageThreshold: thresholds.junitLineCoverage, testTimeoutMs: timeouts.testMs } }),
    createCoverageStep("playwright", ["run", "test:e2e:coverage"], { includedPaths: ["src"], label: "playwright coverage", path: "{playwrightLcovPath}", reportPath: "{playwrightJunitPath}" }, thresholds.playwrightLineCoverage, { enabled: hasPackageScript("test:e2e:coverage"), failMsg: "playwright e2e failed", parseConsoleCoverage: (output) => parseTableLineCoverage(output, BUN_LINE_COVERAGE_PATTERN), reportDirs: ["coverage/playwright"], timeoutDrainMs: timeouts.playwrightCoverageDrainMs, timeoutEnvVar: "CHECK_PLAYWRIGHT_TIMEOUT_MS", timeoutMs: timeouts.playwrightCoverageMs, tokens: { lineCoverageThreshold: thresholds.playwrightLineCoverage } }),
    defineCommandStep({ args: ["tsc", "--noEmit"], cmd: "bunx", failMsg: "typecheck failed", key: "types", label: "tsc", summary: typeSummary }),
    defineLintStep({ args: ["eslint", ".", "--cache", "--cache-strategy", "content", "--cache-location", ".cache/eslint", "--fix"], concurrencyArgs: ["--concurrency"], concurrencyEnvVar: "CHECK_SUITE_LINT_CONCURRENCY", label: "eslint", summary: lintSummary }),
  ];
}
function defineCoverageCommandStep(input: CoverageCommandStepOptions): StepConfig { const step = defineCommandStep({ allowSuiteFlagArgs: input.allowSuiteFlagArgs, args: input.args, cmd: input.cmd, enabled: input.enabled ?? true, ensureDirs: input.ensureDirs, failMsg: input.failMsg ?? `${input.label} failed`, key: input.key, label: input.label, serialGroup: input.serialGroup, timeoutDrainMs: input.timeoutDrainMs, timeoutEnvVar: input.timeoutEnvVar, timeoutMs: input.timeoutMs, tokens: input.tokens }); if (input.postProcess) step.postProcess = { data: { coverageExcludedFiles: input.coverage.excludedFiles ?? [], coverageExcludedPaths: input.coverage.excludedPaths ?? [], coverageIncludedPaths: input.coverage.includedPaths ?? ["src"], coverageLabel: input.coverage.label ?? "coverage", coveragePath: input.coverage.path ?? "", coverageThreshold: input.coverage.threshold ?? input.defaultThreshold, reportPath: input.coverage.reportPath ?? "", ...(input.postProcess.data ?? {}) }, source: input.postProcess.source }; return step; }
function formatCaseResult(match: RegExpMatchArray, body: string): string { const failure = readXmlAttributes(/<(?:failure|error)\b([^>]*)>/.exec(body)?.[1] ?? ""), test = readXmlAttributes(match[1]); return `${test.file ?? "unknown-file"}${test.line ? `:${test.line}` : ""} - ${test.classname ? `${test.classname} > ` : ""}${test.name ?? "(unnamed test)"}${failure.message ? ` [${failure.message}]` : ""}`; }
function formatUnusedSelectorOutput(unusedSelectors: string[]): string { return `${unusedSelectors.map((selector) => `  unused: ${selector}`).join("\n")}\nfound ${unusedSelectors.length} unused CSS selector(s)\n`; }
function matchesCoveragePath(filePath: string, matcherPath: string): boolean { return filePath === matcherPath || filePath.startsWith(`${matcherPath}/`); }
function matchesResultType(body: string, resultType: "failed" | "skipped"): boolean { return resultType === "skipped" ? /<skipped\b/.test(body) : !/<skipped\b/.test(body) && (body.includes("<failure") || body.includes("<error")); }
function normalizeCoverageFilePath(value: string): string { return value.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\.\//u, "").replace(/\/$/u, ""); }
function parseConsoleCount(commandOutput: string, label: "failed" | "passed" | "skipped"): number { const match = ({ failed: /(?:^|\n)\s*(\d+)\s+failed(?:\s|$)/i, passed: /(?:^|\n)\s*(\d+)\s+passed(?:\s|$)/i, skipped: /(?:^|\n)\s*(\d+)\s+skipped(?:\s|$)/i } as const)[label].exec(commandOutput); return match ? Number.parseInt(match[1], 10) : 0; }
function parseJunitExecutionReport(reportPath: string, commandOutput: string, existsSync: InlineTypeScriptPostProcessContext["existsSync"], readFileSync: InlineTypeScriptPostProcessContext["readFileSync"]): ExecutionReport { if (!reportPath || !existsSync(reportPath)) return buildConsoleOnlyExecutionReport(commandOutput); const report = readFileSync(reportPath, "utf8"), suites = readXmlAttributes(/<testsuites\b([^>]*)>/.exec(report)?.[1] ?? ""), failed = Number.parseInt(suites.failures ?? "0", 10), skipped = Number.parseInt(suites.skipped ?? "0", 10), totalTests = Number.parseInt(suites.tests ?? "0", 10); return { failed, failedItems: collectCaseResults(report, "failed"), passed: Math.max(0, totalTests - failed - skipped), skipped, skippedItems: collectCaseResults(report, "skipped") }; }
function parseTableLineCoverage(displayOutput: string, pattern: RegExp): CoverageTotals | null { const match = pattern.exec(displayOutput); return match ? { covered: Number.parseInt(match[2].replace(/,/g, ""), 10), found: Number.parseInt(match[3].replace(/,/g, ""), 10), pct: Number.parseFloat(match[1]) } : null; }
function readPurgeCssConfig(data: unknown): null | PurgeCssConfig { const hasStringList = (entry: unknown): entry is string[] => Array.isArray(entry) && entry.every((item) => typeof item === "string"), value = data as null | Partial<PurgeCssConfig>; if (typeof data !== "object" || data === null || !hasStringList(value?.cssFiles) || !hasStringList(value?.contentGlobs) || !hasStringList(value?.safelists) || typeof value.selectorPrefix !== "string") return null; return { contentGlobs: value.contentGlobs, cssFiles: value.cssFiles, safelists: value.safelists, selectorPrefix: value.selectorPrefix }; }
function readXmlAttributes(raw: string): Partial<Record<string, string>> { return Object.fromEntries([...raw.matchAll(/(\w+)="([^"]*)"/g)].map((match) => [match[1], match[2]])); }
function resolveCoverageMatchers(values: unknown, includePaths: string[], resolveTokenString: (value: string) => string): string[] { if (!Array.isArray(values)) return []; return [...new Set(values.flatMap((value) => { if (typeof value !== "string") return []; const normalizedValue = normalizeCoverageFilePath(resolveTokenString(value)); if (!normalizedValue) return []; const resolved = new Set([normalizedValue]); for (const includePath of includePaths) { resolved.add(normalizeCoverageFilePath(`${includePath}/${normalizedValue}`)); if (normalizedValue.startsWith("../")) resolved.add(normalizeCoverageFilePath(`${includePath}/${normalizedValue.slice(3)}`)); } return [...resolved].filter(Boolean); }))]; }
function resolveCoverageTotals(options: CoverageReportPostProcessOptions, coverageState: CoverageState, displayOutput: string, messages: NonNullable<StepPostProcessResult["messages"]>, existsSync: InlineTypeScriptPostProcessContext["existsSync"], readFileSync: InlineTypeScriptPostProcessContext["readFileSync"]): CoverageTotals | null { if (options.parseConsoleCoverage) { const consoleTotals = options.parseConsoleCoverage(displayOutput), hasPathFilters = coverageState.coverageIncludedPaths.length > 0 || coverageState.coverageExcludedFiles.size > 0 || coverageState.coverageExcludedPaths.length > 0; if (consoleTotals && !hasPathFilters) return consoleTotals; if (!consoleTotals) messages.push({ text: "Coverage summary row not found in output; falling back to LCOV artifact totals.", tone: "warn" }); } return collectLineCoverage({ coveragePath: coverageState.coveragePath, excludedFiles: coverageState.coverageExcludedFiles, excludedPaths: coverageState.coverageExcludedPaths, existsSync, includedPaths: coverageState.coverageIncludedPaths, readFileSync }); }
function resolveMissingReportStatus(options: CoverageReportPostProcessOptions, executionReport: ExecutionReport, messages: NonNullable<StepPostProcessResult["messages"]>, reportPath: string, currentStatus: "fail" | "pass"): "fail" | "pass" { if (!options.parseConsoleCoverage) { appendMissingReportMessage(messages, reportPath); return "fail"; } const anyChecksRan = executionReport.passed > 0 || executionReport.failed > 0 || executionReport.skipped > 0; if (!anyChecksRan) { appendMissingReportMessage(messages, reportPath); return "fail"; } return executionReport.failed > 0 ? "fail" : currentStatus; }
function shouldIncludeCoverageFile(filePath: string, includedPaths: string[], excludedFiles: ReadonlySet<string>, excludedPaths: string[]): boolean { const normalizedFilePath = normalizeCoverageFilePath(filePath); const isIncluded = includedPaths.length === 0 || includedPaths.some((matcherPath) => matchesCoveragePath(normalizedFilePath, matcherPath)); return isIncluded && !excludedFiles.has(normalizedFilePath) && !excludedPaths.some((matcherPath) => matchesCoveragePath(normalizedFilePath, matcherPath)); }
