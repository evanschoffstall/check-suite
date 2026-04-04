import type { StepConfig } from "../../src/types.ts";

import { purgeCssStep } from "../inline-steps.ts";

/** Project CSS selector reachability check powered by PurgeCSS. */
export const purgeCssSuiteStep: StepConfig = {
  config: {
    data: {
      contentGlobs: [
        "src/**/*.{tsx,ts,jsx,js}",
        "src/components/components.css",
      ],
      cssFiles: ["src/app/globals.css"],
      safelists: ["^dark$", "^motion-profile-"],
      selectorPrefix: ".",
    },
    source: purgeCssStep,
  },
  enabled: true,
  failMsg: "unused CSS selectors found",
  handler: "inline-ts",
  key: "purgecss",
  label: "purgecss",
  passMsg: "",
  summary: {
    type: "simple",
  },
};
