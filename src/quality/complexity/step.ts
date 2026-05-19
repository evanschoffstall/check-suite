import type { Summary } from "@/types/index.ts";

import { defineNumberRecord } from "@/foundation/index.ts";
import { defineInlineRunnerStep } from "@/step/index.ts";

import type { ComplexityCheckOptions } from "./main.ts";

import { runComplexityCheck } from "./main.ts";

/** User-facing factory options for the generic complexity-analysis step wrapper. */
export interface ComplexityStepOptions {
  config: Omit<ComplexityCheckOptions, "thresholds"> & {
    thresholds?: ComplexityCheckOptions["thresholds"] | string;
  };
  enabled?: boolean;
  failMsg?: string;
  key?: string;
  label?: string;
  passMsg?: string;
  summary?: Summary;
}

/**
 * Wraps the generic complexity runner in an inline step so configs only need
 * to provide the analyzer contract and thresholds.
 */
export function defineComplexityStep(options: ComplexityStepOptions) {
  return defineInlineRunnerStep({
    ...options,
    config: normalizeComplexityConfig(options.config),
    defaultLabel: "complexity",
    run: (cwd, data) => runComplexityCheck(data, cwd),
  });
}

function normalizeComplexityConfig(
  config: ComplexityStepOptions["config"],
): ComplexityCheckOptions {
  return {
    ...config,
    thresholds:
      typeof config.thresholds === "string"
        ? defineNumberRecord(config.thresholds)
        : config.thresholds,
  };
}
