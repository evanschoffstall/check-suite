import type { CheckConfig } from "@/types/index.ts";

import {
  createArchitectureStep,
  createDependencyCruiserStep,
  createJunitStep,
  createLizardStep,
  createPlaywrightStep,
  createPurgeCssStep,
  createSecretlintStep,
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
  createJunitStep({
    coverageExcludedPaths: [],
    coverageIncludedPaths: ["src"],
    coverageLabel: "lcov-coverage",
    coveragePath: "{lcovPath}",
    coverageThreshold: 85,
    reportPath: "{junitPath}",
    testTimeoutMs: 5000,
  }),
  createPlaywrightStep({
    coverageExcludedPaths: [],
    coverageIncludedPaths: ["src"],
    coverageLabel: "playwright-lcov-coverage",
    coveragePath: "{playwrightLcovPath}",
    coverageThreshold: 55,
    reportPath: "{playwrightJunitPath}",
  }),
  typesStep,
  lintStep,
];
