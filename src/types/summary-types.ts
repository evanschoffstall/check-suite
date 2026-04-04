export interface OutputFilter {
  pattern: string;
  type: "stripLines";
}

export type Summary =
  | { default: string; patterns: SummaryPattern[]; type: "pattern" }
  | { type: "simple" };

export interface SummaryPattern {
  cellSep?: string;
  format: string;
  regex: string;
  type: "count" | "literal" | "match" | "table-row";
}
