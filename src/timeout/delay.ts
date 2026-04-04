import type { DelayHandle } from "@/types/index.ts";

/** Creates a cancellable promise that resolves to `value` after `ms` milliseconds. */
export function createDelay<T>(ms: number, value: T): DelayHandle<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const promise = new Promise<T>((resolve) => {
    timeoutId = setTimeout(() => {
      timeoutId = undefined;
      resolve(value);
    }, ms);
    timeoutId.unref();
  });

  return {
    cancel() {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
        timeoutId = undefined;
      }
    },
    promise,
  };
}

/** Returns the remaining suite budget in milliseconds without clamping. */
export function getRemainingTimeoutMs(deadlineMs: number): number {
  return deadlineMs - Date.now();
}

/** Reports whether the overall suite deadline has already been exhausted. */
export function hasDeadlineExpired(deadlineMs: number): boolean {
  return getRemainingTimeoutMs(deadlineMs) <= 0;
}