import type { StepConfig } from "@/types/index.ts";

import { architectureStep } from "./inline.ts";

/** Configurable data for the architecture validation step. */
export interface ArchitectureStepData {
  entrypointNames?: string[];
  maxEntrypointReExports?: number;
  maxInternalImportsPerFile?: number;
  maxSiblingImports?: number;
  minRepeatedDeepImports?: number;
  sharedHomeNames?: string[];
  vendorManagedDirectoryNames?: string[];
}

/** Creates a StepConfig for repository-agnostic architecture validation. */
export function createArchitectureStep(data: ArchitectureStepData): StepConfig {
  return {
    config: { data, source: architectureStep },
    enabled: true,
    failMsg: "architecture violations found",
    handler: "inline-ts",
    key: "architecture",
    label: "architecture",
    passMsg: "",
    summary: { type: "simple" },
  };
}
