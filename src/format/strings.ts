import type { SuiteRenderMode } from "@/types/index.ts";

import { ANSI, paint } from "./base.ts";

const SUMMARY_DETAIL_MAX_WIDTH = 60;
const SUMMARY_DETAIL_MIN_WIDTH = 16;
const SUMMARY_LABEL_MAX_WIDTH = 24;
const SUMMARY_LABEL_MIN_WIDTH = 13;
const SUMMARY_STATUS_WIDTH = 6;
const ANSI_ESCAPE_PATTERN = new RegExp(
  String.raw`\u001B\[[0-?]*[ -/]*[@-~]`,
  "gu",
);

interface SummaryRowLayout {
  detailWidth: number;
  durationWidth: number;
  labelWidth: number;
  totalWidth: number;
}

interface SummaryRowOptions {
  details: string;
  durationMs?: number;
  label: string;
  layout?: SummaryRowLayout;
  renderMode?: SuiteRenderMode;
  status: "fail" | "pass";
}

const PLAIN_SEPARATOR = " | ";

/** Pads or truncates `label` to a fixed display width. */
export const formatSummaryLabel = (label: string): string => {
  return fitSummaryCell(label, SUMMARY_LABEL_MIN_WIDTH);
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

/** Measures a stable table layout for the suite quality summary. */
export const buildSummaryRowLayout = (
  rows: Pick<SummaryRowOptions, "details" | "durationMs" | "label">[],
): SummaryRowLayout => {
  const labelWidth = clamp(
    Math.max(...rows.map((row) => stripAnsi(row.label).length), 0),
    SUMMARY_LABEL_MIN_WIDTH,
    SUMMARY_LABEL_MAX_WIDTH,
  );
  const detailWidth = clamp(
    Math.max(...rows.map((row) => stripAnsi(row.details).length), 0),
    SUMMARY_DETAIL_MIN_WIDTH,
    SUMMARY_DETAIL_MAX_WIDTH,
  );
  const durationWidth = Math.max(
    ...rows.map((row) =>
      row.durationMs === undefined ? 0 : formatDuration(row.durationMs).length,
    ),
    4,
  );
  const totalWidth =
    SUMMARY_STATUS_WIDTH +
    separatorWidth("plain") * 3 +
    labelWidth +
    detailWidth +
    durationWidth;

  return {
    detailWidth,
    durationWidth,
    labelWidth,
    totalWidth,
  };
};

/** Renders the summary table header row. */
export const summaryHeaderRow = (
  layout: SummaryRowLayout,
  renderMode: SuiteRenderMode = "styled",
): string => {
  const cells = [
    alignCell("RESULT", SUMMARY_STATUS_WIDTH),
    alignCell("CHECK", layout.labelWidth),
    alignCell("SUMMARY", layout.detailWidth),
    alignCell("TIME", layout.durationWidth, "start"),
  ];
  const plainRow = joinCells(cells, "plain");

  if (renderMode === "plain") {
    return plainRow;
  }

  return joinCells(
    cells.map((cell) => paint(cell, ANSI.bold, ANSI.cyan)),
    "styled",
  );
};

/** Renders a full summary row with status, label, details, and optional timing. */
export const row = ({
  details,
  durationMs,
  label,
  layout,
  renderMode = "styled",
  status,
}: SummaryRowOptions): string => {
  const summaryLayout =
    layout ?? buildSummaryRowLayout([{ details, durationMs, label }]);
  const plainStatus = alignCell(
    status === "pass" ? "PASS" : "FAIL",
    SUMMARY_STATUS_WIDTH,
  );
  const plainLabel = alignCell(
    fitSummaryCell(label, summaryLayout.labelWidth),
    summaryLayout.labelWidth,
  );
  const plainDetails = alignCell(
    fitSummaryCell(details, summaryLayout.detailWidth),
    summaryLayout.detailWidth,
  );
  const plainDuration = alignCell(
    durationMs === undefined ? "" : formatDuration(durationMs),
    summaryLayout.durationWidth,
    "start",
  );

  if (renderMode === "plain") {
    return joinCells(
      [plainStatus, plainLabel, plainDetails, plainDuration],
      renderMode,
    );
  }

  return joinCells(
    [
      paint(plainStatus, ANSI.bold, status === "pass" ? ANSI.green : ANSI.red),
      paint(plainLabel, ANSI.bold),
      plainDetails,
      paint(plainDuration, ANSI.gray),
    ],
    renderMode,
  );
};

/** Renders a horizontal divider line. */
export const divider = (renderMode: SuiteRenderMode = "styled", width = 32) => {
  const line = (renderMode === "plain" ? "-" : "─").repeat(width);
  return renderMode === "plain" ? line : paint(line, ANSI.gray);
};

/** Renders a bold green PASS or bold red FAIL label. */
export const passFail = (
  status: "fail" | "pass",
  renderMode: SuiteRenderMode = "styled",
) =>
  renderMode === "plain"
    ? status === "pass"
      ? "PASS"
      : "FAIL"
    : paint(
        status === "pass" ? "PASS" : "FAIL",
        ANSI.bold,
        status === "pass" ? ANSI.green : ANSI.red,
      );

function alignCell(
  value: string,
  width: number,
  alignment: "end" | "start" = "end",
): string {
  const visibleLength = stripAnsi(value).length;
  if (visibleLength >= width) {
    return value;
  }

  const padding = " ".repeat(width - visibleLength);
  return alignment === "start" ? `${padding}${value}` : `${value}${padding}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function fitSummaryCell(value: string, width: number): string {
  const normalizedValue = stripAnsi(value);
  if (normalizedValue.length <= width) {
    return normalizedValue;
  }

  return `${normalizedValue.slice(0, Math.max(0, width - 3))}...`;
}

function joinCells(cells: string[], renderMode: SuiteRenderMode): string {
  const separator =
    renderMode === "plain" ? PLAIN_SEPARATOR : ` ${paint("│", ANSI.gray)} `;
  return cells.join(separator);
}

function separatorWidth(renderMode: SuiteRenderMode): number {
  return renderMode === "plain"
    ? PLAIN_SEPARATOR.length
    : PLAIN_SEPARATOR.length;
}
