import type { PostProcessMessage, ProcessedCheck } from "@/types/index.ts";

export interface ThresholdMetricTotals {
  covered: number;
  found: number;
  pct: number;
}

/**
 * Records a threshold check result for a numeric metric while leaving the
 * metric source and labels entirely in caller control.
 */
export function appendThresholdMetricCheck(
  totals: null | ThresholdMetricTotals,
  metricLabel: string,
  metricPath: string,
  threshold: number,
  messages: PostProcessMessage[],
  extraChecks: ProcessedCheck[],
): boolean {
  if (!totals) {
    messages.push({
      text: `Metric artifact not found: ${metricPath || "(unset)"}`,
      tone: "fail",
    });
    extraChecks.push({
      details: `0.00% (0/0) · threshold ${threshold.toFixed(1)}%`,
      label: metricLabel,
      status: "fail",
    });
    return true;
  }

  const status: "fail" | "pass" =
    totals.found > 0 && totals.pct >= threshold ? "pass" : "fail";

  extraChecks.push({
    details: `${totals.pct.toFixed(2)}% (${totals.covered}/${totals.found}) · threshold ${threshold.toFixed(1)}%`,
    label: metricLabel,
    status,
  });

  if (totals.found === 0) {
    messages.push({
      text: "No measurable entries found in metric artifact",
      tone: "fail",
    });
  }

  return status === "fail";
}
