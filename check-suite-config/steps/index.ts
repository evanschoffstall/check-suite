import type { CheckConfig } from "@/types/index.ts";

import { parseBunConsoleCoverage } from "@/coverage/index.ts";
import {
  createGitFileScanStep,
  createTestCoverageStep,
  defineInlineStep,
} from "@/step/index.ts";
import {
  architectureStep,
  createLizardStep,
  purgeCssStep,
  runDependencyCruiserStep,
} from "@/steps/index.ts";

import {
  lintStep,
  madgeStep,
  tsdStep,
  typeCoverageStep,
  typesStep,
} from "./quality-steps.ts";
import {
  auditStep,
  gitleaksStep,
  jscpdStep,
  knipStep,
  semgrepStep,
} from "./root-steps.ts";

/** Ordered step definitions that make up the suite entrypoint. */
export const steps: CheckConfig["steps"] = [
  knipStep,
  madgeStep,
  createDependencyCruiserStep(),
  createArchitectureStep({
    entrypointNames: ["index"],
    maxEntrypointReExports: 12,
    maxInternalImportsPerFile: 12,
    maxSiblingImports: 7,
    minRepeatedDeepImports: 3,
    sharedHomeNames: ["types", "contracts", "utils"],
    vendorManagedDirectoryNames: ["__generated__", "generated", "vendor"],
  }),
  createPurgeCssStep({
    contentGlobs: ["src/**/*.{tsx,ts,jsx,js}", "src/components/components.css"],
    cssFiles: ["src/app/globals.css"],
    safelists: ["^dark$", "^motion-profile-"],
    selectorPrefix: ".",
  }),
  tsdStep,
  createSecretlintStep(),
  auditStep,
  semgrepStep,
  gitleaksStep,
  typeCoverageStep,
  createLizardStep({
    excludedPaths: ["src/components/ui/*"],
    targets: ["src", "scripts", "check-suite-config", "check-suite.config.ts"],
    thresholds: {
      fileCcn: 50,
      fileFunctionCount: 15,
      fileNloc: 300,
      fileTokenCount: 1500,
      functionCcn: 10,
      functionLength: 80,
      functionNestingDepth: 4,
      functionNloc: 60,
      functionParameterCount: 6,
      functionTokenCount: 200,
    },
  }),
  jscpdStep,
  createTestCoverageStep({
    allowSuiteFlagArgs: true,
    args: [
      "test",
      "--timeout={testTimeoutMs}",
      "--coverage",
      "--coverage-reporter=lcov",
      "--coverage-dir=coverage",
      "--reporter=junit",
      "--reporter-outfile={junitPath}",
    ],
    cmd: "bun",
    coverage: {
      excludedPaths: [],
      includedPaths: ["src"],
      label: "lcov-coverage",
      path: "{lcovPath}",
      reportPath: "{junitPath}",
    },
    defaultThreshold: 85,
    ensureDirs: ["coverage"],
    failMsg: "",
    key: "junit",
    label: "junit",
    serialGroup: "coverage-tests",
    timeoutEnvVar: "CHECK_TEST_COMMAND_TIMEOUT_MS",
    timeoutMs: 120000,
    tokens: { lineCoverageThreshold: 85, testTimeoutMs: 5000 },
  }),
  createTestCoverageStep({
    args: ["run", "test:e2e:coverage"],
    cmd: "bun",
    coverage: {
      excludedPaths: [],
      includedPaths: ["src"],
      label: "playwright-lcov-coverage",
      path: "{playwrightLcovPath}",
      reportPath: "{playwrightJunitPath}",
    },
    defaultThreshold: 55,
    enabled: "test:e2e:coverage",
    ensureDirs: ["coverage/playwright"],
    failMsg: "playwright e2e failed",
    key: "playwright",
    label: "playwright",
    parseConsoleCoverage: parseBunConsoleCoverage,
    serialGroup: "coverage-tests",
    timeoutDrainMs: 20000,
    timeoutEnvVar: "CHECK_PLAYWRIGHT_TIMEOUT_MS",
    timeoutMs: 180000,
    tokens: { lineCoverageThreshold: 55 },
  }),
  typesStep,
  lintStep,
];
