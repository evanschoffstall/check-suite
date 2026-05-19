import { existsSync } from "node:fs";

import type { Command, InlineTypeScriptContext } from "@/types/index.ts";

import {
  assignNestedRecordValue,
  readStringArrayPath,
} from "@/foundation/index.ts";
import { createSafeRegExp, isSafeRegExpPattern } from "@/regex.ts";

import { type CommandArgsInput, tokenizeCommandArgs } from "./args.ts";
import { defineInlineStep } from "./build.ts";

export interface ImportedClassListCheckOptions {
  classExport: string;
  cwdPathLists?: Record<string, CommandArgsInput>;
  failItemPrefix: string;
  failSummary: string;
  importSpecifier: string;
  includePrefix?: string;
  input?: Record<string, unknown>;
  method: string;
  passMessage: string;
  regexListPaths?: Record<string, CommandArgsInput>;
  resultPath: string;
}

export interface ImportedClassListStepOptions extends ImportedClassListCheckOptions {
  enabled?: boolean;
  enabledPaths?: CommandArgsInput;
  failMsg?: string;
  key?: string;
  label: string;
  passMsg?: string;
}

type ImportedMethodResult =
  | { error: string; ok: false }
  | { ok: true; value: unknown };

/** Wraps an imported-class list check in an inline step. */
export function defineImportedClassListStep(
  options: ImportedClassListStepOptions,
) {
  const enabledPaths = options.enabledPaths
    ? tokenizeCommandArgs(options.enabledPaths)
    : [];

  return defineInlineStep({
    enabled: options.enabled ?? enabledPaths.every((path) => existsSync(path)),
    failMsg: options.failMsg,
    key: options.key ?? options.label,
    label: options.label,
    passMsg: options.passMsg,
    source: (context) => runImportedClassListCheck(context, options),
  });
}

/**
 * Imports a class, invokes one method, extracts a string list from the result,
 * filters it, and returns a command result. All tool names and paths come from config.
 */
export async function runImportedClassListCheck(
  context: InlineTypeScriptContext,
  options: ImportedClassListCheckOptions,
): Promise<Command> {
  const regexPatterns = Object.values(options.regexListPaths ?? {}).flatMap(
    tokenizeCommandArgs,
  );
  if (!regexPatterns.every((pattern) => isSafeRegExpPattern(pattern))) {
    return context.fail("list check contains an unsafe regex pattern\n");
  }

  const imported = await loadImportedClassInstance(context, options);
  if (typeof imported === "string") return context.fail(imported);

  const result = await invokeImportedMethod(imported, context, options);
  if (!result.ok) return context.fail(result.error);

  const items = filterResultItems(result.value, regexPatterns, options);
  return items.length === 0
    ? context.ok(options.passMessage)
    : context.fail(formatRejectedItems(items, options));
}

function buildInput(
  context: InlineTypeScriptContext,
  options: ImportedClassListCheckOptions,
): Record<string, unknown> {
  const input: Record<string, unknown> = { ...(options.input ?? {}) };
  for (const [key, values] of Object.entries(options.cwdPathLists ?? {})) {
    input[key] = tokenizeCommandArgs(values).map((value) =>
      context.join(context.cwd, value),
    );
  }
  for (const [path, values] of Object.entries(options.regexListPaths ?? {})) {
    assignNestedRecordValue(
      input,
      path.split("."),
      tokenizeCommandArgs(values).map((value) => createSafeRegExp(value)),
    );
  }
  return input;
}

function filterResultItems(
  result: unknown,
  regexPatterns: string[],
  options: ImportedClassListCheckOptions,
): string[] {
  const excludedPatterns = regexPatterns.map((pattern) =>
    createSafeRegExp(pattern),
  );
  return readStringArrayPath(result, options.resultPath).filter(
    (item) =>
      (!options.includePrefix || item.startsWith(options.includePrefix)) &&
      !excludedPatterns.some((pattern) => pattern.test(item)),
  );
}

function formatRejectedItems(
  items: string[],
  options: Pick<
    ImportedClassListCheckOptions,
    "failItemPrefix" | "failSummary"
  >,
): string {
  return `${items.map((item) => `  ${options.failItemPrefix}: ${item}`).join("\n")}\n${options.failSummary.replace("{count}", String(items.length))}\n`;
}

async function invokeImportedMethod(
  instance: Record<string, unknown>,
  context: InlineTypeScriptContext,
  options: ImportedClassListCheckOptions,
): Promise<ImportedMethodResult> {
  const method = instance[options.method];
  if (typeof method !== "function") {
    return { error: `missing method: ${options.method}\n`, ok: false };
  }

  return {
    ok: true,
    value: await (
      method as (
        this: typeof instance,
        input: Record<string, unknown>,
      ) => unknown
    ).call(instance, buildInput(context, options)),
  };
}

async function loadImportedClassInstance(
  context: InlineTypeScriptContext,
  options: Pick<
    ImportedClassListCheckOptions,
    "classExport" | "importSpecifier"
  >,
): Promise<Record<string, unknown> | string> {
  const moduleNamespace = (await context.importModule(
    options.importSpecifier,
  )) as Record<string, unknown>;
  const constructorValue = moduleNamespace[options.classExport];
  if (typeof constructorValue !== "function") {
    return `missing class export: ${options.classExport}\n`;
  }

  return new (constructorValue as new () => Record<string, unknown>)();
}
