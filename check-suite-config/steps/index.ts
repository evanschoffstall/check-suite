import type { CheckConfig } from "../../src/types/index.ts";

import { auditStep } from "./audit.ts";
import { dependencyCruiserStep } from "./dependency-cruiser.ts";
import { gitleaksStep } from "./gitleaks.ts";
import { jscpdStep } from "./jscpd.ts";
import { junitStep } from "./junit/index.ts";
import { knipStep } from "./knip.ts";
import { lintStep } from "./lint.ts";
import { lizardStep } from "./lizard/index.ts";
import { madgeStep } from "./madge.ts";
import { playwrightStep } from "./playwright/index.ts";
import { purgeCssSuiteStep } from "./purgecss/index.ts";
import { secretlintStep } from "./secretlint.ts";
import { semgrepStep } from "./semgrep.ts";
import { tsdStep } from "./tsd.ts";
import { typeCoverageStep } from "./type-coverage.ts";
import { typesStep } from "./types.ts";

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
