import type {
  StepConfig,
  StepEntry,
  StepEntryHandler,
  StepEntryHandlers,
} from "@/types/index.ts";

import { isRecord } from "@/foundation/index.ts";

import { normalizeSummaryShorthand } from "./summary.ts";

type StepEntryFactory = (entry: object) => StepConfig | StepConfig[];

interface StepEntryFactoryDefinition {
  defaults?: Record<string, unknown>;
  factory: StepEntryFactory;
  type?: "factory";
}

interface StepEntryGroupDefinition {
  group: string;
  type?: "group";
}

/** Adapts entries by merging generic defaults before calling a typed factory. */
export function adaptMergedStepEntryHandler(
  factory: unknown,
  defaults: Record<string, unknown>,
): StepEntryHandler {
  return (entry) => (factory as StepEntryFactory)({ ...entry, ...defaults });
}

/** Adapts a typed step factory to the record-shaped declarative entry boundary. */
export function adaptStepEntryHandler(factory: unknown): StepEntryHandler {
  return (entry) => (factory as StepEntryFactory)(entry);
}

/** Creates a grouped-entry kind from a record whose keys become item labels. */
export function createLabeledStepEntryGroupHandler(
  itemKind: string,
): StepEntryHandler {
  return (entry, handlers) => {
    const items = entry.items;
    if (!items || typeof items !== "object" || Array.isArray(items)) return [];
    const defaults = isRecord(entry.defaults) ? entry.defaults : {};
    return defineStepEntries(
      Object.entries(items).map(([label, value]) => ({
        ...defaults,
        ...(typeof value === "string" ? { args: value } : (value as object)),
        kind: itemKind,
        label,
      })),
      handlers,
    );
  };
}

/** Marks a record-shaped entry as a labeled group of another config-owned kind. */
export function defineLabeledStepEntryGroup(
  itemKind: string,
): StepEntryGroupDefinition {
  return { group: itemKind, type: "group" };
}

/**
 * Converts declarative `{ kind, ...options }` entries into runtime step config.
 *
 * The library owns only the dispatch mechanics. The config owns every kind name,
 * factory choice, command, threshold, path, and tool-specific option.
 */
export function defineStepEntries(
  entries: readonly StepEntry[],
  handlers: StepEntryHandlers,
): StepConfig[] {
  return entries.flatMap((entry) => {
    const handler = handlers[entry.kind];
    if (!handler) throw new Error(`unknown step kind: ${entry.kind}`);

    const { kind: _kind, ...payload } = entry;
    return handler(normalizeStepEntryPayload(payload), handlers);
  });
}

/**
 * Builds a kind-handler catalog from config-owned factories and generic wiring.
 *
 * This helper owns only the shape normalization: configs still choose every kind
 * name, factory, default value, command, path, parser, and policy threshold.
 */
export function defineStepEntryHandlers(
  definitions: Record<string, unknown>,
): StepEntryHandlers {
  return Object.fromEntries(
    Object.entries(definitions).map(([kind, definition]) => [
      kind,
      defineStepEntryHandler(definition),
    ]),
  );
}

/** Marks a config-owned factory as needing generic defaults before dispatch. */
export function withStepEntryDefaults(
  factory: unknown,
  defaults: Record<string, unknown>,
): StepEntryFactoryDefinition {
  return {
    defaults,
    factory: factory as StepEntryFactory,
    type: "factory",
  };
}

function defineStepEntryHandler(definition: unknown): StepEntryHandler {
  if (typeof definition === "function") {
    return (entry) => (definition as StepEntryFactory)(entry);
  }

  if (isStepEntryGroupDefinition(definition)) {
    return createLabeledStepEntryGroupHandler(definition.group);
  }

  if (!isStepEntryFactoryDefinition(definition)) {
    throw new Error("invalid step entry handler definition");
  }

  return (entry) => definition.factory({ ...entry, ...definition.defaults });
}

function isStepEntryFactoryDefinition(
  definition: unknown,
): definition is StepEntryFactoryDefinition {
  return (
    typeof definition === "object" &&
    definition !== null &&
    "factory" in definition &&
    typeof definition.factory === "function"
  );
}

function isStepEntryGroupDefinition(
  definition: unknown,
): definition is StepEntryGroupDefinition {
  return (
    typeof definition === "object" &&
    definition !== null &&
    "group" in definition &&
    typeof definition.group === "string"
  );
}

function normalizeStepEntryPayload(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...payload,
    ...("summary" in payload && {
      summary: normalizeSummaryShorthand(payload.summary),
    }),
  };
}
