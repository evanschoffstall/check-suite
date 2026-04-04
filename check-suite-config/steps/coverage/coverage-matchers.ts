export function normalizeCoverageFilePath(value: string): string {
  return value
    .replace(/\\/g, "/")
    .replace(/\/+/, "/")
    .replace(/^\.\//u, "")
    .replace(/\/$/u, "");
}

export function readResolvedNumber(
  value: unknown,
  fallback: number,
  resolveTokenString: (value: string) => string,
): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsedValue = Number.parseFloat(resolveTokenString(value));
    if (Number.isFinite(parsedValue)) {
      return parsedValue;
    }
  }

  return fallback;
}

export function readResolvedPath(
  value: unknown,
  resolveTokenString: (value: string) => string,
): string {
  return typeof value === "string" ? resolveTokenString(value) : "";
}

export function resolveCoverageMatchers(
  values: unknown,
  includePaths: string[],
  resolveTokenString: (value: string) => string,
): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return values.flatMap((value) => {
    if (typeof value !== "string") {
      return [];
    }

    const normalizedValue = normalizeCoverageFilePath(
      resolveTokenString(value),
    );
    if (!normalizedValue) {
      return [];
    }

    const resolvedMatchers = new Set([normalizedValue]);
    for (const includePath of includePaths) {
      resolvedMatchers.add(
        normalizeCoverageFilePath(`${includePath}/${normalizedValue}`),
      );
      if (normalizedValue.startsWith("../")) {
        resolvedMatchers.add(
          normalizeCoverageFilePath(
            `${includePath}/${normalizedValue.slice(3)}`,
          ),
        );
      }
    }

    return [...resolvedMatchers].filter(Boolean);
  });
}
