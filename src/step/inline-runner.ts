import type { Summary } from "@/types/index.ts";

import { defineInlineStep } from "./build.ts";

interface InlineRunnerStepOptions<Config> {
  config: Config;
  defaultLabel: string;
  enabled?: boolean;
  failMsg?: string;
  key?: string;
  label?: string;
  passMsg?: string;
  run: (
    cwd: string,
    data: Config,
  ) => Promise<{ exitCode: number; output: string }>;
  summary?: Summary;
}

/** Wraps a generic async runner contract in an inline check-suite step. */
export function defineInlineRunnerStep<Config extends object>(
  options: InlineRunnerStepOptions<Config>,
) {
  const label = options.label ?? options.defaultLabel;

  return defineInlineStep({
    data: options.config as Record<string, unknown>,
    enabled: options.enabled,
    failMsg: options.failMsg ?? `${label} failed`,
    key: options.key ?? label,
    label,
    passMsg: options.passMsg,
    source: async ({ cwd, data, fail, ok }) => {
      const result = await options.run(cwd, data as unknown as Config);
      return result.exitCode === 0 ? ok(result.output) : fail(result.output);
    },
    summary: options.summary,
  });
}
