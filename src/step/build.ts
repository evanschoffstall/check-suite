import type {
  Command,
  InlineTypeScriptContext,
  InlineTypeScriptSource,
  StepConfig,
  Summary,
} from "@/types/index.ts";

/** Options for constructing a `handler: "inline-ts"` step with no post-processing. */
export interface InlineStepOptions {
  /** Arbitrary data passed into the runner via `context.data`. */
  data?: Record<string, unknown>;
  enabled?: boolean;
  failMsg?: string;
  key: string;
  label: string;
  passMsg?: string;
  /** Inline TypeScript runner — function reference or serializable source string. */
  source: InlineTypeScriptSource<InlineTypeScriptContext, Command>;
  summary?: Summary;
}

/**
 * Assembles a `handler: "inline-ts"` {@link StepConfig} from a runner function
 * and an optional data payload, eliminating the boilerplate common to every inline step.
 *
 * @example
 * ```ts
 * defineInlineStep({
 *   key: "my-step",
 *   label: "my-step",
 *   source: myRunner,
 *   data: { threshold: 90 },
 * });
 * ```
 */
export function defineInlineStep(options: InlineStepOptions): StepConfig {
  return {
    config: {
      ...(options.data !== undefined && { data: options.data }),
      source: options.source,
    },
    enabled: options.enabled ?? true,
    failMsg: options.failMsg ?? `${options.label} failed`,
    handler: "inline-ts",
    key: options.key,
    label: options.label,
    passMsg: options.passMsg ?? "",
    summary: options.summary ?? { type: "simple" },
  };
}
