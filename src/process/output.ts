import type { OutputFilter } from "../types/index.ts";

import { stripAnsi } from "../format.ts";
import { testSafeRegExp } from "../regex.ts";

/** Applies the configured output filter rule to raw step output. */
export function applyOutputFilter(
  filter: OutputFilter,
  output: string,
): string {
  return output
    .split(/\r?\n/)
    .filter((line) => !testSafeRegExp(stripAnsi(line), filter.pattern))
    .join("\n")
    .trimEnd();
}
