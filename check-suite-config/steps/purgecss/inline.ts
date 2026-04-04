import type { Command, InlineTypeScriptContext } from "@/types/index.ts";

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
  const config = readPurgeCssConfig(data);
  if (!config) {
    return fail("purgecss config is invalid\n");
  }

  const safeSelectorPattern = buildSafeSelectorPattern(config.safelists);
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
    content: config.contentGlobs.map((file) => join(cwd, file)),
    css: config.cssFiles.map((file) => join(cwd, file)),
    rejected: true,
    safelist: {
      greedy: config.safelists.map((pattern) => new RegExp(pattern)),
    },
  });

  const rejectedSelectors = Array.isArray(result?.rejected)
    ? result.rejected
    : [];
  const unusedSelectors = rejectedSelectors.filter(
    (selector) =>
      selector.startsWith(config.selectorPrefix) &&
      !(safeSelectorPattern?.test(selector) ?? false),
  );

  if (unusedSelectors.length === 0) {
    return ok("no unused CSS selectors found\n");
  }

  return fail(formatUnusedSelectorOutput(unusedSelectors));
}

function buildSafeSelectorPattern(safelists: string[]): null | RegExp {
  return safelists.length > 0 ? new RegExp(safelists.join("|")) : null;
}

function formatUnusedSelectorOutput(unusedSelectors: string[]): string {
  return `${unusedSelectors.map((selector) => `  unused: ${selector}`).join("\n")}\nfound ${unusedSelectors.length} unused CSS selector(s)\n`;
}

function isStringList(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((entry) => typeof entry === "string")
  );
}

function readPurgeCssConfig(data: InlineTypeScriptContext["data"]): null | {
  contentGlobs: string[];
  cssFiles: string[];
  safelists: string[];
  selectorPrefix: string;
} {
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
    return null;
  }

  return { contentGlobs, cssFiles, safelists, selectorPrefix };
}
