import type { FunctionMetrics } from "./contracts.ts";

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

      return {
        ccn: Number.parseInt(ccn ?? "0", 10),
        endLine: Number.parseInt(endLine ?? "0", 10),
        functionName:
          functionName && functionName.length > 0
            ? functionName
            : "(anonymous)",
        length: Number.parseInt(length ?? "0", 10),
        location: location ?? path ?? "unknown-location",
        nestingDepth: 0,
        nloc: Number.parseInt(nloc ?? "0", 10),
        parameterCount: Number.parseInt(parameterCount ?? "0", 10),
        path: path ?? "unknown-file",
        startLine: Number.parseInt(startLine ?? "0", 10),
        tokenCount: Number.parseInt(tokenCount ?? "0", 10),
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
