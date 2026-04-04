import { z } from "zod";

import { stepConfigSchema } from "./step-schema.ts";

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
