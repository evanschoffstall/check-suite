import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  ANSI,
  divider,
  formatDuration,
  formatSummaryLabel,
  getToneColor,
  norm,
  paint,
  passFail,
  printPostProcessMessages,
  printPostProcessSections,
  printStepOutput,
  row,
  splitLines,
  stripAnsi,
} from "../src/format.ts";
import {
  appendTimedOutDrainMessage,
  appendTimedOutMessage,
  createDelay,
  getRemainingTimeoutMs,
  hasDeadlineExpired,
  makeTimedOutCommand,
  parsePositiveTimeoutMs,
  resolveTimeoutMs,
  withStepTimeout,
} from "../src/timeout/index.ts";

describe("check CLI", () => {
  test("runs via the sole declared binary entrypoint", async () => {
    const result = Bun.spawnSync(["./bin/check-suite", "keys"], {
      cwd: process.cwd(),
      stderr: "pipe",
      stdout: "pipe",
    });

    const stdout = result.stdout.toString().trim();
    const stderr = result.stderr.toString().trim();

    expect(result.exitCode).toBe(0);
    expect(stderr).toBe("");
    expect(stdout.length).toBeGreaterThan(0);
    expect(stdout).toContain("knip");
  });

  test("loads a TypeScript config module with multiline inline functions", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "check-suite-config-"));

    try {
      writeFileSync(join(tempDir, "package.json"), "{}\n");
      writeFileSync(
        join(tempDir, "check-suite.config.ts"),
        [
          "export default {",
          "  paths: {},",
          "  steps: [",
          "    {",
          '      key: "demo",',
          '      label: "demo",',
          '      handler: "inline-ts",',
          "      enabled: true,",
          '      summary: { type: "simple" },',
          "      config: {",
          "        source: async ({ ok }) => {",
          '          const lines = ["alpha", "beta"];',
          '          return ok(lines.join("\\n") + "\\n");',
          "        },",
          "      },",
          "    },",
          "  ],",
          "};",
          "",
        ].join("\n"),
      );

      const result = Bun.spawnSync(
        [join(process.cwd(), "bin/check-suite"), "demo"],
        {
          cwd: tempDir,
          stderr: "pipe",
          stdout: "pipe",
        },
      );

      const stdout = result.stdout.toString().trim();
      const stderr = result.stderr.toString().trim();

      expect(result.exitCode).toBe(0);
      expect(stderr).toBe("");
      expect(stdout).toContain("alpha");
      expect(stdout).toContain("beta");
    } finally {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });
});

describe("format helpers", () => {
  test("format primitive helpers render expected text", () => {
    expect(paint("value", ANSI.bold, ANSI.cyan)).toBe(
      `${ANSI.bold}${ANSI.cyan}value${ANSI.reset}`,
    );
    expect(stripAnsi(passFail("pass"))).toBe("PASS");
    expect(stripAnsi(passFail("fail"))).toBe("FAIL");
    expect(formatSummaryLabel("short")).toBe("short        ");
    expect(formatSummaryLabel("very-long-summary-label")).toBe("very-long-...");
    expect(formatDuration(125)).toBe("125ms");
    expect(formatDuration(1250)).toBe("1.25s");
    expect(stripAnsi(row("alpha", "pass", "done", 250))).toContain(
      "PASS alpha         done 250ms",
    );
    expect(stripAnsi(divider())).toContain("────────────────────────────────");
  });

  test("string normalization helpers strip ansi and empty lines", () => {
    expect(stripAnsi(`${ANSI.red}hello${ANSI.reset}`)).toBe("hello");
    expect(norm(`\r\n  ${ANSI.green}value${ANSI.reset}  \r\n`)).toBe("value");
    expect(splitLines("\n  alpha\n\n beta \n")).toEqual(["alpha", "beta"]);
  });

  test("tone helpers and print helpers write colored output", () => {
    expect(getToneColor("fail")).toBe(ANSI.red);
    expect(getToneColor("pass")).toBe(ANSI.green);
    expect(getToneColor("warn")).toBe(ANSI.yellow);
    expect(getToneColor(undefined)).toBe(ANSI.gray);

    const infoLines: string[] = [];
    const writeLines: string[] = [];
    const originalConsoleInfo = console.info;
    const originalStdoutWrite = process.stdout.write;

    console.info = ((...args: unknown[]) => {
      infoLines.push(args.join(" "));
    }) as typeof console.info;
    process.stdout.write = ((chunk: string | Uint8Array) => {
      writeLines.push(
        typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"),
      );
      return true;
    }) as typeof process.stdout.write;

    try {
      printPostProcessMessages([{ text: "warn message", tone: "warn" }]);
      printPostProcessSections([
        { items: ["first", "second"], title: "Section", tone: "fail" },
      ]);
      printStepOutput("demo", "payload");
      printStepOutput("empty", "   ");
    } finally {
      console.info = originalConsoleInfo;
      process.stdout.write = originalStdoutWrite;
    }

    expect(
      infoLines.some((line) => stripAnsi(line).includes("warn message")),
    ).toBe(true);
    expect(infoLines.some((line) => stripAnsi(line).includes("Section"))).toBe(
      true,
    );
    expect(
      infoLines.some((line) => stripAnsi(line).includes("(no output)")),
    ).toBe(true);
    expect(writeLines.some((line) => line === "payload\n")).toBe(true);
  });
});

describe("timeout helpers", () => {
  test("timeout message helpers append lines correctly", () => {
    expect(appendTimedOutDrainMessage("", "demo", 250)).toBe(
      "demo output drain exceeded the 250ms timeout after termination\n",
    );
    expect(appendTimedOutDrainMessage("alpha", "demo", 250)).toBe(
      "alpha\ndemo output drain exceeded the 250ms timeout after termination\n",
    );
    expect(appendTimedOutMessage("", "demo", 500)).toBe(
      "demo exceeded the 500ms timeout\n",
    );
    expect(appendTimedOutMessage("alpha", "demo", 500)).toBe(
      "alpha\ndemo exceeded the 500ms timeout\n",
    );
  });

  test("delay helpers resolve, cancel, and compute deadlines", async () => {
    const delay = createDelay(1, "done");
    expect(await delay.promise).toBe("done");
    delay.cancel();

    const futureDeadline = Date.now() + 25;
    expect(getRemainingTimeoutMs(futureDeadline)).toBeGreaterThan(0);
    expect(hasDeadlineExpired(Date.now() - 1)).toBe(true);
    expect(hasDeadlineExpired(futureDeadline)).toBe(false);
  });

  test("timeout parsing and resolution prefer env then config then fallback", () => {
    const original = process.env.CHECK_SUITE_TIMEOUT_TEST;
    process.env.CHECK_SUITE_TIMEOUT_TEST = "250";

    try {
      expect(parsePositiveTimeoutMs(undefined)).toBeNull();
      expect(parsePositiveTimeoutMs("0")).toBeNull();
      expect(parsePositiveTimeoutMs("125")).toBe(125);
      expect(parsePositiveTimeoutMs(99.9)).toBe(99);
      expect(resolveTimeoutMs("CHECK_SUITE_TIMEOUT_TEST", 100, 50)).toBe(250);
      delete process.env.CHECK_SUITE_TIMEOUT_TEST;
      expect(resolveTimeoutMs("CHECK_SUITE_TIMEOUT_TEST", 100, 50)).toBe(100);
      expect(resolveTimeoutMs("CHECK_SUITE_TIMEOUT_TEST", undefined, 50)).toBe(
        50,
      );
    } finally {
      if (original === undefined) {
        delete process.env.CHECK_SUITE_TIMEOUT_TEST;
      } else {
        process.env.CHECK_SUITE_TIMEOUT_TEST = original;
      }
    }
  });

  test("timeout command helpers surface timed out results", async () => {
    expect(makeTimedOutCommand("demo", 750)).toEqual({
      exitCode: 124,
      output: "demo exceeded the 750ms timeout\n",
      timedOut: true,
    });

    await expect(
      withStepTimeout(
        "demo",
        Promise.resolve({ exitCode: 0, output: "ok", timedOut: false }),
        50,
      ),
    ).resolves.toEqual({ exitCode: 0, output: "ok", timedOut: false });

    await expect(
      withStepTimeout(
        "demo",
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({ exitCode: 0, output: "late", timedOut: false });
          }, 25);
        }),
        1,
      ),
    ).resolves.toEqual({
      exitCode: 124,
      output: "demo exceeded the 1ms timeout\n",
      timedOut: true,
    });
  });
});
