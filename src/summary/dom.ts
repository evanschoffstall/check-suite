import { stripAnsi } from "@/format/index.ts";

const DOM_ASSERTION_RECEIVED_LINE =
  /^Received:\s+(?:HTML|SVG|Window|Document|Element|Node|NodeList|HTMLCollection|Text)\w*\s*\{/;

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

    compacted.push(line.replace(/\{\s*$/, "{ /* DOM tree omitted */ }"));
    const skippedLineCount = skipDomDetailLines(lines, index + 1);
    index += skippedLineCount;

    if (
      index < lines.length &&
      shouldStopSkipping(stripAnsi(lines[index] ?? ""))
    ) {
      index -= 1;
    }

    if (skippedLineCount > 0) {
      compacted.push(
        `  ... omitted ${skippedLineCount} DOM detail line(s) ...`,
      );
    }
  }

  return compacted.join("\n");
}

function shouldStopSkipping(line: string): boolean {
  return (
    line.length === 0 ||
    /^\s*at\s/.test(line) ||
    /^\s*\d+\s+\|/.test(line) ||
    /^error:\s/.test(line) ||
    line.startsWith("Bun v") ||
    /^pass\s/.test(line) ||
    /^fail\s/.test(line)
  );
}

function skipDomDetailLines(lines: string[], startIndex: number): number {
  let skippedLineCount = 0;

  for (let index = startIndex; index < lines.length; index += 1) {
    if (shouldStopSkipping(stripAnsi(lines[index] ?? ""))) {
      break;
    }

    skippedLineCount += 1;
  }

  return skippedLineCount;
}
