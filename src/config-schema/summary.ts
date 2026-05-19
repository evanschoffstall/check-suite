import type { Summary, SummaryPattern } from "@/types/index.ts";

import { isRecord } from "@/foundation/index.ts";

/** Pattern-based summary definition accepted by {@link definePatternSummary}. */
export interface PatternSummaryOptions {
  default: string;
  patterns: readonly SummaryPattern[];
}

/** Shared authoring shape for any summary pattern helper. */
interface SummaryPatternOptions {
  cellSep?: string;
  format: string;
  regex: string;
}

type SummaryPatternType = SummaryPattern["type"];

const PATTERN_FORMAT_KEYS = {
  count: "count",
  literal: "literal",
  match: "match",
  tableRow: "table-row",
} as const satisfies Record<string, SummaryPatternType>;

/** Builds a pattern summary with a single count pattern. */
export function defineCountSummary(
  defaultValue: string,
  options: SummaryPatternOptions,
): Extract<Summary, { type: "pattern" }> {
  return definePatternSummarySet(defaultValue, summaryCount(options));
}

/** Builds a pattern summary with a single literal pattern. */
export function defineLiteralSummary(
  defaultValue: string,
  options: SummaryPatternOptions,
): Extract<Summary, { type: "pattern" }> {
  return definePatternSummarySet(defaultValue, summaryLiteral(options));
}

/** Builds a pattern summary with a single regex-match pattern. */
export function defineMatchSummary(
  defaultValue: string,
  options: SummaryPatternOptions,
): Extract<Summary, { type: "pattern" }> {
  return definePatternSummarySet(defaultValue, summaryMatch(options));
}

/**
 * Builds a pattern-driven summary definition without repeating the raw object
 * shape in user configs.
 */
export function definePatternSummary(
  options: PatternSummaryOptions,
): Extract<Summary, { type: "pattern" }> {
  return {
    default: options.default,
    patterns: [...options.patterns],
    type: "pattern",
  };
}

/** Builds a pattern summary from a variadic pattern list. */
export function definePatternSummarySet(
  defaultValue: string,
  ...patterns: SummaryPattern[]
): Extract<Summary, { type: "pattern" }> {
  return definePatternSummary({ default: defaultValue, patterns });
}

/** Builds a pattern summary with a single table-row pattern. */
export function defineTableRowSummary(
  defaultValue: string,
  options: SummaryPatternOptions,
): Extract<Summary, { type: "pattern" }> {
  return definePatternSummarySet(defaultValue, summaryTableRow(options));
}

/**
 * Normalizes keyed summary descriptors into the runtime summary contract.
 * Configs can name each pattern while the runner still receives an ordered list.
 */
export function normalizeSummaryShorthand(value: unknown): unknown {
  if (!isRecord(value)) return value;

  const patterns = resolveSummaryPatterns(value);
  if (!patterns) return value;

  return {
    default: typeof value.default === "string" ? value.default : "",
    patterns: Object.entries(patterns).map(([name, pattern]) =>
      normalizeSummaryPattern(name, pattern),
    ),
    type: "pattern",
  } satisfies Summary;
}

/** Builds a count-based summary pattern. */
export function summaryCount(options: SummaryPatternOptions): SummaryPattern {
  return { ...options, type: "count" };
}

/** Builds a literal-match summary pattern. */
export function summaryLiteral(options: SummaryPatternOptions): SummaryPattern {
  return { ...options, type: "literal" };
}

/** Builds a regex-capture summary pattern. */
export function summaryMatch(options: SummaryPatternOptions): SummaryPattern {
  return { ...options, type: "match" };
}

/** Builds a table-row summary pattern. */
export function summaryTableRow(
  options: SummaryPatternOptions,
): SummaryPattern {
  return { ...options, type: "table-row" };
}

function isSummaryPatternDescriptor(value: Record<string, unknown>): boolean {
  return (
    typeof value.regex === "string" &&
    Object.keys(PATTERN_FORMAT_KEYS).some(
      (formatKey) => typeof value[formatKey] === "string",
    )
  );
}

function normalizeSummaryPattern(name: string, value: unknown): SummaryPattern {
  if (!isRecord(value) || typeof value.regex !== "string") {
    throw new Error(`invalid summary pattern: ${name}`);
  }

  const entry = Object.entries(PATTERN_FORMAT_KEYS).find(
    ([formatKey]) => typeof value[formatKey] === "string",
  );
  if (!entry) throw new Error(`summary pattern missing format: ${name}`);

  const [formatKey, type] = entry;
  return {
    ...(typeof value.cellSep === "string" && { cellSep: value.cellSep }),
    format: value[formatKey] as string,
    regex: value.regex,
    type,
  };
}

function resolveSummaryPatterns(
  value: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (isSummaryPatternDescriptor(value)) return { summary: value };
  if (isRecord(value.patterns)) return value.patterns;

  const patterns = Object.fromEntries(
    Object.entries(value).filter(
      ([key, pattern]) =>
        key !== "default" && key !== "type" && isRecord(pattern),
    ),
  );
  return Object.keys(patterns).length > 0 ? patterns : undefined;
}
