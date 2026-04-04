import type { StreamCollector } from "../types/index.ts";

import { createDelay } from "../timeout.ts";

export interface ProcessCollectors {
  stderrCollector: StreamCollector;
  stdoutCollector: StreamCollector;
}

export function createProcessCollectors(child: {
  stderr: null | ReadableStream<Uint8Array> | undefined;
  stdout: null | ReadableStream<Uint8Array> | undefined;
}): ProcessCollectors {
  return {
    stderrCollector: createStreamCollector(child.stderr),
    stdoutCollector: createStreamCollector(child.stdout),
  };
}

export async function flushCollectors(
  collectors: StreamCollector[],
  timeoutMs = 250,
): Promise<boolean> {
  const delay = createDelay(timeoutMs, false);
  try {
    return await Promise.race([
      Promise.all(collectors.map((collector) => collector.done)).then(
        () => true,
      ),
      delay.promise,
    ]);
  } finally {
    delay.cancel();
  }
}

function createStreamCollector(
  stream: null | ReadableStream<Uint8Array> | undefined,
): StreamCollector {
  let output = "";

  if (!stream) {
    return {
      done: Promise.resolve(),
      getOutput: () => output,
    };
  }

  const done = (async () => {
    const reader = stream.getReader();
    const decoder = new TextDecoder();

    try {
      for (;;) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;
        output += decoder.decode(value, { stream: true });
      }
    } catch {
      // Ignore collector errors so timeouts can still return partial output.
    } finally {
      output += decoder.decode();
      reader.releaseLock();
    }
  })();

  return { done, getOutput: () => output };
}
