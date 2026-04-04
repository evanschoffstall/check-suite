import type { Command } from "@/types/index.ts";

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

function getBunxCommandTarget(args: string[]): null | string {
  const target = args.find((arg) => !arg.startsWith("-"));
  return target && target.length > 0 ? target : null;
}

function hasExplicitPackageVersion(specifier: string): boolean {
  if (!specifier.startsWith("@")) return specifier.includes("@");

  const slashIndex = specifier.indexOf("/");
  if (slashIndex < 0) return false;
  return specifier.includes("@", slashIndex + 1);
}

function isBunxCommandAvailable(
  args: string[],
  declaredBunxTargets: ReadonlySet<string>,
): boolean {
  const target = getBunxCommandTarget(args);
  if (!target || hasExplicitPackageVersion(target)) return true;

  const packageName = stripPackageVersion(target);
  return (
    declaredBunxTargets.has(target) || declaredBunxTargets.has(packageName)
  );
}

function stripPackageVersion(specifier: string): string {
  if (!specifier.startsWith("@")) {
    return specifier.split("@", 2)[0] ?? specifier;
  }

  const slashIndex = specifier.indexOf("/");
  if (slashIndex < 0) return specifier;

  const versionIndex = specifier.indexOf("@", slashIndex + 1);
  return versionIndex < 0 ? specifier : specifier.slice(0, versionIndex);
}
