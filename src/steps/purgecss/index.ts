import type { StepConfig } from "@/types/index.ts";

import { purgeCssStep } from "./inline.ts";

/** Configurable data for the PurgeCSS step. */
export interface PurgeCssStepData {
  contentGlobs: string[];
  cssFiles: string[];
  safelists: string[];
  selectorPrefix: string;
}

/** Creates a StepConfig for CSS selector reachability checks using PurgeCSS. */
export function createPurgeCssStep(data: PurgeCssStepData): StepConfig {
  return {
    config: { data, source: purgeCssStep },
    enabled: true,
    failMsg: "unused CSS selectors found",
    handler: "inline-ts",
    key: "purgecss",
    label: "purgecss",
    passMsg: "",
    summary: { type: "simple" },
  };
}
