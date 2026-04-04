export interface Command {
  durationMs?: number;
  exitCode: number;
  notFound?: boolean;
  output: string;
  timedOut: boolean;
}

export interface DelayHandle<T> {
  cancel(): void;
  promise: Promise<T>;
}

export interface KillableProcess {
  exited: Promise<null | number>;
  kill(signal?: number | string): void;
}

export interface RunOptions {
  extraEnv?: Record<string, string>;
  label?: string;
  timeoutDrainMs?: number;
  timeoutMs?: number;
}

export interface StreamCollector {
  done: Promise<void>;
  getOutput: () => string;
}
