import type {
  Command,
  InlineTypeScriptPostProcessContext,
  InlineTypeScriptPostProcessor,
  StepConfig,
  StepPostProcessResult,
} from "@/types/index.ts";

import { resolveInlineTypeScriptRunner } from "@/inline-ts/index.ts";

import {
  buildPostProcessContext,
  getRunnablePostProcessConfig,
} from "./context.ts";
import { toStepPostProcessResult } from "./result.ts";

export async function runStepPostProcess(
  step: StepConfig,
  command: Command,
  displayOutput: string,
): Promise<null | StepPostProcessResult> {
  const inlineConfig = getRunnablePostProcessConfig(step, command);
  if (!inlineConfig || command.notFound || command.timedOut) return null;

  try {
    const postProcessor = (await resolveInlineTypeScriptRunner<
      InlineTypeScriptPostProcessContext,
      StepPostProcessResult
    >(inlineConfig.source)) as InlineTypeScriptPostProcessor;
    const normalizedResult = toStepPostProcessResult(
      await postProcessor(
        buildPostProcessContext(
          step,
          command,
          displayOutput,
          inlineConfig.data ?? {},
        ),
      ),
    );
    return (
      normalizedResult ??
      makePostProcessFailure(step.label, "returned an invalid result")
    );
  } catch (error) {
    return makePostProcessFailure(
      step.label,
      `failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function makePostProcessFailure(
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
