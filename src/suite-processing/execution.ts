import type { SuiteExecutionState } from "@/types/index.ts";

import type { Command, StepConfig } from "../types/index.ts";

import { hasDeadlineExpired } from "../timeout.ts";
import { runStepBatch } from "./batch.ts";

export async function executeSuiteSteps(
  preRunSteps: StepConfig[],
  mainSteps: StepConfig[],
  deadlineMs: number,
): Promise<SuiteExecutionState> {
  const preRunResults = await runStepBatch(preRunSteps, deadlineMs);
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
): Promise<Record<string, Command>> {
  return executedMainSteps.length === mainSteps.length
    ? runStepBatch(mainSteps, deadlineMs)
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
