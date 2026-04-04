export function splitSuiteArguments(
  argv: string[],
  suiteArgStartIndex: number,
): {
  explicitStepArgs: string[];
  selectionArgs: string[];
} {
  const suiteArguments = argv.slice(suiteArgStartIndex);
  const passthroughSeparatorIndex = suiteArguments.indexOf("--");

  return {
    explicitStepArgs:
      passthroughSeparatorIndex >= 0
        ? suiteArguments.slice(passthroughSeparatorIndex + 1)
        : [],
    selectionArgs:
      passthroughSeparatorIndex >= 0
        ? suiteArguments.slice(0, passthroughSeparatorIndex)
        : suiteArguments,
  };
}
