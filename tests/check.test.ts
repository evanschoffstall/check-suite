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
} from "../src/format/index.ts";
import {
  appendCoverageCheckResult,
  appendMissingReportMessage,
  appendTestResultSections,
  buildTestSummary,
} from "../src/quality/line-metrics/post-process";
import {
  createSafeRegExp,
  escapeRegExpLiteral,
  isSafeRegExpPattern,
} from "../src/regex.ts";
import { runGitFileScan } from "../src/step/git-file-scan.ts";
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

describe("coverage post-process helpers", () => {
  test("append coverage failures and missing report messages consistently", () => {
    const messages: {
      text: string;
      tone?: "fail" | "info" | "pass" | "warn";
    }[] = [];
    const extraChecks: {
      details: string;
      label: string;
      status: "fail" | "pass";
    }[] = [];

    expect(
      appendCoverageCheckResult(
        {
          coverageLabel: "lcov-coverage",
          coverageThreshold: 85,
          totals: null,
        },
        messages,
        extraChecks,
      ),
    ).toBe(true);
    appendMissingReportMessage(messages);

    expect(extraChecks).toEqual([
      {
        details: "0.00% (0/0) · threshold 85.0%",
        label: "lcov-coverage",
        status: "fail",
      },
    ]);
    expect(messages).toEqual([
      { text: "Coverage report not found: (unset)", tone: "fail" },
      { text: "Report file not found: (unset)", tone: "fail" },
    ]);
  });

  test("append test sections and summaries from junit-style results", () => {
    const sections: {
      items: string[];
      title: string;
      tone?: "fail" | "info" | "pass" | "warn";
    }[] = [];

    expect(
      appendTestResultSections(
        true,
        {
          failedTests: ["suite > failed test"],
          skippedTests: ["suite > skipped test"],
        },
        sections,
      ),
    ).toBe(true);
    expect(sections).toEqual([
      {
        items: ["suite > failed test"],
        title: "Failed tests",
        tone: "fail",
      },
      {
        items: ["suite > skipped test"],
        title: "Skipped tests",
        tone: "warn",
      },
    ]);
    expect(buildTestSummary({ failed: 1, passed: 4, skipped: 2 }, 1)).toBe(
      "4 passed · 1 failed · 2 skipped · runner exit 1",
    );
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
  test("falls back to the non-git command invocation outside git repositories", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "check-suite-file-scan-"));

    try {
      const result = runGitFileScan(tempDir, {
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

  test("returns the default empty-file message when git resolves no visible files", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "check-suite-file-scan-"));

    try {
      initializeGitRepo(tempDir);

      const result = runGitFileScan(tempDir, {
        command: "node",
        fileArgs: ["-e", "process.stdout.write('unused\\n')"],
      });

      expect(result.exitCode).toBe(0);
      expect(result.output).toBe("No tracked or non-ignored files matched\n");
    } finally {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });

  test("batches resolved git-visible files and joins batch output", () => {
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

      const result = runGitFileScan(tempDir, {
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

  test("returns exit code 1 when any batch reports a soft failure", () => {
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

      const result = runGitFileScan(tempDir, {
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

  test("stops immediately on non-soft batch failures", () => {
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

      const result = runGitFileScan(tempDir, {
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
