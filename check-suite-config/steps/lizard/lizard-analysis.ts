import { spawnSync } from "node:child_process";

import { LIZARD_ANALYSIS_ARGS } from "./constants.ts";

export function runLizardAnalysis(
  failWithOutput: (output: string, exitCode?: number) => never,
): string {
  const result = spawnSync("python3", [...LIZARD_ANALYSIS_ARGS], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  if (result.error) throw result.error;

  const stderr = result.stderr.trim();
  const stdout = result.stdout.trim();

  if (result.status !== 0) {
    const details = stderr || stdout || "lizard exited with a non-zero status";
    failWithOutput(
      [
        "complexity: 0 function violations · 0 file violations",
        "missing dependency or runner failure while starting python3 -m lizard",
        details,
        "install with: python3 -m pip install lizard",
      ].join("\n"),
      result.status ?? 1,
    );
  }

  if (/No module named/i.test(stderr) || /No module named/i.test(stdout)) {
    failWithOutput(
      [
        "complexity: 0 function violations · 0 file violations",
        stderr || stdout,
        "install with: python3 -m pip install lizard",
      ].join("\n"),
    );
  }

  return result.stdout;
}
