import type { FunctionMetrics } from "@/quality/complexity/shared/index.ts";

export function parseLizardCsv(csvOutput: string): FunctionMetrics[] {
  return csvOutput
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => parseLizardCsvLine(line))
    .map((cells) => {
      if (cells.length < 11) {
        throw new Error(`Unexpected lizard CSV row: ${cells.join(",")}`);
      }

      const [
        nloc,
        ccn,
        tokenCount,
        parameterCount,
        length,
        location,
        path,
        functionName,
        _signature,
        startLine,
        endLine,
      ] = cells;
      const resolvedFunctionName =
        functionName.length > 0 ? functionName : "(anonymous)";
      const resolvedLocation =
        location.length > 0
          ? location
          : path.length > 0
            ? path
            : "unknown-location";
      const resolvedPath = path.length > 0 ? path : "unknown-file";

      return {
        ccn: Number.parseInt(ccn, 10),
        endLine: Number.parseInt(endLine, 10),
        functionName: resolvedFunctionName,
        length: Number.parseInt(length, 10),
        location: resolvedLocation,
        nestingDepth: 0,
        nloc: Number.parseInt(nloc, 10),
        parameterCount: Number.parseInt(parameterCount, 10),
        path: resolvedPath,
        startLine: Number.parseInt(startLine, 10),
        tokenCount: Number.parseInt(tokenCount, 10),
      } satisfies FunctionMetrics;
    });
}

export function parseLizardCsvLine(line: string): string[] {
  return (line.match(/(?:^|,)("(?:[^"]|"")*"|[^,]*)/g) ?? []).map((value) => {
    const cell = value.startsWith(",") ? value.slice(1) : value;
    return cell.startsWith('"') && cell.endsWith('"')
      ? cell.slice(1, -1).replaceAll('""', '"')
      : cell;
  });
}
