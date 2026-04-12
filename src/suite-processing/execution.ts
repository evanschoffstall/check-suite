import type {
  Command,
  StepConfig,
  SuiteExecutionState,
} from "@/types/index.ts";

import { hasDeadlineExpired } from "@/timeout/index.ts";

import type { ActiveSuiteStepStatus } from "./batch.ts";

import { runStepBatch } from "./batch.ts";

interface SuiteExecutionOptions {
  onActiveStepChange?: (step: ActiveSuiteStepStatus | null) => void;
}

export async function executeSuiteSteps(
  preRunSteps: StepConfig[],
  mainSteps: StepConfig[],
  deadlineMs: number,
  options: SuiteExecutionOptions = {},
): Promise<SuiteExecutionState> {
  const preRunResults = await runStepBatch(preRunSteps, deadlineMs, options);
  const preRunTimedOut = didAnyStepTimeOut(preRunResults);
  const suiteExpiredBeforeMain = shouldStopBeforeMainSteps(
    preRunTimedOut,
    deadlineMs,
  );
  const executedMainSteps =
    preRunTimedOut || suiteExpiredBeforeMain ? [] : mainSteps;
  const mainResults = await runSelectedMainSteps(
    executedMainSteps,
    mainSteps,
    deadlineMs,
    options,
  );
  const runs = { ...preRunResults, ...mainResults };
  const suiteExpiredBeforeOutput = shouldExpireBeforeOutput(
    preRunTimedOut,
    suiteExpiredBeforeMain,
    deadlineMs,
  );

  return {
    allExecutedSteps: [...preRunSteps, ...executedMainSteps],
    executedMainSteps,
    runs,
    suiteExpiredBeforeOutput,
    timedOut: didSuiteTimeOut(
      runs,
      suiteExpiredBeforeMain,
      suiteExpiredBeforeOutput,
    ),
  };
}

function didAnyStepTimeOut(runs: Record<string, Command>): boolean {
  return Object.values(runs).some((result) => result.timedOut);
}

function didSuiteTimeOut(
  runs: Record<string, Command>,
  suiteExpiredBeforeMain: boolean,
  suiteExpiredBeforeOutput: boolean,
): boolean {
  return (
    suiteExpiredBeforeMain ||
    suiteExpiredBeforeOutput ||
    didAnyStepTimeOut(runs)
  );
}

async function runSelectedMainSteps(
  executedMainSteps: StepConfig[],
  mainSteps: StepConfig[],
  deadlineMs: number,
  options: SuiteExecutionOptions,
): Promise<Record<string, Command>> {
  return executedMainSteps.length === mainSteps.length
    ? runStepBatch(mainSteps, deadlineMs, options)
    : {};
}

function shouldExpireBeforeOutput(
  preRunTimedOut: boolean,
  suiteExpiredBeforeMain: boolean,
  deadlineMs: number,
): boolean {
  return (
    !preRunTimedOut && !suiteExpiredBeforeMain && hasDeadlineExpired(deadlineMs)
  );
}

function shouldStopBeforeMainSteps(
  preRunTimedOut: boolean,
  deadlineMs: number,
): boolean {
  return !preRunTimedOut && hasDeadlineExpired(deadlineMs);
}
