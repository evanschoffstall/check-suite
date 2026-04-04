import type {
  Command,
  KillableProcess,
  OutputFilter,
  RunOptions,
  StreamCollector,
} from "./types.ts";

import { DECLARED_BUNX_TARGETS } from "./config.ts";
import { stripAnsi } from "./format.ts";
import {
  appendTimedOutDrainMessage,
  appendTimedOutMessage,
  createDelay,
  parsePositiveTimeoutMs,
} from "./timeout.ts";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROCESS_KILL_GRACE_MS = 250;
const STREAM_FLUSH_GRACE_MS = 250;

// ---------------------------------------------------------------------------
// bunx availability guard
// ---------------------------------------------------------------------------

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
