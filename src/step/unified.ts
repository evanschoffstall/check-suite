import type { StepConfig } from "@/types/index.ts";

import type { InlineStepOptions } from "./build.ts";
import type { CommandStepOptions } from "./command.ts";
import type { LintStepOptions } from "./lint.ts";

import { defineInlineStep } from "./build.ts";
import { defineCommandStep } from "./command.ts";
import { defineLintStep } from "./lint.ts";

// ---------------------------------------------------------------------------
// Unified input types — optional fields filled in by defineStep
// ---------------------------------------------------------------------------

/**
 * Input type for a command step passed to {@link defineStep}.
 *
 * `cmd` defaults to `"bunx"`. `key` defaults to `label`.
 * `handler` and `source` must be absent (they discriminate other overloads).
 */
export type CommandStepInput = Omit<CommandStepOptions, "cmd" | "key"> & {
  cmd?: string;
  handler?: never;
  key?: string;
  source?: never;
};

/**
 * Input type for an inline-TypeScript step passed to {@link defineStep}.
 *
 * `key` defaults to `label`. `handler` must be absent.
 */
export type InlineStepInput = Omit<InlineStepOptions, "key"> & {
  handler?: never;
  key?: string;
};

/** Input type for a lint-handler step passed to {@link defineStep}. */
export type LintStepInput = LintStepOptions & { handler: "lint" };

// ---------------------------------------------------------------------------
// defineStep — unified entry point
// ---------------------------------------------------------------------------

/**
 * Unified step factory — the single entry point for all step types.
 *
 * The handler is discriminated from the input shape:
 * - `handler: "lint"` → lint runner (file-glob + auto-concurrency)
 * - `source` present → inline-TypeScript runner
 * - otherwise → subprocess runner (`cmd` defaults to `"bunx"`, `key` defaults to `label`)
 *
 * @example Command step — cmd defaults to "bunx", key defaults to label
 * ```ts
 * defineStep({ args: ["knip", "--cache"], failMsg: "knip failed", label: "knip" })
 * ```
 * @example Command step with non-default cmd
 * ```ts
 * defineStep({ args: ["audit"], cmd: "bun", label: "audit" })
 * ```
 * @example Inline step
 * ```ts
 * defineStep({ label: "my-check", source: ({ ok }) => ok("done") })
 * ```
 * @example Lint step
 * ```ts
 * defineStep({ args: ["eslint", ".", "--fix"], handler: "lint", label: "eslint" })
 * ```
 */
export function defineStep(
  options: CommandStepInput | InlineStepInput | LintStepInput,
): StepConfig {
  if ((options as { handler?: string }).handler === "lint") {
    return defineLintStep(options as LintStepOptions);
  }
  if ("source" in options) {
    const input = options as InlineStepInput;
    return defineInlineStep({ ...input, key: input.key ?? input.label } as InlineStepOptions);
  }
  const input = options as CommandStepInput;
  return defineCommandStep({ ...input, cmd: input.cmd ?? "bunx", key: input.key ?? input.label } as CommandStepOptions);
}
