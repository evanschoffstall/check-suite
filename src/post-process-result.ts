import type {
  PostProcessMessage,
  PostProcessSection,
  PostProcessTone,
  ProcessedCheck,
  StepPostProcessResult,
} from "./types.ts";

import { isRecord } from "./types.ts";

export function toStepPostProcessResult(
  value: unknown,
): null | StepPostProcessResult {
  if (!isRecord(value)) return null;

  const { extraChecks, messages, output, sections, status, summary } = value;
  if (output !== undefined && typeof output !== "string") return null;
  if (summary !== undefined && typeof summary !== "string") return null;
  if (status !== undefined && status !== "fail" && status !== "pass") {
    return null;
  }

  const normalizedExtraChecks = normalizeArray(extraChecks, toProcessedCheck);
  const normalizedMessages = normalizeArray(messages, toPostProcessMessage);
  const normalizedSections = normalizeArray(sections, toPostProcessSection);
  if (
    normalizedExtraChecks === null ||
    normalizedMessages === null ||
    normalizedSections === null
  ) {
    return null;
  }

  return {
    extraChecks: normalizedExtraChecks,
    messages: normalizedMessages,
    output: typeof output === "string" ? output : undefined,
    sections: normalizedSections,
    status,
    summary: typeof summary === "string" ? summary : undefined,
  };
}

function normalizeArray<T>(
  value: unknown,
  mapEntry: (entry: unknown) => null | T,
): null | T[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return null;
  return value.map(mapEntry).filter((entry): entry is T => entry !== null);
}

function normalizeTone(value: unknown): PostProcessTone | undefined {
  return value === "fail" ||
    value === "info" ||
    value === "pass" ||
    value === "warn"
    ? value
    : undefined;
}

function toPostProcessMessage(value: unknown): null | PostProcessMessage {
  if (!isRecord(value) || typeof value.text !== "string") return null;
  return { text: value.text, tone: normalizeTone(value.tone) };
}

function toPostProcessSection(value: unknown): null | PostProcessSection {
  if (
    !isRecord(value) ||
    typeof value.title !== "string" ||
    !Array.isArray(value.items)
  ) {
    return null;
  }

  const normalizedItems = value.items.filter(
    (item): item is string => typeof item === "string",
  );
  return normalizedItems.length === value.items.length
    ? {
        items: normalizedItems,
        title: value.title,
        tone: normalizeTone(value.tone),
      }
    : null;
}

function toProcessedCheck(value: unknown): null | ProcessedCheck {
  if (!isRecord(value)) return null;
  if (
    typeof value.label !== "string" ||
    typeof value.details !== "string" ||
    (value.status !== "fail" && value.status !== "pass")
  ) {
    return null;
  }
  return { details: value.details, label: value.label, status: value.status };
}
