import { z, ZodError } from "zod";

export function formatConfigError(error: unknown): string {
  if (!(error instanceof ZodError)) {
    return error instanceof Error ? error.message : String(error);
  }

  const issues = error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "config";
    return `${path}: ${issue.message}`;
  });
  return `invalid check-suite config\n${issues.join("\n")}`;
}

export function validateNestedConfig<TConfig>(
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
