import { ANSI, paint } from "@/format/index.ts";

import type {
  ComplexityThresholds,
  FileMetrics,
  TypeScriptFunctionMetrics,
} from "./contracts.ts";

import {
  buildViolationSections,
  formatThresholdBlock,
} from "./report-formatting.ts";
import {
  findFileViolations,
  findFunctionViolations,
} from "./report-violations.ts";

type FunctionMetrics = TypeScriptFunctionMetrics;

// ---------------------------------------------------------------------------
// Threshold summary formatting
// ---------------------------------------------------------------------------

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
      output: [
        "complexity: 0 function violations · 0 file violations",
        paint("No lizard rows were produced.", ANSI.bold, ANSI.yellow),
      ].join("\n"),
    };
  }

  const functionViolations = findFunctionViolations(functions, thresholds);
  const fileViolations = findFileViolations(files, thresholds);
  const summary = buildSummary(
    functionViolations.length,
    fileViolations.length,
  );
  const thresholdBlock = formatThresholdBlock(thresholds);

  if (functionViolations.length === 0 && fileViolations.length === 0) {
    return {
      exitCode: 0,
      output: [summary, thresholdBlock].join("\n"),
    };
  }

  return {
    exitCode: 1,
    output: [
      summary,
      thresholdBlock,
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
export { formatViolations } from "./report-formatting.ts";
export {
  findFileViolations,
  findFunctionViolations,
} from "./report-violations.ts";
