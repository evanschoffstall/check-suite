export function formatJunitSummary(
  passed: number,
  failed: number,
  skipped: number,
  exitCode: number,
): string {
  return `${passed} passed · ${failed} failed · ${skipped} skipped${exitCode === 0 ? "" : ` · runner exit ${exitCode}`}`;
}
