import type { InlineTypeScriptPostProcessContext } from "@/types/index.ts";

import {
  normalizeCoverageFilePath,
  shouldIncludeCoverageFile,
} from "./state";

/** Aggregates LCOV line coverage totals after applying include and exclude filters. */
export function collectLineCoverage(options: {
  coveragePath: string;
  excludedFiles: ReadonlySet<string>;
  excludedPaths: string[];
  existsSync: InlineTypeScriptPostProcessContext["existsSync"];
  includedPaths: string[];
  readFileSync: InlineTypeScriptPostProcessContext["readFileSync"];
}): null | { covered: number; found: number; pct: number } {
  if (!options.coveragePath || !options.existsSync(options.coveragePath)) {
    return null;
  }

  const lineHitCounts = collectLineHitCounts(options);
  let covered = 0;
  let found = 0;

  for (const hitCount of lineHitCounts.values()) {
    found += 1;
    if (hitCount > 0) {
      covered += 1;
    }
  }

  return {
    covered,
    found,
    pct: found > 0 ? (covered / found) * 100 : 0,
  };
}

function collectLineHitCounts(options: {
  coveragePath: string;
  excludedFiles: ReadonlySet<string>;
  excludedPaths: string[];
  includedPaths: string[];
  readFileSync: InlineTypeScriptPostProcessContext["readFileSync"];
}): Map<string, number> {
  let activeFile = "";
  let includeActiveFile = false;
  const lineHitCounts = new Map<string, number>();

  for (const line of options
    .readFileSync(options.coveragePath, "utf8")
    .split(/\r?\n/u)) {
    if (line.startsWith("SF:")) {
      activeFile = normalizeCoverageFilePath(line.slice(3));
      includeActiveFile = shouldIncludeCoverageFile(
        activeFile,
        options.includedPaths,
        options.excludedFiles,
        options.excludedPaths,
      );
      continue;
    }

    if (!includeActiveFile || !activeFile || !line.startsWith("DA:")) {
      continue;
    }

    recordLineCoverage(lineHitCounts, activeFile, line);
  }

  return lineHitCounts;
}

function recordLineCoverage(
  lineHitCounts: Map<string, number>,
  activeFile: string,
  line: string,
): void {
  const lineNumber = line.slice(3, line.lastIndexOf(","));
  const hitCount = Number.parseInt(line.slice(line.lastIndexOf(",") + 1), 10);
  if (!lineNumber || !Number.isFinite(hitCount)) {
    return;
  }

  const lineKey = `${activeFile}:${lineNumber}`;
  const previousHitCount = lineHitCounts.get(lineKey);
  if (previousHitCount === undefined || hitCount > previousHitCount) {
    lineHitCounts.set(lineKey, hitCount);
  }
}
