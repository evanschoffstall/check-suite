import { describe, expect, test } from "bun:test";

import type { StepConfig } from "@/types/index.ts";

import { selectSuiteSteps } from "@/suite-processing/selection.ts";

/** Builds a minimal step for selection tests without dragging in handler details. */
function createStep(overrides: Partial<StepConfig> & Pick<StepConfig, "key">): StepConfig {
  const { key, label, ...rest } = overrides;

  return {
    key,
    label: label ?? key,
    ...rest,
  };
}

describe("selectSuiteSteps", () => {
  test("keeps enabled main steps while excluding disabled and explicitly removed steps", () => {
    const steps = [
      createStep({ key: "preflight", preRun: true }),
      createStep({ key: "lint" }),
      createStep({ enabled: false, key: "disabled" }),
      createStep({ key: "skip-me" }),
    ];

    const selection = selectSuiteSteps(
      steps,
      null,
      new Set<string>(["skip-me"]),
    );

    expect(selection.preRunSteps.map((step) => step.key)).toEqual(["preflight"]);
    expect(selection.mainSteps.map((step) => step.key)).toEqual(["lint"]);
  });

  test("suppresses pre-run steps when a direct key filter is active", () => {
    const steps = [
      createStep({ key: "preflight", preRun: true }),
      createStep({ key: "lint" }),
      createStep({ key: "types" }),
    ];

    const selection = selectSuiteSteps(
      steps,
      new Set<string>(["types"]),
      new Set<string>(),
    );

    expect(selection.preRunSteps).toEqual([]);
    expect(selection.mainSteps.map((step) => step.key)).toEqual(["types"]);
  });
});