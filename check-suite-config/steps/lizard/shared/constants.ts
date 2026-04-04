export interface ComplexityThresholds {
  fileCcn: number;
  fileFunctionCount: number;
  fileNloc: number;
  fileTokenCount: number;
  functionCcn: number;
  functionLength: number;
  functionNestingDepth: number;
  functionNloc: number;
  functionParameterCount: number;
  functionTokenCount: number;
}

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
  fileCcn: 50, // Maximum total cyclomatic complexity allowed per file.
  fileFunctionCount: 15, // Maximum number of function-like declarations allowed per file.
  fileNloc: 300, // Maximum non-comment lines of code allowed per file.
  fileTokenCount: 1500, // Maximum lexical token count allowed per file.
  functionCcn: 10, // Maximum cyclomatic complexity allowed for a single function.
  functionLength: 80, // Maximum total line span allowed for a single function.
  functionNestingDepth: 4, // Maximum block nesting depth allowed inside a function.
  functionNloc: 60, // Maximum non-comment lines of code allowed for a single function.
  functionParameterCount: 6, // Maximum number of parameters allowed for a single function.
  functionTokenCount: 200, // Maximum lexical token count allowed for a single function.
};

export { LIZARD_EXCLUDED_PATHS, LIZARD_TARGETS };
