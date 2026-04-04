import type { Command, Summary, SummaryPattern } from "@/types/index.ts";

import { norm } from "@/format/index.ts";
import { countSafeMatches, execSafeRegExp, testSafeRegExp } from "@/regex.ts";

import { buildTableRowSummary } from "./table-row.ts";

type CountSummaryPattern = SummaryPattern & { type: "count" };
type LiteralSummaryPattern = SummaryPattern & { type: "literal" };
type MatchSummaryPattern = SummaryPattern & { type: "match" };
type TableRowSummaryPattern = SummaryPattern & { type: "table-row" };

/** Resolves pattern-based summary output for a completed step. */
export function buildPatternSummary(
  summary: Extract<Summary, { type: "pattern" }>,
  cmd: Command,
  tokens: Record<string, string>,
): string {
  const normalizedOutput = norm(cmd.output);

  for (const pattern of summary.patterns) {
    const result = matchSummaryPattern(pattern, normalizedOutput, cmd, tokens);
    if (result !== null) {
      return result;
    }
  }

  return summary.default;
}

function buildCountSummary(
  pattern: CountSummaryPattern,
  normalizedOutput: string,
  tokens: Record<string, string>,
): null | string {
  const count = countSafeMatches(normalizedOutput, pattern.regex);
  return count > 0
    ? resolveSummaryTokens(
        pattern.format.replaceAll("{count}", String(count)),
        null,
        tokens,
      )
    : null;
}

function buildLiteralSummary(
  pattern: LiteralSummaryPattern,
  normalizedOutput: string,
  tokens: Record<string, string>,
): null | string {
  return testSafeRegExp(normalizedOutput, pattern.regex)
    ? resolveSummaryTokens(pattern.format, null, tokens)
    : null;
}

function buildRegexMatchSummary(
  pattern: MatchSummaryPattern,
  normalizedOutput: string,
  tokens: Record<string, string>,
): null | string {
  const match = execSafeRegExp(normalizedOutput, pattern.regex);
  return match ? resolveSummaryTokens(pattern.format, match, tokens) : null;
}

function matchSummaryPattern(
  pattern: SummaryPattern,
  normalizedOutput: string,
  cmd: Command,
  tokens: Record<string, string>,
): null | string {
  if (pattern.type === "count") {
    return buildCountSummary(
      pattern as CountSummaryPattern,
      normalizedOutput,
      tokens,
    );
  }

  if (pattern.type === "literal") {
    return buildLiteralSummary(
      pattern as LiteralSummaryPattern,
      normalizedOutput,
      tokens,
    );
  }

  if (pattern.type === "match") {
    return buildRegexMatchSummary(
      pattern as MatchSummaryPattern,
      normalizedOutput,
      tokens,
    );
  }

  return buildTableRowSummary(pattern as TableRowSummaryPattern, cmd);
}

function resolveSummaryTokens(
  format: string,
  match: null | RegExpMatchArray,
  tokens: Record<string, string>,
): string {
  return format.replace(/\{(\w+)\}/g, (whole: string, key: string) => {
    if (/^\d+$/.test(key)) {
      return match?.[Number(key)] ?? "";
    }

    return tokens[`{${key}}`] ?? whole;
  });
}
