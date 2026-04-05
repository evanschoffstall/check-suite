import { ANSI, paint } from "./base.ts";

const SUMMARY_LABEL_WIDTH = 13;
const ANSI_ESCAPE_PATTERN = new RegExp(
  String.raw`\u001B\[[0-?]*[ -/]*[@-~]`,
  "gu",
);

/** Pads or truncates `label` to a fixed display width. */
export const formatSummaryLabel = (label: string): string => {
  if (label.length <= SUMMARY_LABEL_WIDTH) {
    return label.padEnd(SUMMARY_LABEL_WIDTH);
  }

  return `${label.slice(0, SUMMARY_LABEL_WIDTH - 3)}...`;
};

/** Formats a millisecond duration as a human-readable string. */
export const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
};

/** Strips ANSI escape sequences from a string. */
export const stripAnsi = (value: string): string => {
  return value.replace(ANSI_ESCAPE_PATTERN, "");
};

/** Strips ANSI codes, trims whitespace, and normalises CR. */
export const norm = (value: string) =>
  stripAnsi(value).replace(/\r/g, "").trim();

/** Splits a string into non-empty trimmed lines. */
export const splitLines = (value: string) =>
  norm(value)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

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

/** Renders a bold green PASS or bold red FAIL label. */
export const passFail = (status: "fail" | "pass") =>
  paint(
    status === "pass" ? "PASS" : "FAIL",
    ANSI.bold,
    status === "pass" ? ANSI.green : ANSI.red,
  );
