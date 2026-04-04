import type {
  PostProcessMessage,
  PostProcessSection,
  PostProcessTone,
} from "./types/index.ts";

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

// ---------------------------------------------------------------------------
// Primitive formatting
// ---------------------------------------------------------------------------

/** Wraps `text` with the given ANSI codes, resetting at the end. */
export const paint = (text: string, ...codes: string[]) =>
  `${codes.join("")}${text}${ANSI.reset}`;

/** Renders a bold green PASS or bold red FAIL label. */
export const passFail = (status: "fail" | "pass") =>
  paint(
    status === "pass" ? "PASS" : "FAIL",
    ANSI.bold,
    status === "pass" ? ANSI.green : ANSI.red,
  );

const SUMMARY_LABEL_WIDTH = 13;

/** Pads or truncates `label` to a fixed display width. */
export const formatSummaryLabel = (label: string): string => {
  if (label.length <= SUMMARY_LABEL_WIDTH)
    return label.padEnd(SUMMARY_LABEL_WIDTH);
  return `${label.slice(0, SUMMARY_LABEL_WIDTH - 3)}...`;
};

/** Formats a millisecond duration as a human-readable string. */
export const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
};

/** Renders a full summary row with status, label, details, and optional timing. */
export const row = (
  label: string,
  status: "fail" | "pass",
  details = "",
  durationMs?: number,
) => {
  const timing =
    durationMs !== undefined
      ? ` ${paint(formatDuration(durationMs), ANSI.gray)}`
      : "";
  return `${passFail(status)} ${paint(formatSummaryLabel(label), ANSI.bold)} ${details}${timing}`;
};

/** Renders a horizontal divider line. */
export const divider = () =>
  paint("────────────────────────────────", ANSI.gray);

// ---------------------------------------------------------------------------
// String utilities
// ---------------------------------------------------------------------------

/** Strips ANSI escape sequences from a string. */
export const stripAnsi = (v: string): string => {
  let r = v;
  for (;;) {
    const s = r.indexOf("\u001B[");
    if (s < 0) return r;
    const rem = r.slice(s + 2);
    const m = /^[0-9;]*m/.exec(rem);
    if (!m) return r;
    r = r.slice(0, s) + rem.slice(m[0].length);
  }
};

/** Strips ANSI codes, trims whitespace, and normalises CR. */
export const norm = (v: string) => stripAnsi(v).replace(/\r/g, "").trim();

/** Splits a string into non-empty trimmed lines. */
export const splitLines = (v: string) =>
  norm(v)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

// ---------------------------------------------------------------------------
// ANSI color for post-process tones
// ---------------------------------------------------------------------------

/** Maps a post-process tone to the corresponding ANSI color code. */
export function getToneColor(tone: PostProcessTone | undefined): string {
  switch (tone) {
    case "fail": {
      return ANSI.red;
    }
    case "pass": {
      return ANSI.green;
    }
    case "warn": {
      return ANSI.yellow;
    }
    default: {
      return ANSI.gray;
    }
  }
}

// ---------------------------------------------------------------------------
// Console output helpers
// ---------------------------------------------------------------------------

/** Prints a list of post-processor messages to stdout. */
export function printPostProcessMessages(messages: PostProcessMessage[]): void {
  for (const message of messages) {
    console.info(
      `\n${paint(message.text, ANSI.bold, getToneColor(message.tone))}`,
    );
  }
}

/** Prints a list of post-processor sections (titled bullet lists) to stdout. */
export function printPostProcessSections(sections: PostProcessSection[]): void {
  for (const section of sections) {
    const color = getToneColor(section.tone);
    console.info(`\n${paint(section.title, ANSI.bold, color)}`);
    for (const item of section.items) {
      console.info(`  ${paint("•", color)} ${paint(item, color)}`);
    }
  }
}

/** Prints a labeled step output block to stdout. */
export function printStepOutput(label: string, output: string): void {
  console.info(`\n${paint(label, ANSI.bold)}`);
  if (!output.trim()) console.info(paint("(no output)", ANSI.gray));
  else
    process.stdout.write(
      output.endsWith("\n") ? output : `${output.replace(/\s+$/g, "")}\n`,
    );
}
