import type {
  PostProcessMessage,
  PostProcessSection,
  ProcessedCheck,
} from "@/types/index.ts";

import { isRecord } from "@/types/index.ts";

import { normalizeTone } from "./shared.ts";

export function toPostProcessMessage(
  value: unknown,
): null | PostProcessMessage {
  if (!isRecord(value) || typeof value.text !== "string") return null;
  return { text: value.text, tone: normalizeTone(value.tone) };
}

export function toPostProcessSection(
  value: unknown,
): null | PostProcessSection {
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

export function toProcessedCheck(value: unknown): null | ProcessedCheck {
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
