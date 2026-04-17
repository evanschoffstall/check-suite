import { describe, expect, test } from "bun:test";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { parseCliArguments } from "../src/cli/args/parser.ts";
import { parseCliOptions } from "../src/cli/args/selection/options.ts";
import {
  ANSI,
  buildSummaryRowLayout,
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
  summaryHeaderRow,
} from "../src/format/index.ts";
import {
  createSafeRegExp,
  escapeRegExpLiteral,
  isSafeRegExpPattern,
} from "../src/regex.ts";
import { runGitFileScan } from "../src/step/git-file-scan.ts";
import {
  renderCheckingFrame,
  startCheckingIndicator,
  withCheckingIndicator,
} from "../src/suite-processing/checking-indicator/index.ts";
import {
  printSuiteOutputs,
} from "../src/suite-processing/display.ts";
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

function initializeGitRepo(repoDir: string): void {
  const result = Bun.spawnSync(["git", "init"], {
    cwd: repoDir,
    stderr: "pipe",
    stdout: "pipe",
  });

  if (result.exitCode !== 0) {
    throw new Error(result.stderr.toString("utf8") || "git init failed");
  }
}

function writeExecutableScript(
  binDir: string,
  name: string,
  source: string,
): void {
  const filePath = join(binDir, name);
  writeFileSync(filePath, source);
  chmodSync(filePath, 0o755);
}

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

  test("prints help with the output option instead of treating it as a suite flag", async () => {
    const result = Bun.spawnSync(["./bin/check-suite", "--help"], {
      cwd: process.cwd(),
      stderr: "pipe",
      stdout: "pipe",
    });

    const stdout = result.stdout.toString().trim();
    const stderr = result.stderr.toString().trim();

    expect(result.exitCode).toBe(0);
    expect(stderr).toBe("");
    expect(stdout).toContain("Usage: check-suite [command] [options]");
    expect(stdout).toContain("--output=all");
    expect(stdout).toContain("--output=failures");
    expect(stdout).toContain("--format=plain");
    expect(stdout).toContain("--format=styled");
    expect(stdout).toContain("--fail-lines=<n>");
  });

  test("prints help for summary --help", async () => {
    const result = Bun.spawnSync(["./bin/check-suite", "summary", "--help"], {
      cwd: process.cwd(),
      stderr: "pipe",
      stdout: "pipe",
    });

    const stdout = result.stdout.toString().trim();

    expect(result.exitCode).toBe(0);
    expect(stdout).toContain("Suite Options:");
  });

  test("parses suite output options and failing output line limits", () => {
    expect(parseCliOptions([]).outputMode).toBe("failures-only");
    expect(parseCliOptions([]).renderMode).toBe("styled");
    expect(parseCliOptions([]).failureOutputLineLimit).toBeNull();
    expect(parseCliOptions(["--output=all", "--lint"]).outputMode).toBe(
      "all",
    );
    expect(parseCliOptions(["--output=failures"]).outputMode).toBe(
      "failures-only",
    );
    expect(parseCliOptions(["--format=plain"]).renderMode).toBe("plain");
    expect(parseCliOptions(["--format=headless"]).renderMode).toBe("plain");
    expect(parseCliOptions(["--format=safe"]).renderMode).toBe("plain");
    expect(parseCliOptions(["--format=styled"]).renderMode).toBe("styled");
    expect(parseCliOptions(["--fail-lines=3"]).failureOutputLineLimit).toBe(3);
    expect(parseCliOptions(["--output=nope"]).invalidOptions).toEqual([
      "--output=nope",
    ]);
    expect(parseCliOptions(["--format=nope"]).invalidOptions).toEqual([
      "--format=nope",
    ]);
    expect(parseCliOptions(["--fail-lines=0"]).invalidOptions).toEqual([
      "--fail-lines=0",
    ]);
    expect(parseCliOptions(["--fail-lines=nope"]).invalidOptions).toEqual([
      "--fail-lines=nope",
    ]);
  });

  test("parses reserved CLI options for direct step commands before passthrough args", () => {
    const cliArguments = parseCliArguments([
      "bun",
      "./bin/check-suite",
      "types",
      "--format=plain",
      "--output=all",
      "--fail-lines=3",
      "--",
      "--pretty",
    ]);

    expect(cliArguments.directStep?.key).toBe("types");
    expect(cliArguments.renderMode).toBe("plain");
    expect(cliArguments.outputMode).toBe("all");
    expect(cliArguments.failureOutputLineLimit).toBe(3);
    expect(cliArguments.invalidOptions).toEqual([]);
    expect(cliArguments.directStepArgs).toEqual(["--pretty"]);
  });

  test("keeps reserved-looking direct step args after the passthrough separator", () => {
    const cliArguments = parseCliArguments([
      "bun",
      "./bin/check-suite",
      "types",
      "--",
      "--format=plain",
    ]);

    expect(cliArguments.directStep?.key).toBe("types");
    expect(cliArguments.renderMode).toBe("styled");
    expect(cliArguments.directStepArgs).toEqual(["--format=plain"]);
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
    expect(formatSummaryLabel("short")).toBe("short");
    expect(formatSummaryLabel("very-long-summary-label")).toBe("very-long-...");
    expect(formatDuration(125)).toBe("125ms");
    expect(formatDuration(1250)).toBe("1.25s");
    const layout = buildSummaryRowLayout([
      { details: "done", durationMs: 250, label: "alpha" },
    ]);

    expect(summaryHeaderRow(layout, "plain")).toContain(
      "RESULT | CHECK         | SUMMARY          |  TIME",
    );
    expect(
      row({
        details: "done",
        durationMs: 250,
        label: "alpha",
        layout,
        renderMode: "plain",
        status: "pass",
      }),
    ).toContain(
      "PASS   | alpha         | done             | 250ms",
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

  test("plain render mode strips special formatting from print helpers", () => {
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
      printPostProcessMessages([{ text: "warn message", tone: "warn" }], "plain");
      printPostProcessSections(
        [{ items: ["first"], title: "Section", tone: "fail" }],
        "plain",
      );
      printStepOutput("demo", `${ANSI.red}payload${ANSI.reset}`, "plain");
    } finally {
      console.info = originalConsoleInfo;
      process.stdout.write = originalStdoutWrite;
    }

    expect(infoLines.some((line) => line.includes("\u001b["))).toBe(false);
    expect(infoLines.some((line) => line.includes("  * first"))).toBe(true);
    expect(writeLines).toEqual(["payload\n"]);
  });

  test("suite outputs only failing steps by default and can print all output", () => {
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
      const allExecutedSteps = [
        { key: "pass-step", label: "pass step" },
        { key: "fail-step", label: "fail step" },
      ];
      const runs = {
        "fail-step": { exitCode: 1, output: "fail raw", timedOut: false },
        "pass-step": { exitCode: 0, output: "pass raw", timedOut: false },
      };
      const processedResults = {
        "fail-step": { displayOutput: "fail output", postProcess: null },
        "pass-step": { displayOutput: "pass output", postProcess: null },
      };

      printSuiteOutputs(
        allExecutedSteps,
        {
          failureOutputLineLimit: null,
          outputMode: "failures-only",
          renderMode: "styled",
          runs,
        },
        processedResults,
        false,
        false,
      );
      expect(writeLines).toEqual(["fail output\n"]);
      expect(infoLines.some((line) => stripAnsi(line).includes("fail step"))).toBe(
        true,
      );

      infoLines.length = 0;
      writeLines.length = 0;

      printSuiteOutputs(
        allExecutedSteps,
        {
          failureOutputLineLimit: null,
          outputMode: "all",
          renderMode: "styled",
          runs,
        },
        processedResults,
        false,
        false,
      );
      expect(writeLines).toEqual(["pass output\n", "fail output\n"]);
      expect(infoLines.some((line) => stripAnsi(line).includes("pass step"))).toBe(
        true,
      );
    } finally {
      console.info = originalConsoleInfo;
      process.stdout.write = originalStdoutWrite;
    }
  });

  test("suite output line limit truncates failing output only", () => {
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
      const allExecutedSteps = [
        { key: "pass-step", label: "pass step" },
        { key: "fail-step", label: "fail step" },
      ];
      const runs = {
        "fail-step": { exitCode: 1, output: "fail raw", timedOut: false },
        "pass-step": { exitCode: 0, output: "pass raw", timedOut: false },
      };
      const processedResults = {
        "fail-step": { displayOutput: "line 1\nline 2\nline 3\n", postProcess: null },
        "pass-step": { displayOutput: "pass line 1\npass line 2\npass line 3\n", postProcess: null },
      };

      printSuiteOutputs(
        allExecutedSteps,
        {
          failureOutputLineLimit: 2,
          outputMode: "all",
          renderMode: "styled",
          runs,
        },
        processedResults,
        false,
        false,
      );

      expect(writeLines).toEqual([
        "pass line 1\npass line 2\npass line 3\n",
        "line 1\nline 2\n... truncated to first 2 lines of failing output (--fail-lines=2)\n",
      ]);
      expect(infoLines.some((line) => stripAnsi(line).includes("pass step"))).toBe(
        true,
      );
      expect(infoLines.some((line) => stripAnsi(line).includes("fail step"))).toBe(
        true,
      );
    } finally {
      console.info = originalConsoleInfo;
      process.stdout.write = originalStdoutWrite;
    }
  });

  test("checking indicator renders Checking frames and restores the terminal", async () => {
    const writes: string[] = [];
    let taskStarted = false;
    const output = {
      isTTY: true,
      write(chunk: string): boolean {
        writes.push(chunk);
        return true;
      },
    };

    expect(stripAnsi(renderCheckingFrame(0))).toContain("Checking");

    const resultPromise = withCheckingIndicator(async (indicator) => {
      taskStarted = true;
      indicator.setDetailLine({ label: "lint", output: "src/check.ts" });
      return "done";
    }, {
      enabled: true,
      frameIntervalMs: 1,
      output,
    });

    expect(taskStarted).toBe(false);

    const result = await resultPromise;

    expect(result).toBe("done");
    expect(writes[0]).toBe("\x1b[?25l");
    expect(writes.some((chunk) => stripAnsi(chunk).includes("Checking"))).toBe(
      true,
    );
    expect(
      writes.some((chunk) => /Checking.*\[\d+\.\d+s\] \[lint\] src\/check\.ts/.test(stripAnsi(chunk))),
    ).toBe(true);
    expect(writes.at(-1)).toBe("\r\x1b[2K\x1b[?25h");
  });

  test("checking indicator start renders a frame immediately", async () => {
    const writes: string[] = [];
    const output = {
      isTTY: true,
      write(chunk: string): boolean {
        writes.push(chunk);
        return true;
      },
    };

    const indicator = startCheckingIndicator({
      enabled: true,
      frameIntervalMs: 100,
      output,
    });

    expect(writes[0]).toBe("\x1b[?25l");
    expect(stripAnsi(writes[1])).toContain("Checking");
    indicator.setDetailLine({ label: "lint", output: "building graph" });
    expect(
      writes.some((chunk) => /Checking.*\[\d+\.\d+s\] \[lint\] building graph/.test(stripAnsi(chunk))),
    ).toBe(true);

    await indicator.stop();
    expect(writes.at(-1)).toBe("\r\x1b[2K\x1b[?25h");
  });

  test("checking indicator keeps a live timer visible without detail messages", async () => {
    const writes: string[] = [];
    const output = {
      isTTY: true,
      write(chunk: string): boolean {
        writes.push(chunk);
        return true;
      },
    };

    const indicator = startCheckingIndicator({
      enabled: true,
      frameIntervalMs: 1,
      output,
    });

    await Bun.sleep(5);

    expect(
      writes.some((chunk) => /Checking.*\[\d+\.\d+s\]/.test(stripAnsi(chunk))),
    ).toBe(true);

    await indicator.stop();
  });

  test("checking indicator prints a static line in plain mode", async () => {
    const writes: string[] = [];
    const output = {
      isTTY: false,
      write(chunk: string): boolean {
        writes.push(chunk);
        return true;
      },
    };

    const indicator = startCheckingIndicator({
      displayMode: "static",
      enabled: true,
      output,
    });

    expect(writes).toEqual(["Checking...\n"]);

    await indicator.stop();
    expect(writes).toEqual(["Checking...\n"]);
  });
});

describe("regex helpers", () => {
  test("escape literals and validate safe patterns", () => {
    expect(escapeRegExpLiteral("a+b?(test)")).toBe("a\\+b\\?\\(test\\)");
    expect(isSafeRegExpPattern("^alpha|beta$")).toBe(true);
    expect(() => createSafeRegExp("(a+)+$")).toThrow();
    expect(
      createSafeRegExp(`^${escapeRegExpLiteral("a+b")}$`).test("a+b"),
    ).toBe(true);
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

describe("git file scan runtime", () => {
  test("falls back to the non-git command invocation outside git repositories", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "check-suite-file-scan-"));

    try {
      const result = await runGitFileScan(tempDir, {
        command: "node",
        fallbackArgs: ["-e", "process.stdout.write('fallback-ok\\n')"],
        fileArgs: ["-e", "process.stdout.write('should-not-run\\n')"],
      });

      expect(result.exitCode).toBe(0);
      expect(result.output).toBe("fallback-ok\n");
      expect(result.timedOut).toBe(false);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    } finally {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });

  test("returns the default empty-file message when git resolves no visible files", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "check-suite-file-scan-"));

    try {
      initializeGitRepo(tempDir);

      const result = await runGitFileScan(tempDir, {
        command: "node",
        fileArgs: ["-e", "process.stdout.write('unused\\n')"],
      });

      expect(result.exitCode).toBe(0);
      expect(result.output).toBe("No tracked or non-ignored files matched\n");
    } finally {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });

  test("batches resolved git-visible files and joins batch output", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "check-suite-file-scan-"));
    const binDir = join(tempDir, "bin");
    mkdirSync(binDir);
    writeExecutableScript(
      binDir,
      "scanner",
      [
        "#!/usr/bin/env node",
        "process.stdout.write(process.argv.slice(2).join(',') + '\\n');",
        "",
      ].join("\n"),
    );

    try {
      initializeGitRepo(tempDir);
      writeFileSync(join(tempDir, "alpha.ts"), "export const alpha = 1;\n");
      writeFileSync(join(tempDir, "beta.ts"), "export const beta = 2;\n");
      writeFileSync(join(tempDir, "gamma.ts"), "export const gamma = 3;\n");

      const result = await runGitFileScan(tempDir, {
        command: join(binDir, "scanner"),
        fileArgs: ["--scan"],
        maxArgLength: 16,
      });

      expect(result.exitCode).toBe(0);
      expect(result.output).toContain("--scan,alpha.ts");
      expect(result.output).toContain("--scan,beta.ts");
      expect(result.output).toContain("--scan,gamma.ts");
    } finally {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });

  test("returns exit code 1 when any batch reports a soft failure", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "check-suite-file-scan-"));
    const binDir = join(tempDir, "bin");
    mkdirSync(binDir);
    writeExecutableScript(
      binDir,
      "scanner",
      [
        "#!/usr/bin/env node",
        "const args = process.argv.slice(2);",
        "process.stdout.write(args.join(',') + '\\n');",
        "process.exit(args.includes('beta.ts') ? 1 : 0);",
        "",
      ].join("\n"),
    );

    try {
      initializeGitRepo(tempDir);
      writeFileSync(join(tempDir, "alpha.ts"), "export const alpha = 1;\n");
      writeFileSync(join(tempDir, "beta.ts"), "export const beta = 2;\n");

      const result = await runGitFileScan(tempDir, {
        command: join(binDir, "scanner"),
        fileArgs: ["--scan"],
        maxArgLength: 16,
      });

      expect(result.exitCode).toBe(1);
      expect(result.output).toContain("--scan,alpha.ts");
      expect(result.output).toContain("--scan,beta.ts");
    } finally {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });

  test("stops immediately on non-soft batch failures", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "check-suite-file-scan-"));
    const binDir = join(tempDir, "bin");
    mkdirSync(binDir);
    writeExecutableScript(
      binDir,
      "scanner",
      [
        "#!/usr/bin/env node",
        "const args = process.argv.slice(2);",
        "process.stdout.write(args.join(',') + '\\n');",
        "process.exit(args.includes('beta.ts') ? 2 : 0);",
        "",
      ].join("\n"),
    );

    try {
      initializeGitRepo(tempDir);
      writeFileSync(join(tempDir, "alpha.ts"), "export const alpha = 1;\n");
      writeFileSync(join(tempDir, "beta.ts"), "export const beta = 2;\n");

      const result = await runGitFileScan(tempDir, {
        command: join(binDir, "scanner"),
        fileArgs: ["--scan"],
        maxArgLength: 16,
      });

      expect(result.exitCode).toBe(2);
      expect(result.output).toContain("--scan,alpha.ts");
      expect(result.output).toContain("--scan,beta.ts");
    } finally {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });
});
