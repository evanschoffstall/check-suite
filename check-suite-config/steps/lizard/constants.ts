import type { ComplexityThresholds } from "./contracts.ts";

const LIZARD_EXCLUDED_PATHS = ["src/components/ui/*"] as const;
const LIZARD_TARGETS = [
  "src",
  "scripts",
  "check-suite-config",
  "drizzle.config.ts",
  "next.config.ts",
  "playwright.config.ts",
  "tailwind.config.ts",
] as const;
const PYTHON_LIZARD_MODULE = "lizard";

export const LIZARD_ANALYSIS_ARGS = [
  "-m",
  PYTHON_LIZARD_MODULE,
  "--csv",
  "-l",
  "typescript",
  "-l",
  "tsx",
  ...LIZARD_EXCLUDED_PATHS.flatMap((pattern) => ["-x", pattern]),
  ...LIZARD_TARGETS,
] as const;

export const LIZARD_THRESHOLDS: ComplexityThresholds = {
  fileCcn: 15,
  fileFunctionCount: 12,
  fileNloc: 80,
  fileTokenCount: 400,
  functionCcn: 7,
  functionLength: 80,
  functionNestingDepth: 2,
  functionNloc: 40,
  functionParameterCount: 4,
  functionTokenCount: 200,
};

export { LIZARD_EXCLUDED_PATHS, LIZARD_TARGETS };
