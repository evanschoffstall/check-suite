import type { StepConfig } from "@/types/index.ts";

import type { CommandArgsInput } from "./args.ts";
import type { CommandStepInput } from "./unified.ts";

import { defineStep } from "./unified.ts";

export type CommandStepSetEntry =
  | CommandStepInput
  | readonly [
      label: string,
      args: CommandArgsInput,
      overrides?: Omit<CommandStepInput, "args" | "label">,
    ];

/**
 * Converts concise command-step descriptors into concrete runtime step config.
 *
 * Tuple form keeps authoring small for straightforward command-backed steps.
 * Object form remains available when a step needs more shape than a tuple can express.
 */
export function defineCommandStepSet(
  entries: readonly CommandStepSetEntry[],
): StepConfig[] {
  return entries.map((entry) =>
    isTupleEntry(entry)
      ? defineStep({ ...(entry[2] ?? {}), args: entry[1], label: entry[0] })
      : defineStep(entry),
  );
}

function isTupleEntry(
  entry: CommandStepSetEntry,
): entry is Extract<CommandStepSetEntry, readonly unknown[]> {
  return Array.isArray(entry);
}
