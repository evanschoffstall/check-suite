import { z } from "zod";

import { isSafeRegExpPattern } from "../regex.ts";

export const functionSchema = z.custom<(...args: never[]) => unknown>(
  (value) => typeof value === "function",
  "expected function",
);

export const scalarTokenSchema = z.union([z.number(), z.string()]);
export const recordSchema = z.record(z.string(), z.unknown());

export const outputFilterSchema = z
  .object({
    pattern: z
      .string()
      .refine(isSafeRegExpPattern, "pattern must be a safe regular expression"),
    type: z.literal("stripLines"),
  })
  .strict();

export const summaryPatternSchema = z
  .object({
    cellSep: z.string().optional(),
    format: z.string(),
    regex: z
      .string()
      .refine(isSafeRegExpPattern, "regex must be a safe regular expression"),
    type: z.enum(["count", "literal", "match", "table-row"]),
  })
  .strict();

export const summarySchema = z.union([
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
    globExtensions: z.array(z.string()),
    maxFiles: z.number().int().nonnegative(),
    skipDirs: z.array(z.string()),
  })
  .strict();
