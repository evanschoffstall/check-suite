import type {
  ComplexityThresholds,
  FileMetrics,
  TypeScriptFunctionMetrics,
} from "./contracts.ts";

import {
  formatThresholdSummary,
  formatViolations,
} from "./report-formatting.ts";
import {
  findFileViolations,
  findFunctionViolations,
} from "./report-violations.ts";

type FunctionMetrics = TypeScriptFunctionMetrics;

export function buildLizardReportWithFiles(
  functions: FunctionMetrics[],
  files: FileMetrics[],
  thresholds: ComplexityThresholds,
): {
  exitCode: 0 | 1;
  output: string;
} {
  if (functions.length === 0 && files.length === 0) {
    return {
      exitCode: 1,
      output:
        "complexity: 0 function violations · 0 file violations\nno lizard rows were produced",
    };
  }

  const functionViolations = findFunctionViolations(functions, thresholds);
  const fileViolations = findFileViolations(files, thresholds);
  const summary = buildSummary(
    functionViolations.length,
    fileViolations.length,
  );
  const thresholdSummary = formatThresholdSummary(thresholds);

  if (functionViolations.length === 0 && fileViolations.length === 0) {
    return { exitCode: 0, output: `${summary}\n${thresholdSummary}` };
  }

  return {
    exitCode: 1,
    output: [
      summary,
      thresholdSummary,
      ...buildViolationSections(functionViolations, fileViolations),
    ].join("\n"),
  };
}

function buildSummary(
  functionViolationCount: number,
  fileViolationCount: number,
): string {
  return `complexity: ${functionViolationCount} function violations · ${fileViolationCount} file violations`;
}

function buildViolationSections(
  functionViolations: ReturnType<typeof findFunctionViolations>,
  fileViolations: ReturnType<typeof findFileViolations>,
): string[] {
  const outputLines: string[] = [];
  if (functionViolations.length > 0) {
    outputLines.push(
      ...formatViolations("Function threshold violations:", functionViolations),
    );
  }
  if (fileViolations.length > 0) {
    outputLines.push(
      ...formatViolations("File threshold violations:", fileViolations),
    );
  }
  return outputLines;
}
