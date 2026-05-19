import type {
  ExecutionMetricPostProcessOptions,
  MetricResolver,
} from "@/post-process/index.ts";
import type { StepConfig } from "@/types/index.ts";

import { createExecutionMetricPostProcess } from "@/post-process/index.ts";

import type { CommandStepInput } from "./unified.ts";

import { defineStep } from "./unified.ts";

export interface MetricCommandStepFactoryEntry<
  Extension extends object,
> extends Omit<CommandStepInput, "postProcess"> {
  metric: MetricCommandStepFactoryMetric<Extension>;
}

export interface MetricCommandStepFactoryOptions<Extension extends object> {
  defaults?: Partial<Omit<CommandStepInput, "args" | "label" | "postProcess">>;
  resolve: (
    options: MetricCommandStepFactoryMetric<Extension>,
  ) => MetricResolver;
}

export interface MetricCommandStepOptions extends Omit<
  CommandStepInput,
  "postProcess"
> {
  metric: Omit<ExecutionMetricPostProcessOptions, "resolveMetric"> & {
    resolve: MetricResolver;
  };
}

type MetricCommandStepFactoryMetric<Extension extends object> = Extension &
  Omit<
  ExecutionMetricPostProcessOptions,
  "resolveMetric"
>;

/** Creates a reusable metric command-step factory with shared defaults and resolver wiring. */
export function createMetricCommandStepFactory<
  Extension extends object = Record<string, unknown>,
>(
  options: MetricCommandStepFactoryOptions<Extension>,
): (entry: MetricCommandStepFactoryEntry<Extension>) => StepConfig {
  return (entry) =>
    defineMetricCommandStep({
      ...options.defaults,
      ...entry,
      metric: {
        ...entry.metric,
        resolve: options.resolve(entry.metric),
      },
    });
}

/** Builds a command step paired with an execution-report and thresholded-metric post-process. */
export function defineMetricCommandStep(
  options: MetricCommandStepOptions,
): StepConfig {
  return defineStep({
    ...options,
    postProcess: createExecutionMetricPostProcess({
      metricLabel: options.metric.metricLabel,
      metricPath: options.metric.metricPath,
      reportPath: options.metric.reportPath,
      resolveMetric: options.metric.resolve,
      threshold: options.metric.threshold,
    }),
  });
}
