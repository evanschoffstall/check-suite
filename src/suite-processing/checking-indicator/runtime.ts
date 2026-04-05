import { renderCheckingFrame } from "./service";

const DEFAULT_FRAME_INTERVAL_MS = 110;
const [, , frameIntervalArg, startFrameArg] = process.argv;
const frameIntervalMs = parsePositiveInteger(
  frameIntervalArg,
  DEFAULT_FRAME_INTERVAL_MS,
);
let frameIndex = parsePositiveInteger(startFrameArg, 1);

setInterval(() => {
  process.stdout.write(renderCheckingFrame(frameIndex));
  frameIndex += 1;
}, frameIntervalMs);

function parsePositiveInteger(
  value: string | undefined,
  fallback: number,
): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}