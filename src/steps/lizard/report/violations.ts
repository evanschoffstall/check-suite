import type {
  ComplexityThresholds,
  ComplexityViolation,
  FileMetrics,
  TypeScriptFunctionMetrics,
} from "@/steps/lizard/shared/index.ts";

type FunctionMetrics = TypeScriptFunctionMetrics;

export function findFileViolations(
  files: FileMetrics[],
  thresholds: ComplexityThresholds,
): ComplexityViolation[] {
  return files.flatMap((entry) => {
    const exceededMetrics = [
      entry.ccn > thresholds.fileCcn
        ? `file CCN ${entry.ccn} > ${thresholds.fileCcn}`
        : null,
      entry.functionCount > thresholds.fileFunctionCount
        ? `file functions ${entry.functionCount} > ${thresholds.fileFunctionCount}`
        : null,
      entry.nloc > thresholds.fileNloc
        ? `file NLOC ${entry.nloc} > ${thresholds.fileNloc}`
        : null,
      entry.tokenCount > thresholds.fileTokenCount
        ? `file tokens ${entry.tokenCount} > ${thresholds.fileTokenCount}`
        : null,
    ].filter((metric): metric is string => metric !== null);

    return exceededMetrics.length === 0
      ? []
      : [{ metrics: exceededMetrics, target: entry.path }];
  });
}

export function findFunctionViolations(
  functions: FunctionMetrics[],
  thresholds: ComplexityThresholds,
): ComplexityViolation[] {
  return functions.flatMap((entry) => {
    const exceededMetrics = [
      entry.ccn > thresholds.functionCcn
        ? `CCN ${entry.ccn} > ${thresholds.functionCcn}`
        : null,
      entry.length > thresholds.functionLength
        ? `length ${entry.length} > ${thresholds.functionLength}`
        : null,
      entry.nestingDepth > thresholds.functionNestingDepth
        ? `nesting ${entry.nestingDepth} > ${thresholds.functionNestingDepth}`
        : null,
      entry.nloc > thresholds.functionNloc
        ? `NLOC ${entry.nloc} > ${thresholds.functionNloc}`
        : null,
      entry.tokenCount > thresholds.functionTokenCount
        ? `tokens ${entry.tokenCount} > ${thresholds.functionTokenCount}`
        : null,
      entry.parameterCount > thresholds.functionParameterCount
        ? `params ${entry.parameterCount} > ${thresholds.functionParameterCount}`
        : null,
    ].filter((metric): metric is string => metric !== null);

    return exceededMetrics.length === 0
      ? []
      : [
          {
            metrics: exceededMetrics,
            target: `${entry.functionName} (${entry.location})`,
          },
        ];
  });
}
