import { paths, suite } from "./check-suite-config/settings.ts";
import { steps } from "./check-suite-config/steps.ts";
import { defineCheckSuiteConfig } from "./src/config-schema.ts";

export default defineCheckSuiteConfig({
  paths,
  steps,
  suite,
});
