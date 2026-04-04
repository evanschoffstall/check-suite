import type { StepPostProcessResult } from "@/types/index.ts";

import {
  isOptionalStatus,
  isOptionalString,
  normalizeArray,
  toPostProcessMessage,
  toPostProcessSection,
  toProcessedCheck,
} from "@/post-process/normalize/result/index.ts";
import { isRecord } from "@/types/index.ts";

export function toStepPostProcessResult(
  value: unknown,
): null | StepPostProcessResult {
  if (!isRecord(value)) return null;

  const { extraChecks, messages, output, sections, status, summary } = value;
  if (!isOptionalString(output) || !isOptionalString(summary)) return null;
  if (!isOptionalStatus(status)) return null;

  const normalizedExtraChecks = normalizeArray(extraChecks, toProcessedCheck);
  const normalizedMessages = normalizeArray(messages, toPostProcessMessage);
  const normalizedSections = normalizeArray(sections, toPostProcessSection);
  if (normalizedExtraChecks === null) return null;
  if (normalizedMessages === null) return null;
  if (normalizedSections === null) return null;

  return {
    extraChecks: normalizedExtraChecks,
    messages: normalizedMessages,
    output: typeof output === "string" ? output : undefined,
    sections: normalizedSections,
    status,
    summary: typeof summary === "string" ? summary : undefined,
  };
}
