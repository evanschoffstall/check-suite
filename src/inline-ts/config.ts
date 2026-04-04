import type {
  InlineTypeScriptConfig,
  InlineTypeScriptSource,
  StepConfig,
} from "../types/index.ts";

import { isRecord } from "../types/index.ts";

export function toInlineTypeScriptConfig(
  config: StepConfig["config"] | StepConfig["postProcess"],
): InlineTypeScriptConfig<unknown, unknown> | null;
export function toInlineTypeScriptConfig<TContext, TResult>(
  config: StepConfig["config"] | StepConfig["postProcess"],
): InlineTypeScriptConfig<TContext, TResult> | null;
export function toInlineTypeScriptConfig<TContext, TResult>(
  config: StepConfig["config"] | StepConfig["postProcess"],
): InlineTypeScriptConfig<TContext, TResult> | null {
  if (!isRecord(config)) return null;
  const source = config.source;
  const data = config.data;
  if (typeof source !== "string" && typeof source !== "function") {
    return null;
  }
  return {
    data: isRecord(data) ? data : {},
    source: source as InlineTypeScriptSource<TContext, TResult>,
  };
}
