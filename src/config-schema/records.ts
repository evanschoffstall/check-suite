import {
  assignNestedRecordValue,
  defineNumberRecord,
  parseAssignments,
} from "@/foundation/index.ts";

/** Builds nested boolean-valued config from dotted `path.to.key=true|false` assignments. */
export function defineNestedBooleanRecord(
  value: string,
): Record<string, unknown> {
  const target: Record<string, unknown> = {};
  for (const [key, rawValue] of parseAssignments(value)) {
    assignNestedRecordValue(target, key.split("."), rawValue === "true");
  }
  return target;
}

/** Builds nested number-valued config from dotted `path.to.key=value` assignments. */
export function defineNestedNumberRecord(
  value: string,
): Record<string, unknown> {
  const target: Record<string, unknown> = {};
  for (const [key, rawValue] of parseAssignments(value)) {
    assignNestedRecordValue(target, key.split("."), Number(rawValue));
  }
  return target;
}

export { defineNumberRecord };
