import { z } from "zod";

import {
  outputFilterSchema,
  scalarTokenSchema,
  summarySchema,
} from "./base-schemas.ts";

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
