import { z } from "zod";

import { isRecord } from "@/foundation/index.ts";

import {
  inlineTypeScriptConfigSchema,
  lintConfigSchema,
  stepConfigShape,
} from "./schema-primitives.ts";

const stepConfigSchema = z
  .object(stepConfigShape)
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
      context,
      { pathSegment: "postProcess", required: false },
    );

    if (step.handler === "inline-ts") {
      validateNestedConfig(step.config, inlineTypeScriptConfigSchema, context, {
        pathSegment: "config",
        required: true,
      });
      return;
    }

    if (step.handler === "lint") {
      validateNestedConfig(step.config, lintConfigSchema, context, {
        pathSegment: "config",
        required: true,
      });
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

export const checkConfigSchema = z
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

function validateNestedConfig<TConfig>(
  value: unknown,
  schema: z.ZodType<TConfig>,
  context: z.RefinementCtx,
  options: { pathSegment: string; required: boolean },
): void {
  const { pathSegment, required } = options;

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
  if (result.success) return;

  for (const issue of result.error.issues) {
    context.addIssue({
      code: "custom",
      message: issue.message,
      path: [pathSegment, ...issue.path],
    });
  }
}
