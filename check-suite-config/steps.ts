import type { CheckConfig } from "../src/types.ts";

import { auditStep } from "./steps/audit.ts";
import { dependencyCruiserStep } from "./steps/dependency-cruiser.ts";
import { gitleaksStep } from "./steps/gitleaks.ts";
import { jscpdStep } from "./steps/jscpd.ts";
import { junitStep } from "./steps/junit.ts";
import { knipStep } from "./steps/knip.ts";
import { lintStep } from "./steps/lint.ts";
import { lizardStep } from "./steps/lizard.ts";
import { madgeStep } from "./steps/madge.ts";
import { playwrightStep } from "./steps/playwright.ts";
import { purgeCssSuiteStep } from "./steps/purgecss.ts";
import { secretlintStep } from "./steps/secretlint.ts";
import { semgrepStep } from "./steps/semgrep.ts";
import { tsdStep } from "./steps/tsd.ts";
import { typeCoverageStep } from "./steps/type-coverage.ts";
import { typesStep } from "./steps/types.ts";

/** Ordered step definitions that make up the suite entrypoint. */
export const steps: CheckConfig["steps"] = [
  knipStep,
  madgeStep,
  dependencyCruiserStep,
  purgeCssSuiteStep,
  tsdStep,
  secretlintStep,
  auditStep,
  semgrepStep,
  gitleaksStep,
  typeCoverageStep,
  lizardStep,
  jscpdStep,
  junitStep,
  playwrightStep,
  typesStep,
  lintStep,
];
