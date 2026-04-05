import { z } from "zod";

import { isSafeRegExpPattern } from "@/regex.ts";

const functionSchema = z.custom<(...args: never[]) => unknown>(
  (value) => typeof value === "function",
  "expected function",
);
const scalarTokenSchema = z.union([z.number(), z.string()]);
const recordSchema = z.record(z.string(), z.unknown());

const outputFilterSchema = z
  .object({
    pattern: z
      .string()
      .refine(isSafeRegExpPattern, "pattern must be a safe regular expression"),
    type: z.literal("stripLines"),
  })
  .strict();

const summaryPatternSchema = z
  .object({
    cellSep: z.string().optional(),
    format: z.string(),
    regex: z
      .string()
      .refine(isSafeRegExpPattern, "regex must be a safe regular expression"),
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

export const inlineTypeScriptConfigSchema = z
  .object({
    data: recordSchema.optional(),
    source: z.union([z.string(), functionSchema]),
  })
  .strict();

export const lintConfigSchema = z
  .object({
    args: z.array(z.string()),
    concurrencyArgs: z.array(z.string()).optional(),
    concurrencyEnvVar: z.string().min(1).optional(),
    globExtensions: z.array(z.string()),
    maxFiles: z.number().int().nonnegative(),
    skipDirs: z.array(z.string()),
  })
  .strict();

export const stepConfigShape = {
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
} as const;
