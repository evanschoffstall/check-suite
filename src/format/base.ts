// ---------------------------------------------------------------------------
// ANSI escape codes
// ---------------------------------------------------------------------------

export const ANSI = {
  bold: "\x1b[1m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  reset: "\x1b[0m",
  yellow: "\x1b[33m",
} as const;

/** Wraps `text` with the given ANSI codes, resetting at the end. */
export const paint = (text: string, ...codes: string[]) =>
  `${codes.join("")}${text}${ANSI.reset}`;
