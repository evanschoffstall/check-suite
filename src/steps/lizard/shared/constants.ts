import type { ComplexityThresholds } from "./contracts.ts";

const PYTHON_LIZARD_MODULE = "lizard";

/**
 * Builds the python3 -m lizard CLI arguments for the given targets and excluded
 * path patterns. Consumers supply their own target list and exclusion globs.
 */
export function buildLizardAnalysisArgs(
  targets: readonly string[],
  excludedPaths: readonly string[],
): string[] {
  return [
    "-m",
    PYTHON_LIZARD_MODULE,
    "--csv",
    "-l",
    "typescript",
    "-l",
    "tsx",
    ...excludedPaths.flatMap((pattern) => ["-x", pattern]),
    ...targets,
  ];
}

/** Default complexity thresholds. Consumers may override any field. */
export const LIZARD_DEFAULT_THRESHOLDS: ComplexityThresholds = {
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
