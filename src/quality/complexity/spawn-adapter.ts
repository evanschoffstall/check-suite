import { spawnSync } from "node:child_process";

import type {
  ComplexityAnalyzerAdapter,
} from "@/quality/complexity/main.ts";
import type {
  FunctionMetrics,
} from "@/quality/complexity/shared/index.ts";

/**
 * Maps {@link FunctionMetrics} field names to zero-based column indices in a
 * delimited analysis report. The `nestingDepth` field is always defaulted to
 * zero because no standard CSV analysis format includes nesting depth.
 */
export interface ComplexityColumnMap {
  ccn: number;
  endLine: number;
  functionName: number;
  length: number;
  location: number;
  nloc: number;
  parameterCount: number;
  path: number;
  startLine: number;
  tokenCount: number;
}

/** Options for constructing a subprocess-backed {@link ComplexityAnalyzerAdapter}. */
export interface SpawnComplexityAdapterOptions {
  /**
   * Constructs the command argument list for a given set of targets and
   * exclusion patterns. The command itself is specified by {@link command}.
   */
  buildArgs: (
    targets: readonly string[],
    excludedPaths: readonly string[],
  ) => readonly string[];
  /** Executable to spawn (e.g. `"python3"`). */
  command: string;
  /**
   * Short label used to prefix failure messages (e.g. `"complexity"`).
   * Produces lines like `"complexity: 0 function violations · 0 file violations"`.
   */
  failureLabel: string;
  /** Installation hint appended to missing-dependency error messages. */
  installHint: string;
  /**
   * Pattern matched against stderr/stdout to detect a missing-module error.
   * Defaults to {@link DEFAULT_MISSING_MODULE_PATTERN}.
   */
  missingModulePattern?: RegExp;
  /** Parses the raw stdout into an array of function metrics. */
  parseOutput: (output: string) => FunctionMetrics[];
}

const DEFAULT_MISSING_MODULE_PATTERN = /No module named/i;

/**
 * Creates a {@link ComplexityAnalyzerAdapter} that spawns an external process
 * and delegates argument construction and output parsing to the given options.
 * All process management and error normalisation is handled generically.
 */
export function createSpawnComplexityAdapter(
  opts: SpawnComplexityAdapterOptions,
): ComplexityAnalyzerAdapter {
  const missingModulePattern =
    opts.missingModulePattern ?? DEFAULT_MISSING_MODULE_PATTERN;

  return {
    buildAnalysisArgs: opts.buildArgs,
    parseAnalysisOutput: opts.parseOutput,
    runAnalysis({ analysisArgs, cwd, failWithOutput }) {
      const result = spawnSync(opts.command, [...analysisArgs], {
        cwd,
        encoding: "utf8",
      });

      if (result.error) {
        throw result.error;
      }

      const stderr = result.stderr.trim();
      const stdout = result.stdout.trim();

      if (result.status !== 0) {
        const details =
          stderr || stdout || "analyzer exited with a non-zero status";
        failWithOutput(
          [
            `${opts.failureLabel}: 0 function violations · 0 file violations`,
            "missing dependency or runner failure while starting the complexity analyzer",
            details,
            `install with: ${opts.installHint}`,
          ].join("\n"),
          result.status ?? 1,
        );
      }

      if (missingModulePattern.test(stderr) || missingModulePattern.test(stdout)) {
        failWithOutput(
          [
            `${opts.failureLabel}: 0 function violations · 0 file violations`,
            stderr || stdout,
            `install with: ${opts.installHint}`,
          ].join("\n"),
        );
      }

      return result.stdout;
    },
  };
}

/**
 * Parses ordered CSV analysis output into {@link FunctionMetrics} using the
 * supplied column-position map. Quoted fields and escaped double-quotes are
 * handled correctly. Lines with fewer columns than the highest mapped index
 * throw an error.
 */
export function parseCsvComplexityRows(
  csv: string,
  columnMap: ComplexityColumnMap,
): FunctionMetrics[] {
  const columnIndexes = [
    columnMap.ccn,
    columnMap.endLine,
    columnMap.functionName,
    columnMap.length,
    columnMap.location,
    columnMap.nloc,
    columnMap.parameterCount,
    columnMap.path,
    columnMap.startLine,
    columnMap.tokenCount,
  ];
  const minColumns = Math.max(...columnIndexes) + 1;

  return csv
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => parseCsvRow(line))
    .map((cells) => {
      if (cells.length < minColumns) {
        throw new Error(`Unexpected CSV row: ${cells.join(",")}`);
      }

      const fn = cells[columnMap.functionName];
      const loc = cells[columnMap.location];
      const p = cells[columnMap.path];

      return {
        ccn: Number.parseInt(cells[columnMap.ccn], 10),
        endLine: Number.parseInt(cells[columnMap.endLine], 10),
        functionName: fn.length > 0 ? fn : "(anonymous)",
        length: Number.parseInt(cells[columnMap.length], 10),
        location:
          loc.length > 0 ? loc : p.length > 0 ? p : "unknown-location",
        nestingDepth: 0,
        nloc: Number.parseInt(cells[columnMap.nloc], 10),
        parameterCount: Number.parseInt(cells[columnMap.parameterCount], 10),
        path: p.length > 0 ? p : "unknown-file",
        startLine: Number.parseInt(cells[columnMap.startLine], 10),
        tokenCount: Number.parseInt(cells[columnMap.tokenCount], 10),
      } satisfies FunctionMetrics;
    });
}

/** Splits a single RFC-4180-style CSV line into unquoted cell strings. */
function parseCsvRow(line: string): string[] {
  return (line.match(/(?:^|,)("(?:[^"]|"")*"|[^,]*)/g) ?? []).map(
    (value) => {
      const cell = value.startsWith(",") ? value.slice(1) : value;
      return cell.startsWith('"') && cell.endsWith('"')
        ? cell.slice(1, -1).replaceAll('""', '"')
        : cell;
    },
  );
}
