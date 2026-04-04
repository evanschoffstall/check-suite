import type {
  Command,
  StepConfig,
  StepPostProcessResult,
} from "../types/index.ts";

export interface CheckRow {
  d: string;
  k: string;
  ms?: number;
  status: "fail" | "pass";
  stpk: null | string;
}

export interface ProcessedResultEntry {
  displayOutput: string;
  postProcess: null | StepPostProcessResult;
}

export interface SuiteExecutionState {
  allExecutedSteps: StepConfig[];
  executedMainSteps: StepConfig[];
  runs: Record<string, Command>;
  suiteExpiredBeforeOutput: boolean;
  timedOut: boolean;
}
