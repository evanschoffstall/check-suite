import type { FunctionMetrics } from "./contracts.ts";

import { LIZARD_THRESHOLDS } from "./constants.ts";
import { parseLizardCsv } from "./csv-parser.ts";
import { runLizardAnalysis } from "./lizard-analysis.ts";
import { buildLizardReportWithFiles } from "./report.ts";
import { resolveTopLevelFunctionMetrics } from "./top-level-metrics.ts";
import { collectWorkspaceFileMetrics } from "./workspace-metrics.ts";

export function main(): void {
  const lizardCsvOutput = runLizardAnalysis(failWithOutput);
  const functions = resolveTopLevelFunctionMetrics(
    parseLizardCsv(lizardCsvOutput),
  );
  const report = buildLizardReport(functions);

  if (report.exitCode === 0) {
    process.stdout.write(`${report.output}\n`);
    return;
  }

  failWithOutput(report.output, report.exitCode);
}

function buildLizardReport(functions: FunctionMetrics[]): {
  exitCode: 0 | 1;
  output: string;
} {
  return buildLizardReportWithFiles(
    functions,
    collectWorkspaceFileMetrics(functions),
    LIZARD_THRESHOLDS,
  );
}

function failWithOutput(output: string, exitCode = 1): never {
  process.stdout.write(output.endsWith("\n") ? output : `${output}\n`);
  process.exit(exitCode);
}
