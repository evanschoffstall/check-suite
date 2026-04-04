import type { Command } from "@/types/index.ts";

import {
  getBunxCommandTarget,
  isBunxCommandAvailable,
} from "./bunx.ts";

export function createProcessEnv(
  extraEnv?: Record<string, string>,
): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = {
    ...process.env,
    FORCE_COLOR: process.env.FORCE_COLOR ?? "1",
    NODE_NO_WARNINGS: process.env.NODE_NO_WARNINGS ?? "1",
    ...extraEnv,
  };
  delete env.NO_COLOR;
  return env;
}

export function getPreflightFailure(
  cmd: string,
  args: string[],
  declaredBunxTargets: ReadonlySet<string>,
): Command | null {
  if (cmd === "bunx" && !isBunxCommandAvailable(args, declaredBunxTargets)) {
    const target = getBunxCommandTarget(args) ?? "bunx target";
    return {
      durationMs: 0,
      exitCode: 127,
      notFound: true,
      output: `command not found: ${target}`,
      timedOut: false,
    };
  }

  if (!Bun.which(cmd)) {
    return {
      durationMs: 0,
      exitCode: 127,
      notFound: true,
      output: `command not found: ${cmd}`,
      timedOut: false,
    };
  }

  return null;
}
