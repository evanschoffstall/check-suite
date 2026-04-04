import { spawnSync } from "node:child_process";
import ts from "typescript";

import type { StepConfig } from "../../src/types.ts";

export interface ComplexityThresholds {
  fileCcn: number;
  fileFunctionCount: number;
  fileNloc: number;
  fileTokenCount: number;
  functionCcn: number;
  functionLength: number;
  functionNestingDepth: number;
  functionNloc: number;
  functionParameterCount: number;
  functionTokenCount: number;
}

export interface ComplexityViolation {
  metrics: string[];
  target: string;
}

export interface FileMetrics {
  ccn: number;
  functionCount: number;
  nloc: number;
  path: string;
  tokenCount: number;
}

export interface TypeScriptFunctionMetrics {
  ccn: number;
  endLine: number;
  functionName: string;
  length: number;
  location: string;
  nestingDepth: number;
  nloc: number;
  parameterCount: number;
  path: string;
  startLine: number;
  tokenCount: number;
}

type FunctionMetrics = TypeScriptFunctionMetrics;

interface TopLevelFunctionNode {
  declaration:
    | ts.ArrowFunction
    | ts.ConstructorDeclaration
    | ts.FunctionDeclaration
    | ts.FunctionExpression
    | ts.MethodDeclaration;
  functionName: string;
  startNode: ts.Node;
}

const LIZARD_EXCLUDED_PATHS = ["src/components/ui/*"] as const;
const LIZARD_TARGETS = [
  "src",
  "scripts",
  "drizzle.config.ts",
  "next.config.ts",
  "playwright.config.ts",
  "tailwind.config.ts",
] as const;
const PYTHON_LIZARD_MODULE = "lizard";
const MAX_REPORTED_VIOLATIONS = 20;

export const LIZARD_ANALYSIS_ARGS = [
  "-m",
  PYTHON_LIZARD_MODULE,
  "--csv",
  "-l",
  "typescript",
  "-l",
  "tsx",
  ...LIZARD_EXCLUDED_PATHS.flatMap((pattern) => ["-x", pattern]),
  ...LIZARD_TARGETS,
] as const;

export const LIZARD_THRESHOLDS: ComplexityThresholds = {
  fileCcn: 15,
  fileFunctionCount: 12,
  fileNloc: 80,
  fileTokenCount: 400,
  functionCcn: 7,
  functionLength: 80,
  functionNestingDepth: 2,
  functionNloc: 40,
  functionParameterCount: 4,
  functionTokenCount: 200,
};

/** Builds the user-facing lizard report text and exit code from parsed metrics. */
export function buildLizardReport(functions: FunctionMetrics[]): {
  exitCode: 0 | 1;
  output: string;
} {
  if (functions.length === 0) {
    return {
      exitCode: 1,
      output:
        "complexity: 0 function violations · 0 file violations\nno lizard rows were produced",
    };
  }

  const files = collectFileMetrics(functions);
  const functionViolations = findFunctionViolations(
    functions,
    LIZARD_THRESHOLDS,
  );
  const fileViolations = findFileViolations(files, LIZARD_THRESHOLDS);
  const summary = `complexity: ${functionViolations.length} function violations · ${fileViolations.length} file violations`;
  const thresholdSummary = formatThresholdSummary(LIZARD_THRESHOLDS);

  if (functionViolations.length === 0 && fileViolations.length === 0) {
    return {
      exitCode: 0,
      output: `${summary}\n${thresholdSummary}`,
    };
  }

  const outputLines = [summary, thresholdSummary];

  if (functionViolations.length > 0) {
    outputLines.push(
      ...formatViolations("Function threshold violations:", functionViolations),
    );
  }

  if (fileViolations.length > 0) {
    outputLines.push(
      ...formatViolations("File threshold violations:", fileViolations),
    );
  }

  return {
    exitCode: 1,
    output: outputLines.join("\n"),
  };
}

/** Aggregates function metrics into per-file totals for file-size and file-complexity checks. */
export function collectFileMetrics(
  functions: FunctionMetrics[],
): FileMetrics[] {
  const metricsByPath = new Map<string, FileMetrics>();

  for (const entry of functions) {
    const existingMetrics = metricsByPath.get(entry.path) ?? {
      ccn: 0,
      functionCount: 0,
      nloc: 0,
      path: entry.path,
      tokenCount: 0,
    };

    existingMetrics.ccn += entry.ccn;
    existingMetrics.functionCount += 1;
    existingMetrics.nloc += entry.nloc;
    existingMetrics.tokenCount += entry.tokenCount;
    metricsByPath.set(entry.path, existingMetrics);
  }

  return [...metricsByPath.values()].sort(
    (left, right) => right.ccn - left.ccn,
  );
}

/** Collects top-level declaration metrics from source text using the TypeScript AST. */
export function collectTopLevelTypeScriptFunctionMetrics(
  sourceText: string,
  filePath: string,
): TypeScriptFunctionMetrics[] {
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const topLevelFunctions: TopLevelFunctionNode[] = [];

  const toLineNumber = (position: number): number =>
    sourceFile.getLineAndCharacterOfPosition(position).line + 1;

  const registerTopLevelFunction = (
    declaration:
      | ts.ArrowFunction
      | ts.ConstructorDeclaration
      | ts.FunctionDeclaration
      | ts.FunctionExpression
      | ts.MethodDeclaration,
    functionName: string,
    startNode: ts.Node,
  ): void => {
    topLevelFunctions.push({
      declaration,
      functionName,
      startNode,
    });
  };

  const getDeclarationName = (
    name: ts.BindingName | ts.PropertyName | undefined,
  ): string => {
    if (!name) {
      return "(anonymous)";
    }

    if (
      ts.isIdentifier(name) ||
      ts.isPrivateIdentifier(name) ||
      ts.isNumericLiteral(name) ||
      ts.isStringLiteral(name)
    ) {
      return name.text;
    }

    return name.getText(sourceFile);
  };

  for (const statement of sourceFile.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.body) {
      registerTopLevelFunction(
        statement,
        getDeclarationName(statement.name),
        statement,
      );
      continue;
    }

    if (ts.isClassDeclaration(statement)) {
      for (const member of statement.members) {
        if (
          (ts.isMethodDeclaration(member) ||
            ts.isConstructorDeclaration(member)) &&
          member.body
        ) {
          registerTopLevelFunction(
            member,
            ts.isConstructorDeclaration(member)
              ? "constructor"
              : getDeclarationName(member.name),
            member,
          );
        }
      }

      continue;
    }

    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        const initializer = declaration.initializer;

        if (
          initializer &&
          (ts.isArrowFunction(initializer) ||
            ts.isFunctionExpression(initializer))
        ) {
          registerTopLevelFunction(
            initializer,
            getDeclarationName(declaration.name),
            declaration,
          );
        }
      }
    }
  }

  return topLevelFunctions.map(({ declaration, functionName, startNode }) => {
    const startLine = toLineNumber(startNode.getStart(sourceFile));
    const endLine = toLineNumber(declaration.getEnd());
    const nloc = countNonCommentLines(declaration, sourceFile, sourceText);

    return {
      ccn: computeCyclomaticComplexity(declaration),
      endLine,
      functionName,
      length: nloc,
      location: `${functionName}@${startLine}-${endLine}@${filePath}`,
      nestingDepth: computeMaxNestingDepth(declaration),
      nloc,
      parameterCount: declaration.parameters.length,
      path: filePath,
      startLine,
      tokenCount: countTokens(declaration, sourceFile, sourceText),
    } satisfies TypeScriptFunctionMetrics;
  });
}

/** Finds per-file complexity and size violations from the aggregated file metrics. */
export function findFileViolations(
  files: FileMetrics[],
  thresholds: ComplexityThresholds,
): ComplexityViolation[] {
  return files.flatMap((entry) => {
    const exceededMetrics = [
      entry.ccn > thresholds.fileCcn
        ? `file CCN ${entry.ccn} > ${thresholds.fileCcn}`
        : null,
      entry.functionCount > thresholds.fileFunctionCount
        ? `file functions ${entry.functionCount} > ${thresholds.fileFunctionCount}`
        : null,
      entry.nloc > thresholds.fileNloc
        ? `file NLOC ${entry.nloc} > ${thresholds.fileNloc}`
        : null,
      entry.tokenCount > thresholds.fileTokenCount
        ? `file tokens ${entry.tokenCount} > ${thresholds.fileTokenCount}`
        : null,
    ].filter((metric): metric is string => metric !== null);

    if (exceededMetrics.length === 0) {
      return [];
    }

    return [{ metrics: exceededMetrics, target: entry.path }];
  });
}

/** Finds per-function threshold violations in the parsed Lizard metrics. */
export function findFunctionViolations(
  functions: FunctionMetrics[],
  thresholds: ComplexityThresholds,
): ComplexityViolation[] {
  return functions.flatMap((entry) => {
    const exceededMetrics = [
      entry.ccn > thresholds.functionCcn
        ? `CCN ${entry.ccn} > ${thresholds.functionCcn}`
        : null,
      entry.length > thresholds.functionLength
        ? `length ${entry.length} > ${thresholds.functionLength}`
        : null,
      entry.nestingDepth > thresholds.functionNestingDepth
        ? `nesting ${entry.nestingDepth} > ${thresholds.functionNestingDepth}`
        : null,
      entry.nloc > thresholds.functionNloc
        ? `NLOC ${entry.nloc} > ${thresholds.functionNloc}`
        : null,
      entry.tokenCount > thresholds.functionTokenCount
        ? `tokens ${entry.tokenCount} > ${thresholds.functionTokenCount}`
        : null,
      entry.parameterCount > thresholds.functionParameterCount
        ? `params ${entry.parameterCount} > ${thresholds.functionParameterCount}`
        : null,
    ].filter((metric): metric is string => metric !== null);

    if (exceededMetrics.length === 0) {
      return [];
    }

    return [
      {
        metrics: exceededMetrics,
        target: `${entry.functionName} (${entry.location})`,
      },
    ];
  });
}

/** Formats the configured lizard thresholds into a single summary line. */
export function formatThresholdSummary(
  thresholds: ComplexityThresholds,
): string {
  return [
    `function CCN<=${thresholds.functionCcn}`,
    `function length<=${thresholds.functionLength}`,
    `function nesting<=${thresholds.functionNestingDepth}`,
    `function NLOC<=${thresholds.functionNloc}`,
    `function tokens<=${thresholds.functionTokenCount}`,
    `function params<=${thresholds.functionParameterCount}`,
    `file CCN<=${thresholds.fileCcn}`,
    `file functions<=${thresholds.fileFunctionCount}`,
    `file NLOC<=${thresholds.fileNloc}`,
    `file tokens<=${thresholds.fileTokenCount}`,
  ].join(" · ");
}

/** Formats a titled list of violations while capping the reported entry count. */
export function formatViolations(
  title: string,
  violations: ComplexityViolation[],
): string[] {
  const lines = [title];

  for (const violation of violations.slice(0, MAX_REPORTED_VIOLATIONS)) {
    lines.push(`  - ${violation.target}: ${violation.metrics.join(", ")}`);
  }

  if (violations.length > MAX_REPORTED_VIOLATIONS) {
    lines.push(
      `  - ... ${violations.length - MAX_REPORTED_VIOLATIONS} more violation(s) omitted`,
    );
  }

  return lines;
}

/** Executes the lizard step entrypoint. */
export function main(): void {
  const lizardCsvOutput = runLizardAnalysis();
  const functions = resolveTopLevelFunctionMetrics(
    parseLizardCsv(lizardCsvOutput),
  );
  const report = buildLizardReport(functions);

  if (report.exitCode === 0) {
    process.stdout.write(`${report.output}\n`);
    return;
  }

  failWithOutput(report.output, report.exitCode);
}

/** Converts Lizard CSV output into typed per-function metrics. */
export function parseLizardCsv(csvOutput: string): FunctionMetrics[] {
  return csvOutput
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => parseLizardCsvLine(line))
    .map((cells) => {
      if (cells.length < 11) {
        throw new Error(`Unexpected lizard CSV row: ${cells.join(",")}`);
      }

      const [
        nloc,
        ccn,
        tokenCount,
        parameterCount,
        length,
        location,
        path,
        functionName,
        _signature,
        startLine,
        endLine,
      ] = cells;

      return {
        ccn: Number.parseInt(ccn ?? "0", 10),
        endLine: Number.parseInt(endLine ?? "0", 10),
        functionName:
          functionName && functionName.length > 0
            ? functionName
            : "(anonymous)",
        length: Number.parseInt(length ?? "0", 10),
        location: location ?? path ?? "unknown-location",
        nestingDepth: 0,
        nloc: Number.parseInt(nloc ?? "0", 10),
        parameterCount: Number.parseInt(parameterCount ?? "0", 10),
        path: path ?? "unknown-file",
        startLine: Number.parseInt(startLine ?? "0", 10),
        tokenCount: Number.parseInt(tokenCount ?? "0", 10),
      } satisfies FunctionMetrics;
    });
}

/** Parses one Lizard CSV line while preserving quoted commas in function signatures. */
export function parseLizardCsvLine(line: string): string[] {
  const cells: string[] = [];
  let currentCell = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index] ?? "";
    const nextCharacter = line[index + 1] ?? "";

    if (character === '"') {
      if (inQuotes && nextCharacter === '"') {
        currentCell += '"';
        index += 1;
        continue;
      }

      inQuotes = !inQuotes;
      continue;
    }

    if (character === "," && !inQuotes) {
      cells.push(currentCell);
      currentCell = "";
      continue;
    }

    currentCell += character;
  }

  cells.push(currentCell);
  return cells;
}

/**
 * Uses lizard rows when they line up cleanly with top-level AST declarations and
 * drops clearly merged rows while replacing destructuring-inflated counts with
 * AST-derived declaration metadata.
 */
export function resolveTopLevelFunctionMetrics(
  functions: TypeScriptFunctionMetrics[],
): TypeScriptFunctionMetrics[] {
  const functionsByPath = new Map<string, TypeScriptFunctionMetrics[]>();

  for (const entry of functions) {
    const pathEntries = functionsByPath.get(entry.path) ?? [];
    pathEntries.push(entry);
    functionsByPath.set(entry.path, pathEntries);
  }

  const resolvedFunctions: TypeScriptFunctionMetrics[] = [];

  for (const [filePath, pathEntries] of functionsByPath) {
    const sourceText = ts.sys.readFile(filePath, "utf8");

    if (!sourceText) {
      resolvedFunctions.push(...pathEntries);
      continue;
    }

    const astFunctions = collectTopLevelTypeScriptFunctionMetrics(
      sourceText,
      filePath,
    );
    const astFunctionsByStartLine = new Map(
      astFunctions.map((entry) => [entry.startLine, entry] as const),
    );
    const astStartLines = astFunctions
      .map((entry) => entry.startLine)
      .sort((left, right) => left - right);

    for (const lizardFunction of pathEntries) {
      const astFunction = astFunctionsByStartLine.get(lizardFunction.startLine);

      if (!astFunction) {
        continue;
      }

      const overlappingStartLineCount = astStartLines.filter(
        (startLine) =>
          startLine >= lizardFunction.startLine &&
          startLine <= lizardFunction.endLine,
      ).length;

      if (overlappingStartLineCount > 1) {
        continue;
      }

      resolvedFunctions.push({
        ...lizardFunction,
        endLine: astFunction.endLine,
        length: astFunction.length,
        location: `${astFunction.functionName}@${astFunction.startLine}-${astFunction.endLine}@${filePath}`,
        nestingDepth: astFunction.nestingDepth,
        nloc: astFunction.nloc,
        parameterCount: astFunction.parameterCount,
      });
    }
  }

  return resolvedFunctions;
}

/** Executes the pinned Lizard analysis and returns raw CSV output for post-processing. */
export function runLizardAnalysis(): string {
  const result = spawnSync("python3", [...LIZARD_ANALYSIS_ARGS], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  if (result.error) {
    throw result.error;
  }

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

/** TypeScript complexity checks powered by python-lizard with AST normalization. */
export const lizardStep: StepConfig = {
  args: ["check-suite-config/steps/lizard.ts"],
  cmd: "bun",
  enabled: true,
  failMsg: "complexity limits exceeded",
  key: "lizard",
  label: "lizard",
  passMsg: "",
  summary: {
    default: "complexity check completed",
    patterns: [
      {
        format: "{1} function violations · {2} file violations",
        regex:
          "complexity:\\s+(\\d+)\\s+function violations\\s+·\\s+(\\d+)\\s+file violations",
        type: "match",
      },
    ],
    type: "pattern",
  },
};

function collectExcludedRanges(
  declaration: TopLevelFunctionNode["declaration"],
  sourceFile: ts.SourceFile,
): (readonly [number, number])[] {
  const ranges: (readonly [number, number])[] = [];

  const visit = (node: ts.Node): void => {
    if (node !== declaration && ts.isFunctionLike(node)) {
      ranges.push([node.getStart(sourceFile), node.getEnd()]);
      return;
    }

    if (
      ts.isJsxElement(node) ||
      ts.isJsxFragment(node) ||
      ts.isJsxSelfClosingElement(node)
    ) {
      ranges.push([node.getStart(sourceFile), node.getEnd()]);
      return;
    }

    ts.forEachChild(node, visit);
  };

  if (declaration.body) {
    visit(declaration.body);
  }

  return ranges;
}

function computeCyclomaticComplexity(
  declaration: TopLevelFunctionNode["declaration"],
): number {
  let complexity = 1;

  const visit = (node: ts.Node): void => {
    if (node !== declaration && ts.isFunctionLike(node)) {
      return;
    }

    if (
      ts.isCatchClause(node) ||
      ts.isConditionalExpression(node) ||
      ts.isDoStatement(node) ||
      ts.isForInStatement(node) ||
      ts.isForOfStatement(node) ||
      ts.isForStatement(node) ||
      ts.isIfStatement(node) ||
      ts.isWhileStatement(node)
    ) {
      complexity += 1;
    }

    if (ts.isCaseClause(node)) {
      complexity += 1;
    }

    if (
      ts.isBinaryExpression(node) &&
      (node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
        node.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
        node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)
    ) {
      complexity += 1;
    }

    ts.forEachChild(node, visit);
  };

  if (declaration.body) {
    visit(declaration.body);
  }

  return complexity;
}

function computeMaxNestingDepth(
  declaration: TopLevelFunctionNode["declaration"],
): number {
  let maxDepth = 0;

  const visit = (node: ts.Node, depth: number): void => {
    if (node !== declaration && ts.isFunctionLike(node)) {
      return;
    }

    let nextDepth = depth;
    if (
      ts.isCatchClause(node) ||
      ts.isConditionalExpression(node) ||
      ts.isDoStatement(node) ||
      ts.isForInStatement(node) ||
      ts.isForOfStatement(node) ||
      ts.isForStatement(node) ||
      ts.isIfStatement(node) ||
      ts.isSwitchStatement(node) ||
      ts.isWhileStatement(node)
    ) {
      nextDepth = depth + 1;
      if (nextDepth > maxDepth) {
        maxDepth = nextDepth;
      }
    }

    ts.forEachChild(node, (child) => visit(child, nextDepth));
  };

  if (declaration.body) {
    visit(declaration.body, 0);
  }

  return maxDepth;
}

function countNonCommentLines(
  declaration: TopLevelFunctionNode["declaration"],
  sourceFile: ts.SourceFile,
  sourceText: string,
): number {
  const declarationStart = declaration.getStart(sourceFile);
  const excludedRanges = collectExcludedRanges(declaration, sourceFile);
  const scanner = ts.createScanner(
    sourceFile.languageVersion,
    true,
    sourceFile.languageVariant,
    sourceText.slice(declarationStart, declaration.getEnd()),
  );
  const lineNumbers = new Set<number>();

  for (
    let token = scanner.scan();
    token !== ts.SyntaxKind.EndOfFileToken;
    token = scanner.scan()
  ) {
    if (
      token === ts.SyntaxKind.NewLineTrivia ||
      token === ts.SyntaxKind.WhitespaceTrivia
    ) {
      continue;
    }

    const absolutePosition = declarationStart + scanner.getTokenPos();

    if (isPositionInsideRanges(absolutePosition, excludedRanges)) {
      continue;
    }

    lineNumbers.add(
      sourceFile.getLineAndCharacterOfPosition(absolutePosition).line + 1,
    );
  }

  return lineNumbers.size;
}

function countTokens(
  declaration: TopLevelFunctionNode["declaration"],
  sourceFile: ts.SourceFile,
  sourceText: string,
): number {
  const declarationStart = declaration.getStart(sourceFile);
  const excludedRanges = collectExcludedRanges(declaration, sourceFile);
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    true,
    ts.LanguageVariant.Standard,
    sourceText.slice(declarationStart, declaration.getEnd()),
  );
  let tokenCount = 0;

  for (
    let token = scanner.scan();
    token !== ts.SyntaxKind.EndOfFileToken;
    token = scanner.scan()
  ) {
    if (
      token === ts.SyntaxKind.NewLineTrivia ||
      token === ts.SyntaxKind.WhitespaceTrivia
    ) {
      continue;
    }

    const absolutePosition = declarationStart + scanner.getTokenPos();

    if (isPositionInsideRanges(absolutePosition, excludedRanges)) {
      continue;
    }

    tokenCount += 1;
  }

  return tokenCount;
}

function failWithOutput(output: string, exitCode = 1): never {
  process.stdout.write(output.endsWith("\n") ? output : `${output}\n`);
  process.exit(exitCode);
}

function isPositionInsideRanges(
  position: number,
  ranges: (readonly [number, number])[],
): boolean {
  return ranges.some(([start, end]) => position >= start && position < end);
}

if (import.meta.main) {
  main();
}
