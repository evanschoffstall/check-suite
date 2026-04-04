import type { Command, InlineTypeScriptContext } from "../../../src/types/index.ts";

/**
 * Runs PurgeCSS against the configured content globs and reports only rejected
 * selectors that match the configured project-owned prefix.
 */
export async function purgeCssStep({
  cwd,
  data,
  fail,
  importModule,
  join,
  ok,
}: InlineTypeScriptContext): Promise<Command> {
  const cssFiles = data.cssFiles;
  const contentGlobs = data.contentGlobs;
  const safelists = data.safelists;
  const selectorPrefix = data.selectorPrefix;

  if (
    !isStringList(cssFiles) ||
    !isStringList(contentGlobs) ||
    !isStringList(safelists) ||
    typeof selectorPrefix !== "string"
  ) {
    return fail("purgecss config is invalid\n");
  }

  const safelistPatterns = safelists.map((pattern) => new RegExp(pattern));
  const safeSelectorPattern =
    safelists.length > 0 ? new RegExp(safelists.join("|")) : null;
  const purgeCssModule = (await importModule("purgecss")) as {
    PurgeCSS: new () => {
      purge: (options: {
        content: string[];
        css: string[];
        rejected: boolean;
        safelist: { greedy: RegExp[] };
      }) => Promise<{ rejected?: string[] }[]>;
    };
  };
  const [result] = await new purgeCssModule.PurgeCSS().purge({
    content: contentGlobs.map((file) => join(cwd, file)),
    css: cssFiles.map((file) => join(cwd, file)),
    rejected: true,
    safelist: { greedy: safelistPatterns },
  });

  const rejectedSelectors = Array.isArray(result?.rejected)
    ? result.rejected
    : [];
  const unusedSelectors = rejectedSelectors.filter(
    (selector) =>
      selector.startsWith(selectorPrefix) &&
      !(safeSelectorPattern?.test(selector) ?? false),
  );

  if (unusedSelectors.length === 0) {
    return ok("no unused CSS selectors found\n");
  }

  return fail(
    `${unusedSelectors.map((selector) => `  unused: ${selector}`).join("\n")}\nfound ${unusedSelectors.length} unused CSS selector(s)\n`,
  );
}

function isStringList(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((entry) => typeof entry === "string")
  );
}
