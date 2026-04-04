import { z } from "zod";

import { isRecord } from "../types/index.ts";
import {
  inlineTypeScriptConfigSchema,
  lintConfigSchema,
} from "./base-schemas.ts";
import { stepConfigShape } from "./step-shape.ts";
import { validateNestedConfig } from "./utils.ts";

export const stepConfigSchema = z
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
