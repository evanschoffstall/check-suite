/**
 * Authoring input for CLI args.
 *
 * String form is split on ASCII whitespace for concise config authoring.
 * Pass an explicit array when any single argument must preserve spaces.
 */
export type CommandArgsInput = readonly string[] | string;

/** Normalizes concise string args into the array form used by the runtime. */
export function tokenizeCommandArgs(args: CommandArgsInput): string[] {
  return typeof args === "string"
    ? args
        .split(/\s+/u)
        .map((value) => value.trim())
        .filter(Boolean)
    : [...args];
}
