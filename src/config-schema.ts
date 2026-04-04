import { z, ZodError } from "zod";

import type { CheckConfig } from "./types.ts";

import { isRecord } from "./types.ts";

const functionSchema = z.custom<(...args: never[]) => unknown>(
  (value) => typeof value === "function",
  "expected function",
);
const scalarTokenSchema = z.union([z.number(), z.string()]);
const recordSchema = z.record(z.string(), z.unknown());
const outputFilterSchema = z
  .object({
    pattern: z.string(),
    type: z.literal("stripLines"),
  })
  .strict();
const summaryPatternSchema = z
  .object({
    cellSep: z.string().optional(),
    format: z.string(),
    regex: z.string(),
    type: z.enum(["count", "literal", "match", "table-row"]),
  })
  .strict();
const summarySchema = z.union([
  z.object({ type: z.literal("simple") }).strict(),
  z
    .object({
      default: z.string(),
      patterns: z.array(summaryPatternSchema),
      type: z.literal("pattern"),
    })
    .strict(),
]);
const inlineTypeScriptConfigSchema = z
  .object({
    data: recordSchema.optional(),
    source: z.union([z.string(), functionSchema]),
  })
  .strict();
const lintConfigSchema = z
  .object({
    args: z.array(z.string()),
    globExtensions: z.array(z.string()),
    maxFiles: z.number().int().nonnegative(),
    skipDirs: z.array(z.string()),
  })
  .strict();

const stepConfigSchema = z
  .object({
    allowSuiteFlagArgs: z.boolean().optional(),
    args: z.array(z.string()).optional(),
    cmd: z.string().min(1).optional(),
    config: z.unknown().optional(),
    enabled: z.boolean().optional(),
    ensureDirs: z.array(z.string()).optional(),
    failMsg: z.string().optional(),
    handler: z.string().min(1).optional(),
    key: z.string().min(1),
    label: z.string().min(1),
    outputFilter: outputFilterSchema.optional(),
    passMsg: z.string().optional(),
    postProcess: z.unknown().optional(),
    preRun: z.boolean().optional(),
    serialGroup: z.string().min(1).optional(),
    summary: summarySchema.optional(),
    timeoutDrainMs: z.union([z.number(), z.string()]).optional(),
    timeoutEnvVar: z.string().min(1).optional(),
    timeoutMs: z.union([z.number(), z.string()]).optional(),
    tokens: z.record(z.string(), scalarTokenSchema).optional(),
  })
  .strict()
  .superRefine((step, context) => {
    if (!step.handler && !step.cmd) {
      context.addIssue({
        code: "custom",
        message: "step must define `cmd` when no `handler` is configured",
        path: ["cmd"],
      });
    }

    validateNestedConfig(
      step.postProcess,
      inlineTypeScriptConfigSchema,
      "postProcess",
      context,
      false,
    );

    if (step.handler === "inline-ts") {
      validateNestedConfig(
        step.config,
        inlineTypeScriptConfigSchema,
        "config",
        context,
        true,
      );
      return;
    }

    if (step.handler === "lint") {
      validateNestedConfig(
        step.config,
        lintConfigSchema,
        "config",
        context,
        true,
      );
      return;
    }

    if (step.config !== undefined && !isRecord(step.config)) {
      context.addIssue({
        code: "custom",
        message: "config must be an object when provided",
        path: ["config"],
      });
    }
  });

const checkConfigSchema = z
  .object({
    paths: z.record(z.string(), z.string()),
    steps: z.array(stepConfigSchema),
    suite: z
      .object({
        timeoutEnvVar: z.string().min(1).optional(),
        timeoutMs: z.number().int().positive().optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((config, context) => {
    const seenKeys = new Set<string>();
    for (const [index, step] of config.steps.entries()) {
      if (seenKeys.has(step.key)) {
        context.addIssue({
          code: "custom",
          message: `duplicate step key: ${step.key}`,
          path: ["steps", index, "key"],
        });
        continue;
      }

      seenKeys.add(step.key);
    }
  });

/**
 * Defines a typed suite configuration module and validates it immediately.
 */
export function defineCheckSuiteConfig<TConfig extends CheckConfig>(
  config: TConfig,
): TConfig {
  return parseCheckConfig(config) as TConfig;
}

/**
 * Validates an unknown value as a suite configuration object.
 */
export function parseCheckConfig(config: unknown): CheckConfig {
  try {
    return checkConfigSchema.parse(config) as CheckConfig;
  } catch (error) {
    throw new Error(formatConfigError(error), { cause: error });
  }
}

/**
 * Reads the exported config object from a config module namespace.
 */
export function parseCheckConfigModule(moduleNamespace: unknown): CheckConfig {
  if (!isRecord(moduleNamespace)) {
    throw new Error("check-suite config module did not export an object");
  }

  const configValue =
    "default" in moduleNamespace
      ? moduleNamespace.default
      : "config" in moduleNamespace
        ? moduleNamespace.config
        : undefined;

  if (configValue === undefined) {
    throw new Error(
      "check-suite config module must export the config as `default` or `config`",
    );
  }

  return parseCheckConfig(configValue);
}

function formatConfigError(error: unknown): string {
  if (!(error instanceof ZodError)) {
    return error instanceof Error ? error.message : String(error);
  }

  const issues = error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "config";
    return `${path}: ${issue.message}`;
  });
  return `invalid check-suite config\n${issues.join("\n")}`;
}

function validateNestedConfig<TConfig>(
  value: unknown,
  schema: z.ZodType<TConfig>,
  pathSegment: string,
  context: z.RefinementCtx,
  required: boolean,
): void {
  if (value === undefined) {
    if (required) {
      context.addIssue({
        code: "custom",
        message: `${pathSegment} is required`,
        path: [pathSegment],
      });
    }
    return;
  }

  const result = schema.safeParse(value);
  if (result.success) {
    return;
  }

  for (const issue of result.error.issues) {
    context.addIssue({
      code: "custom",
      message: issue.message,
      path: [pathSegment, ...issue.path],
    });
  }
}
