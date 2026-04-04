import type { FileMetrics, FunctionMetrics } from "./contracts.ts";

export function collectFileMetrics(
  functions: FunctionMetrics[],
): FileMetrics[] {
  const metricsByPath = new Map<string, FileMetrics>();

  for (const entry of functions) {
    const existingMetrics = metricsByPath.get(entry.path) ?? {
      ccn: 0,
      functionCount: 0,
      nloc: 0,
      path: entry.path,
      tokenCount: 0,
    };

    existingMetrics.ccn += entry.ccn;
    existingMetrics.functionCount += 1;
    existingMetrics.nloc += entry.nloc;
    existingMetrics.tokenCount += entry.tokenCount;
    metricsByPath.set(entry.path, existingMetrics);
  }

  return [...metricsByPath.values()].sort(
    (left, right) => right.ccn - left.ccn,
  );
}

export { collectWorkspaceFileMetrics } from "./workspace-file-scan.ts";
