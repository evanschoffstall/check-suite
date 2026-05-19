import type { ArchitectureAnalyzerConfig } from "@/quality/module-boundaries/foundation/index.ts";
import type { Summary } from "@/types/index.ts";

import { defineInlineRunnerStep } from "@/step/index.ts";

import { runArchitectureCheck } from "./runner.ts";

/** User-facing factory options for the architecture boundary step wrapper. */
export interface ArchitectureStepOptions {
  config: ArchitectureAnalyzerConfig;
  enabled?: boolean;
  failMsg?: string;
  key?: string;
  label?: string;
  passMsg?: string;
  summary?: Summary;
}

/**
 * Wraps the architecture analyzer in a normal inline step so repository config
 * only has to supply the analysis configuration.
 */
export function defineArchitectureStep(options: ArchitectureStepOptions) {
  return defineInlineRunnerStep({
    ...options,
    config: options.config,
    defaultLabel: "architecture",
    run: (cwd, data) => runArchitectureCheck(cwd, data),
  });
}
