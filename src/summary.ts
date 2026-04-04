import type { Command, StepConfig, SummaryPattern } from "./types.ts";

import { norm, splitLines, stripAnsi } from "./format.ts";
import { getStepTokens } from "./tokens.ts";

// ---------------------------------------------------------------------------
// DOM assertion noise compaction
// ---------------------------------------------------------------------------

const DOM_ASSERTION_RECEIVED_LINE =
  /^Received:\s+(?:HTML|SVG|Window|Document|Element|Node|NodeList|HTMLCollection|Text)\w*\s*\{/;

/** Derives the one-line summary text for a completed step. */
export function buildSummary(step: StepConfig, cmd: Command): string {
  if (cmd.exitCode === 0 && step.passMsg !== undefined) return step.passMsg;

  const { summary } = step;
  const tokens = getStepTokens(step);

  if (!summary || summary.type === "simple") {
    if (cmd.exitCode === 0) return "passed";

    if (cmd.timedOut) {
      const timeoutLine =
        splitLines(cmd.output)
          .reverse()
          .find((line) => /\btimeout\b/i.test(line)) ??
        `${step.label} exceeded its timeout`;
      return step.failMsg ? `${step.failMsg}: ${timeoutLine}` : timeoutLine;
    }

    const firstError = splitLines(cmd.output).find((l) => !l.startsWith("$ "));
    return firstError
      ? `${step.failMsg ?? "failed"}: ${firstError}`
      : (step.failMsg ?? "failed");
  }

  // Pattern-based summary
  const n = norm(cmd.output);
  for (const pat of summary.patterns) {
    const result = matchSummaryPattern(pat, n, cmd, tokens);
    if (result !== null) return result;
  }

  return summary.default;
}

// ---------------------------------------------------------------------------
// Summary token resolution
// ---------------------------------------------------------------------------

/**
 * Collapses oversized Happy DOM assertion dumps so test failures stay readable
 * even when Bun serializes full DOM nodes into the reporter output.
 */
export function compactDomAssertionNoise(output: string): string {
  const lines = output.split(/\r?\n/);
  const compacted: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const plainLine = stripAnsi(line);

    if (!DOM_ASSERTION_RECEIVED_LINE.test(plainLine)) {
      compacted.push(line);
      continue;
    }

    let skippedLineCount = 0;
    compacted.push(line.replace(/\{\s*$/, "{ /* DOM tree omitted */ }"));

    for (index += 1; index < lines.length; index += 1) {
      const nextLine = lines[index] ?? "";
      const plainNextLine = stripAnsi(nextLine);

      if (
        plainNextLine.length === 0 ||
        /^\s*at\s/.test(plainNextLine) ||
        /^\s*\d+\s+\|/.test(plainNextLine) ||
        /^error:\s/.test(plainNextLine) ||
        plainNextLine.startsWith("Bun v") ||
        /^pass\s/.test(plainNextLine) ||
        /^fail\s/.test(plainNextLine)
      ) {
        index -= 1;
        break;
      }

      skippedLineCount += 1;
    }

    if (skippedLineCount > 0)
      compacted.push(
        `  ... omitted ${skippedLineCount} DOM detail line(s) ...`,
      );
  }

  return compacted.join("\n");
}

// ---------------------------------------------------------------------------
// Summary building
// ---------------------------------------------------------------------------

function matchSummaryPattern(
  pat: SummaryPattern,
  normalizedOutput: string,
  cmd: Command,
  tokens: Record<string, string>,
): null | string {
  switch (pat.type) {
    case "count": {
      const count = Array.from(
        normalizedOutput.matchAll(new RegExp(pat.regex, "gim")),
      ).length;
      if (count > 0)
        return resolveSummaryTokens(
          pat.format.replaceAll("{count}", String(count)),
          null,
          tokens,
        );
      return null;
    }
    case "literal": {
      if (new RegExp(pat.regex, "i").test(normalizedOutput))
        return resolveSummaryTokens(pat.format, null, tokens);
      return null;
    }
    case "match": {
      const match = new RegExp(pat.regex, "i").exec(normalizedOutput);
      if (match) return resolveSummaryTokens(pat.format, match, tokens);
      return null;
    }
    case "table-row": {
      const tableRow = splitLines(cmd.output).find((line) =>
        line.includes(pat.regex),
      );
      if (!tableRow) return null;

      const cells = tableRow
        .split(pat.cellSep ?? "│")
        .map((cell) => cell.trim())
        .filter(Boolean);
      if (cells.length < 7) return null;

      return pat.format.replace(
        /\{(\d+)\}/g,
        (_whole: string, indexText: string) => cells[Number(indexText)] ?? "",
      );
    }
  }
}

/**
 * Resolves `{n}` positional match groups and `{token}` named tokens in a
 * summary format string.
 */
function resolveSummaryTokens(
  format: string,
  match: null | RegExpMatchArray,
  tokens: Record<string, string>,
): string {
  return format.replace(/\{(\w+)\}/g, (whole: string, key: string) => {
    if (/^\d+$/.test(key)) return match?.[Number(key)] ?? "";
    return tokens[`{${key}}`] ?? whole;
  });
}
