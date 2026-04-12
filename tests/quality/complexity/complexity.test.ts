import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { FunctionMetrics } from "@/quality/complexity/shared/index.ts";

import {
  buildComplexityReportWithFiles,
  collectFileMetrics,
  collectTopLevelTypeScriptFunctionMetrics,
  collectWorkspaceFileMetrics,
  createSpawnComplexityAdapter,
  DEFAULT_COMPLEXITY_THRESHOLDS,
  parseCsvComplexityRows,
  resolveTopLevelFunctionMetrics,
  runComplexityCheck,
} from "@/quality/complexity/index.ts";

async function withTempRepo(
  files: Record<string, string>,
  run: (repoDir: string) => Promise<void> | void,
): Promise<void> {
  const repoDir = mkdtempSync(join(tmpdir(), "check-suite-complexity-"));
  try {
    for (const [relativePath, content] of Object.entries(files)) {
      const absolutePath = join(repoDir, relativePath);
      mkdirSync(absolutePath.slice(0, absolutePath.lastIndexOf("/")), {
        recursive: true,
      });
      writeFileSync(absolutePath, content, "utf8");
    }
    await run(repoDir);
  } finally {
    rmSync(repoDir, { force: true, recursive: true });
  }
}

describe("complexity parser/report", () => {
  test("parseCsvComplexityRows parses quoted cells and defaults empty names", () => {
    const rows = parseCsvComplexityRows(
      [
        "1,2,30,4,9,src/a.ts,src/a.ts:2,\"\",0,10",
        "5,3,45,6,12,src/b.ts,\"fn,with,comma@5-12@src/b.ts\",\"fn,with,comma\",0,18",
      ].join("\n"),
      {
        ccn: 0,
        endLine: 4,
        functionName: 7,
        length: 3,
        location: 6,
        nloc: 1,
        parameterCount: 8,
        path: 5,
        startLine: 9,
        tokenCount: 2,
      },
    );

    expect(rows).toHaveLength(2);
    expect(rows[0].functionName).toBe("(anonymous)");
    expect(rows[1].functionName).toBe("fn,with,comma");
    expect(rows[1].location).toContain("fn,with,comma");
  });

  test("parseCsvComplexityRows throws when mapped columns are missing", () => {
    expect(() =>
      parseCsvComplexityRows("1,2,3", {
        ccn: 0,
        endLine: 4,
        functionName: 7,
        length: 3,
        location: 6,
        nloc: 1,
        parameterCount: 8,
        path: 5,
        startLine: 9,
        tokenCount: 2,
      }),
    ).toThrow(/Unexpected CSV row/);
  });

  test("buildComplexityReportWithFiles returns violations and threshold block", () => {
    const report = buildComplexityReportWithFiles(
      [
        {
          ccn: 22,
          endLine: 40,
          functionName: "heavy",
          length: 120,
          location: "heavy@1-40@src/heavy.ts",
          nestingDepth: 9,
          nloc: 110,
          parameterCount: 10,
          path: "src/heavy.ts",
          startLine: 1,
          tokenCount: 600,
        },
      ],
      [
        {
          ccn: 88,
          functionCount: 30,
          nloc: 900,
          path: "src/heavy.ts",
          tokenCount: 4000,
        },
      ],
      DEFAULT_COMPLEXITY_THRESHOLDS,
    );

    expect(report.exitCode).toBe(1);
    expect(report.output).toContain("Function threshold violations");
    expect(report.output).toContain("File threshold violations");
    expect(report.output).toContain("Thresholds");
  });

  test("buildComplexityReportWithFiles fails cleanly when analyzer emits no rows", () => {
    const report = buildComplexityReportWithFiles([], [], DEFAULT_COMPLEXITY_THRESHOLDS);
    expect(report.exitCode).toBe(1);
    expect(report.output).toContain("No analyzer rows were produced");
  });
});

describe("complexity ast/workspace metrics", () => {
  test("collectTopLevelTypeScriptFunctionMetrics and resolver preserve top-level ownership", async () => {
    await withTempRepo(
      {
        "src/sample.ts": [
          "export function alpha(one: number) {",
          "  function nested() { return one + 1; }",
          "  return nested();",
          "}",
          "export const beta = (two: number) => two * 2;",
        ].join("\n"),
      },
      async (repoDir) => {
        const filePath = join(repoDir, "src/sample.ts");
        const text = await Bun.file(filePath).text();
        const astMetrics = collectTopLevelTypeScriptFunctionMetrics(text, filePath);
        expect(astMetrics.length).toBeGreaterThan(0);

        const analyzerRows: FunctionMetrics[] = astMetrics.map((entry) => ({
          ...entry,
          tokenCount: Math.max(1, entry.tokenCount - 1),
        }));
        const resolved = resolveTopLevelFunctionMetrics(analyzerRows);

        expect(resolved).toHaveLength(astMetrics.length);
        expect(resolved.every((entry) => entry.location.includes(filePath))).toBe(true);
        expect(resolved.some((entry) => entry.functionName.includes("alpha"))).toBe(true);
      },
    );
  });

  test("collectFileMetrics and collectWorkspaceFileMetrics aggregate analyzer rows", async () => {
    await withTempRepo(
      {
        "src/a.ts": "export const a = 1;\nexport function fa() { return a; }\n",
        "src/b.ts": "export const b = 2;\nexport function fb() { return b; }\n",
      },
      async (repoDir) => {
        const functions: FunctionMetrics[] = [
          {
            ccn: 2,
            endLine: 2,
            functionName: "fa",
            length: 2,
            location: "fa@2-2@src/a.ts",
            nestingDepth: 0,
            nloc: 1,
            parameterCount: 0,
            path: "src/a.ts",
            startLine: 2,
            tokenCount: 5,
          },
          {
            ccn: 3,
            endLine: 2,
            functionName: "fb",
            length: 2,
            location: "fb@2-2@src/b.ts",
            nestingDepth: 0,
            nloc: 1,
            parameterCount: 0,
            path: "src/b.ts",
            startLine: 2,
            tokenCount: 6,
          },
        ];

        const fileMetrics = collectFileMetrics(functions);
        expect(fileMetrics).toHaveLength(2);

        const workspaceMetrics = collectWorkspaceFileMetrics(
          functions,
          ["src"],
          [],
          repoDir,
        );
        expect(workspaceMetrics).toHaveLength(2);
        expect(workspaceMetrics.every((entry) => entry.nloc > 0)).toBe(true);
      },
    );
  });
});

describe("complexity adapter and check runner", () => {
  test("runComplexityCheck succeeds through createSpawnComplexityAdapter", async () => {
    await withTempRepo(
      {
        "src/a.ts": "export function fn() { return 1; }\n",
      },
      async (repoDir) => {
        const adapter = createSpawnComplexityAdapter({
          buildArgs: () => [
            "-e",
            "process.stdout.write('1,2,30,4,9,src/a.ts,src/a.ts:2,fn,0,10\\n');",
          ],
          command: "node",
          failureLabel: "complexity",
          installHint: "npm i analyzer",
          parseOutput: (output) =>
            parseCsvComplexityRows(output, {
              ccn: 0,
              endLine: 4,
              functionName: 7,
              length: 3,
              location: 6,
              nloc: 1,
              parameterCount: 8,
              path: 5,
              startLine: 9,
              tokenCount: 2,
            }),
        });

        const result = await runComplexityCheck(
          {
            analyzer: adapter,
            excludedPaths: [],
            targets: ["src"],
            thresholds: {
              fileCcn: 999,
              fileFunctionCount: 999,
              fileNloc: 999,
              fileTokenCount: 999,
              functionCcn: 999,
              functionLength: 999,
              functionNestingDepth: 999,
              functionNloc: 999,
              functionParameterCount: 999,
              functionTokenCount: 999,
            },
          },
          repoDir,
        );

        expect(result.exitCode).toBe(0);
        expect(result.output.endsWith("\n")).toBe(true);
        expect(result.output).toContain("complexity:");
      },
    );
  });

  test("runComplexityCheck surfaces analyzer startup failures", async () => {
    const adapter = createSpawnComplexityAdapter({
      buildArgs: () => ["-e", "process.stderr.write('No module named lizard'); process.exit(1);"],
      command: "node",
      failureLabel: "complexity",
      installHint: "python3 -m pip install lizard",
      parseOutput: () => [],
    });

    await expect(
      runComplexityCheck(
        {
          analyzer: adapter,
          excludedPaths: [],
          targets: ["src"],
        },
        process.cwd(),
      ),
    ).rejects.toThrow(/missing dependency or runner failure/);
  });
});
