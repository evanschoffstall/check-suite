import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type {
  Command,
  InlineTypeScriptPostProcessContext,
  InlineTypeScriptPostProcessor,
  StepConfig,
  StepPostProcessResult,
} from "./types.ts";

import { stripAnsi } from "./format.ts";
import {
  resolveInlineTypeScriptRunner,
  toInlineTypeScriptConfig,
} from "./inline-ts.ts";
import { toStepPostProcessResult } from "./post-process-result.ts";
import { compactDomAssertionNoise } from "./summary.ts";
import { getStepTokens, resolveTokenString } from "./tokens.ts";

export async function runStepPostProcess(
  step: StepConfig,
  command: Command,
  displayOutput: string,
): Promise<null | StepPostProcessResult> {
  const inlineConfig = getRunnablePostProcessConfig(step, command);
  if (!inlineConfig || command.notFound || command.timedOut) return null;

  return executePostProcessor(step, command, displayOutput, inlineConfig);
}

function buildPostProcessContext(
  step: StepConfig,
  command: Command,
  displayOutput: string,
  data: Record<string, unknown>,
): InlineTypeScriptPostProcessContext {
  const tokens = getStepTokens(step);
  return {
    command,
    cwd: process.cwd(),
    data,
    displayOutput,
    existsSync,
    helpers: {
      compactDomAssertionNoise,
      stripAnsi,
    },
    join,
    readFileSync,
    resolveTokenString: (value) => resolveTokenString(value, tokens),
    step,
    tokens,
  };
}

async function executePostProcessor(
  step: StepConfig,
  command: Command,
  displayOutput: string,
  inlineConfig: {
    data?: Record<string, unknown>;
    source: InlineTypeScriptPostProcessor | string;
  },
): Promise<StepPostProcessResult> {
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

function getRunnablePostProcessConfig(
  step: StepConfig,
  command: Command,
): null | {
  data?: Record<string, unknown>;
  source: InlineTypeScriptPostProcessor | string;
} {
  if (command.notFound || command.timedOut) return null;
  return toInlineTypeScriptConfig<
    InlineTypeScriptPostProcessContext,
    StepPostProcessResult
  >(step.postProcess) as null | {
    data?: Record<string, unknown>;
    source: InlineTypeScriptPostProcessor | string;
  };
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
