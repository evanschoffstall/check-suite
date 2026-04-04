import type { Command, SummaryPattern } from "@/types/index.ts";

import { splitLines } from "@/format/index.ts";

type TableRowSummaryPattern = SummaryPattern & { type: "table-row" };

export function buildTableRowSummary(
  pattern: TableRowSummaryPattern,
  cmd: Command,
): null | string {
  const tableRow = splitLines(cmd.output).find((line) =>
    line.includes(pattern.regex),
  );
  if (!tableRow) {
    return null;
  }

  const cells = tableRow
    .split(pattern.cellSep ?? "│")
    .map((cell) => cell.trim())
    .filter(Boolean);
  if (cells.length < 7) {
    return null;
  }

  return pattern.format.replace(
    /\{(\d+)\}/g,
    (_whole: string, indexText: string) => cells[Number(indexText)] ?? "",
  );
}
