import type { StepConfig } from "@/types/index.ts";

import { architectureStep } from "./inline.ts";

/** Repository-agnostic architecture validation for imports, entrypoints, and feature ownership. */
export const architectureSuiteStep: StepConfig = {
  config: {
    data: {
      entrypointNames: ["index"],
      maxEntrypointReExports: 12,
      maxInternalImportsPerFile: 12,
      maxSiblingImports: 7,
      minRepeatedDeepImports: 3,
      sharedHomeNames: ["types", "contracts", "utils"],
      vendorManagedDirectoryNames: ["__generated__", "generated", "vendor"],
    },
    source: architectureStep,
  },
  enabled: true,
  failMsg: "architecture violations found",
  handler: "inline-ts",
  key: "architecture",
  label: "architecture",
  passMsg: "",
  summary: {
    type: "simple",
  },
};
