import type { StepConfig } from "@/types/index.ts";

export function selectSuiteSteps(
  steps: StepConfig[],
  keyFilter: null | Set<string> | undefined,
  excludedKeys: ReadonlySet<string>,
): { mainSteps: StepConfig[]; preRunSteps: StepConfig[] } {
  return {
    mainSteps: steps.filter(
      (step) =>
        !step.preRun &&
        step.enabled !== false &&
        !excludedKeys.has(step.key) &&
        (!keyFilter || keyFilter.has(step.key)),
    ),
    preRunSteps: keyFilter
      ? []
      : steps.filter(
          (step) =>
            step.preRun &&
            step.enabled !== false &&
            !excludedKeys.has(step.key),
        ),
  };
}
