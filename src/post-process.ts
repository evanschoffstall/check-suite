import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type {
  Command,
  InlineTypeScriptPostProcessContext,
  InlineTypeScriptPostProcessor,
  PostProcessMessage,
  PostProcessSection,
  PostProcessTone,
  ProcessedCheck,
  StepConfig,
  StepPostProcessResult,
} from "./types.ts";

import { stripAnsi } from "./format.ts";
import {
  resolveInlineTypeScriptRunner,
  toInlineTypeScriptConfig,
} from "./inline-ts.ts";
import { compactDomAssertionNoise } from "./summary.ts";
import { getStepTokens, resolveTokenString } from "./tokens.ts";
import { isRecord } from "./types.ts";

// ---------------------------------------------------------------------------
// Tone normalization
// ---------------------------------------------------------------------------

/**
 * Runs the compiled inline TypeScript post-processor for a step, injecting a
 * typed context with the command result, display output, and filesystem helpers.
 * Returns `null` when the step has no post-processor, timed out, or was not found.
 */
export async function runStepPostProcess(
  step: StepConfig,
  command: Command,
  displayOutput: string,
): Promise<null | StepPostProcessResult> {
  const inlineConfig = toInlineTypeScriptConfig<
    InlineTypeScriptPostProcessContext,
    StepPostProcessResult
  >(step.postProcess);
  if (!inlineConfig || command.notFound || command.timedOut) return null;

  try {
    const postProcessor = (await resolveInlineTypeScriptRunner<
      InlineTypeScriptPostProcessContext,
      StepPostProcessResult
    >(inlineConfig.source)) as InlineTypeScriptPostProcessor;

    const tokens = getStepTokens(step);
    const context: InlineTypeScriptPostProcessContext = {
      command,
      cwd: process.cwd(),
      data: inlineConfig.data ?? {},
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
    const processedResult = await postProcessor(context);

    const normalizedResult = toStepPostProcessResult(processedResult);
    if (normalizedResult) return normalizedResult;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      messages: [
        {
          text: `${step.label} post-process failed: ${message}`,
          tone: "fail",
        },
      ],
      status: "fail",
      summary: `${step.label} post-process failed`,
    };
  }

  return {
    messages: [
      {
        text: `${step.label} post-process returned an invalid result`,
        tone: "fail",
      },
    ],
    status: "fail",
    summary: `${step.label} post-process returned an invalid result`,
  };
}

// ---------------------------------------------------------------------------
// Result coercers — validate and narrow unknown post-processor return values
// ---------------------------------------------------------------------------

function normalizeTone(value: unknown): PostProcessTone | undefined {
  return value === "fail" ||
    value === "info" ||
    value === "pass" ||
    value === "warn"
    ? value
    : undefined;
}

function toPostProcessMessage(value: unknown): null | PostProcessMessage {
  if (!isRecord(value)) return null;
  const text = value.text;
  if (typeof text !== "string") return null;
  return { text, tone: normalizeTone(value.tone) };
}

function toPostProcessSection(value: unknown): null | PostProcessSection {
  if (!isRecord(value)) return null;
  const title = value.title;
  const items = value.items;
  if (typeof title !== "string" || !Array.isArray(items)) {
    return null;
  }

  const normalizedItems = items.filter(
    (item): item is string => typeof item === "string",
  );
  if (normalizedItems.length !== items.length) {
    return null;
  }

  return { items: normalizedItems, title, tone: normalizeTone(value.tone) };
}

function toProcessedCheck(value: unknown): null | ProcessedCheck {
  if (!isRecord(value)) return null;
  const label = value.label;
  const details = value.details;
  const status = value.status;
  if (
    typeof label !== "string" ||
    typeof details !== "string" ||
    (status !== "fail" && status !== "pass")
  ) {
    return null;
  }
  return { details, label, status };
}

// ---------------------------------------------------------------------------
// Step post-process runner
// ---------------------------------------------------------------------------

function toStepPostProcessResult(value: unknown): null | StepPostProcessResult {
  if (!isRecord(value)) return null;

  const { extraChecks, messages, output, sections, status, summary } = value;

  if (output !== undefined && typeof output !== "string") return null;
  if (summary !== undefined && typeof summary !== "string") return null;
  if (status !== undefined && status !== "fail" && status !== "pass")
    return null;

  const normalizedExtraChecks =
    extraChecks === undefined
      ? undefined
      : Array.isArray(extraChecks)
        ? extraChecks
            .map((entry) => toProcessedCheck(entry))
            .filter((entry): entry is ProcessedCheck => entry !== null)
        : null;
  if (normalizedExtraChecks === null) return null;

  const normalizedMessages =
    messages === undefined
      ? undefined
      : Array.isArray(messages)
        ? messages
            .map((entry) => toPostProcessMessage(entry))
            .filter((entry): entry is PostProcessMessage => entry !== null)
        : null;
  if (normalizedMessages === null) return null;

  const normalizedSections =
    sections === undefined
      ? undefined
      : Array.isArray(sections)
        ? sections
            .map((entry) => toPostProcessSection(entry))
            .filter((entry): entry is PostProcessSection => entry !== null)
        : null;
  if (normalizedSections === null) return null;

  return {
    extraChecks: normalizedExtraChecks,
    messages: normalizedMessages,
    output: typeof output === "string" ? output : undefined,
    sections: normalizedSections,
    status: status,
    summary: typeof summary === "string" ? summary : undefined,
  };
}
