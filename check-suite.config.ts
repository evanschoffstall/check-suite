import { paths, suite } from "./check-suite-config/settings.ts";
import { steps } from "./check-suite-config/steps/index.ts";
import { defineCheckSuiteConfig } from "./src/config-schema/index.ts";

export default defineCheckSuiteConfig({
  paths,
  steps,
  suite,
});
