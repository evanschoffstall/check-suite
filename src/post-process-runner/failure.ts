import type { StepPostProcessResult } from "../types/index.ts";

export function makePostProcessFailure(
  label: string,
  message: string,
): StepPostProcessResult {
  return {
    messages: [
      {
        text: `${label} post-process ${message}`,
        tone: "fail",
      },
    ],
    status: "fail",
    summary: `${label} post-process ${message}`,
  };
}
