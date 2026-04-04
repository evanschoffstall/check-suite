import { defineCheckSuiteConfig } from "@/config-schema/index.ts";

import { paths, suite } from "./check-suite-config/settings.ts";
import { steps } from "./check-suite-config/steps/index.ts";

export default defineCheckSuiteConfig({
  paths,
  steps,
  suite,
});
