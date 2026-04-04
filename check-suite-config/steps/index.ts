import type { CheckConfig } from "@/types/index.ts";

import { architectureSuiteStep } from "./architecture/index.ts";
import { dependencyCruiserStep } from "./dependency-cruiser.ts";
import { junitStep } from "./junit/index.ts";
import { lizardStep } from "./lizard/index.ts";
import { playwrightStep } from "./playwright/index.ts";
import { purgeCssSuiteStep } from "./purgecss/index.ts";
import {
  lintStep,
  madgeStep,
  tsdStep,
  typeCoverageStep,
  typesStep,
} from "./quality-steps.ts";
import {
  auditStep,
  gitleaksStep,
  jscpdStep,
  knipStep,
  semgrepStep,
} from "./root-steps.ts";
import { secretlintStep } from "./secretlint/index.ts";

/** Ordered step definitions that make up the suite entrypoint. */
export const steps: CheckConfig["steps"] = [
  knipStep,
  madgeStep,
  dependencyCruiserStep,
  architectureSuiteStep,
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
