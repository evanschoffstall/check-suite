const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const CLEAR_LINE = "\r\x1b[2K";
const HIDE_CURSOR = "\x1b[?25l";
const SHOW_CURSOR = "\x1b[?25h";

const GLYPHS = ["✦", "⯍", "✦", "⯍", "⯏", "✧", "⯏", "✧"] as const;
const MESSAGE = "Checking";
const GRADIENT_STOPS = [
  [255, 255, 255],
  [246, 246, 248],
  [238, 238, 242],
  [228, 228, 234],
  [212, 212, 220],
  [202, 202, 210],
  [176, 176, 184],
  [150, 150, 156],
  [124, 124, 128],
] as const;
const TEXT_GRADIENT_STOPS = [
  [124, 124, 128],
  [150, 150, 156],
  [176, 176, 184],
  [202, 202, 210],
  [228, 228, 234],
  [246, 246, 248],
  [255, 255, 255],
  [238, 238, 242],
  [212, 212, 220],
] as const;
const TRAIL_GRADIENT_STOPS = [
  [96, 96, 96],
  [128, 128, 128],
  [164, 164, 164],
  [208, 208, 208],
  [246, 246, 246],
  [208, 208, 208],
  [164, 164, 164],
  [128, 128, 128],
] as const;
const TRAIL_PATTERNS = [".", "..", "...", " ..", "  ."] as const;
const GLYPH_HOLD_FRAMES = 10;
const GLYPH_COLOR_HOLD_FRAMES = 3;
const GLYPH_COLUMN_WIDTH = 2;
const MESSAGE_COLUMN_WIDTH = MESSAGE.length;
const TRAIL_COLUMN_WIDTH = 3;
const INDICATOR_COLUMN_WIDTH =
  GLYPH_COLUMN_WIDTH + 1 + MESSAGE_COLUMN_WIDTH + TRAIL_COLUMN_WIDTH;
const DETAIL_SEPARATOR = "  ";
const DEFAULT_FRAME_INTERVAL_MS = 110;
const STATIC_CHECKING_MESSAGE = `${MESSAGE}...`;
const DEFAULT_DETAIL_WIDTH = 120;

/** Exposes imperative lifecycle control for an active checking indicator. */
export interface CheckingIndicatorController {
  setDetailLine: (detail: null | { label: string; output: string }) => void;
  stop: () => Promise<void>;
}

/** Configures whether and how the animated checking indicator renders. */
export interface CheckingIndicatorOptions {
  displayMode?: CheckingIndicatorDisplayMode;
  enabled?: boolean;
  frameIntervalMs?: number;
  output?: TerminalWriter;
}

interface ActiveIndicatorRenderer {
  setDetailLine: (detail: string) => void;
  stop: () => Promise<void>;
}

type CheckingIndicatorDisplayMode = "animated" | "auto" | "static";

/** Terminal-like writer used by the checking indicator for testability. */
interface TerminalWriter {
  columns?: number;
  isTTY?: boolean;
  write(chunk: string): boolean;
}

/** Builds one animated frame for the suite checking indicator. */
export function renderCheckingFrame(frameIndex: number, detailLine = ""): string {
  const glyph =
    GLYPHS[
      Math.floor(frameIndex / GLYPH_HOLD_FRAMES) % GLYPHS.length
    ];
  const glyphPhase = frameIndex / GLYPH_COLOR_HOLD_FRAMES;
  const textPhase = frameIndex * 0.35;
  const trailPhase = frameIndex * 1.15;
  const glyphColumn = glyph.padEnd(GLYPH_COLUMN_WIDTH, " ");
  const trail = resolveTrailForFrame(frameIndex);
  const messagePadding = " ".repeat(
    MESSAGE_COLUMN_WIDTH + TRAIL_COLUMN_WIDTH - MESSAGE.length - trail.length,
  );
  const detail =
    detailLine.length > 0
      ? `${DETAIL_SEPARATOR}${DIM}${detailLine}${RESET}`
      : "";

  return [
    CLEAR_LINE,
    colorizeText(glyphColumn, glyphPhase, GRADIENT_STOPS, true),
    " ",
    colorizeText(
      MESSAGE,
      textPhase + GLYPH_COLUMN_WIDTH,
      TEXT_GRADIENT_STOPS,
      true,
    ),
    colorizeText(trail, trailPhase, TRAIL_GRADIENT_STOPS),
    colorizeText(
      messagePadding,
      textPhase + MESSAGE.length,
      TEXT_GRADIENT_STOPS,
    ),
    RESET,
    detail,
  ].join("");
}

/** Restricts animation to interactive terminals so logs and CI output stay clean. */
export function shouldAnimateCheckingIndicator(
  output: TerminalWriter = process.stdout,
): boolean {
  return (
    output.isTTY === true &&
    process.env.CI !== "true" &&
    process.env.TERM !== "dumb"
  );
}

/** Starts the checking indicator immediately and returns a controller to stop it. */
export function startCheckingIndicator(
  options?: CheckingIndicatorOptions,
): CheckingIndicatorController {
  const output = options?.output ?? process.stdout;
  const isEnabled = options?.enabled ?? true;
  if (!isEnabled) {
    return createNoopCheckingIndicatorController();
  }

  const displayMode = resolveCheckingIndicatorDisplayMode(
    options?.displayMode,
    output,
  );
  if (displayMode === "none") {
    return createNoopCheckingIndicatorController();
  }
  if (displayMode === "static") {
    output.write(`${STATIC_CHECKING_MESSAGE}\n`);
    return createNoopCheckingIndicatorController();
  }

  const frameIntervalMs = options?.frameIntervalMs ?? DEFAULT_FRAME_INTERVAL_MS;
  const detailWidth = resolveDetailWidth(output);
  output.write(HIDE_CURSOR);
  output.write(renderCheckingFrame(0));
  const indicatorRenderer = startInProcessIndicatorRenderer(
    output,
    frameIntervalMs,
    detailWidth,
  );
  let isStopped = false;

  return {
    setDetailLine(detail): void {
      indicatorRenderer.setDetailLine(formatDetailLine(detail, detailWidth));
    },
    async stop(): Promise<void> {
      if (isStopped) {
        return;
      }
      isStopped = true;
      await indicatorRenderer.stop();
      output.write(`${CLEAR_LINE}${SHOW_CURSOR}`);
    },
  };
}

/** Yields once so the first drawn frame can reach the terminal before heavy work starts. */
export function waitForIndicatorPaint(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

/** Runs work while rendering the animated checking indicator. */
export async function withCheckingIndicator<T>(
  task: (indicator: CheckingIndicatorController) => Promise<T>,
  options?: CheckingIndicatorOptions,
): Promise<T> {
  const indicator = startCheckingIndicator(options);

  try {
    await waitForIndicatorPaint();
    return await task(indicator);
  } finally {
    await indicator.stop();
  }
}

function colorizeText(
  text: string,
  phase: number,
  gradientStops: readonly (readonly [number, number, number])[],
  bold = false,
): string {
  return Array.from(text)
    .map((char, index) => {
      const [red, green, blue] = interpolateGradientColor(
        phase - index * 0.8,
        gradientStops,
      );
      const weight = bold ? BOLD : "";
      return `${weight}\x1b[38;2;${String(red)};${String(green)};${String(blue)}m${char}`;
    })
    .join("");
}

function createNoopCheckingIndicatorController(): CheckingIndicatorController {
  return {
    setDetailLine(): void {
      // Intentionally empty.
    },
    stop(): Promise<void> {
      return Promise.resolve();
    },
  };
}

function formatDetailLine(
  detail: null | { label: string; output: string },
  maxWidth: number,
): string {
  if (!detail) {
    return "";
  }

  return detail.output.length > 0
    ? truncateDetailLine(detail.output, maxWidth)
    : "";
}

function interpolateGradientColor(
  phase: number,
  gradientStops: readonly (readonly [number, number, number])[],
): [number, number, number] {
  const normalizedPhase =
    ((phase % gradientStops.length) + gradientStops.length) %
    gradientStops.length;
  const lowerIndex = Math.floor(normalizedPhase);
  const upperIndex = (lowerIndex + 1) % gradientStops.length;
  const mix = normalizedPhase - lowerIndex;
  const lower = gradientStops[lowerIndex];
  const upper = gradientStops[upperIndex];

  return [
    mixColorChannel(lower[0], upper[0], mix),
    mixColorChannel(lower[1], upper[1], mix),
    mixColorChannel(lower[2], upper[2], mix),
  ];
}

function mixColorChannel(start: number, end: number, mix: number): number {
  return Math.round(start + (end - start) * mix);
}

function resolveCheckingIndicatorDisplayMode(
  requestedDisplayMode: CheckingIndicatorDisplayMode | undefined,
  output: TerminalWriter,
): "animated" | "none" | "static" {
  if (requestedDisplayMode === "static") {
    return "static";
  }

  if (requestedDisplayMode === "animated") {
    return shouldAnimateCheckingIndicator(output) ? "animated" : "none";
  }

  return shouldAnimateCheckingIndicator(output) ? "animated" : "none";
}

function resolveDetailWidth(output: TerminalWriter): number {
  const terminalWidth = output.columns;
  if (
    typeof terminalWidth !== "number" ||
    terminalWidth <= INDICATOR_COLUMN_WIDTH + DETAIL_SEPARATOR.length
  ) {
    return DEFAULT_DETAIL_WIDTH;
  }

  return Math.max(
    24,
    terminalWidth - INDICATOR_COLUMN_WIDTH - DETAIL_SEPARATOR.length - 1,
  );
}

function resolveTrailForFrame(frameIndex: number): string {
  return TRAIL_PATTERNS[Math.floor(frameIndex / 5) % TRAIL_PATTERNS.length];
}

function startInProcessIndicatorRenderer(
  output: TerminalWriter,
  frameIntervalMs: number,
  detailWidth: number,
): ActiveIndicatorRenderer {
  let detailLine = formatDetailLine(null, detailWidth);
  let frameIndex = 1;
  const intervalId = setInterval(() => {
    output.write(renderCheckingFrame(frameIndex, detailLine));
    frameIndex += 1;
  }, frameIntervalMs);

  return {
    setDetailLine(nextDetailLine: string): void {
      detailLine = nextDetailLine;
      output.write(renderCheckingFrame(frameIndex, detailLine));
    },
    stop(): Promise<void> {
      clearInterval(intervalId);
      return Promise.resolve();
    },
  };
}

function truncateDetailLine(text: string, maxWidth: number): string {
  const singleLineText = text.replace(/\s+/gu, " ").trim();
  if (singleLineText.length <= maxWidth) {
    return singleLineText;
  }

  return `${singleLineText.slice(0, Math.max(1, maxWidth - 1)).trimEnd()}…`;
}