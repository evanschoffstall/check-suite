import type {
  PostProcessMessage,
  PostProcessSection,
  SuiteRenderMode,
} from "@/types/index.ts";

import { ANSI, paint } from "./base.ts";
import { stripAnsi } from "./strings.ts";
import { getToneColor } from "./tone.ts";

/** Prints a list of post-processor messages to stdout. */
export function printPostProcessMessages(
  messages: PostProcessMessage[],
  renderMode: SuiteRenderMode = "styled",
): void {
  for (const message of messages) {
    console.info(
      renderMode === "plain"
        ? `\n${message.text}`
        : `\n${paint(message.text, ANSI.bold, getToneColor(message.tone))}`,
    );
  }
}

/** Prints a list of post-processor sections (titled bullet lists) to stdout. */
export function printPostProcessSections(
  sections: PostProcessSection[],
  renderMode: SuiteRenderMode = "styled",
): void {
  for (const section of sections) {
    const color = getToneColor(section.tone);
    console.info(
      renderMode === "plain"
        ? `\n${section.title}`
        : `\n${paint(section.title, ANSI.bold, color)}`,
    );
    for (const item of section.items) {
      console.info(
        renderMode === "plain"
          ? `  * ${item}`
          : `  ${paint("•", color)} ${paint(item, color)}`,
      );
    }
  }
}

/** Prints a labeled step output block to stdout. */
export function printStepOutput(
  label: string,
  output: string,
  renderMode: SuiteRenderMode = "styled",
): void {
  const renderedOutput = renderMode === "plain" ? stripAnsi(output) : output;
  console.info(`\n${renderMode === "plain" ? label : paint(label, ANSI.bold)}`);
  if (!renderedOutput.trim()) {
    console.info(
      renderMode === "plain" ? "(no output)" : paint("(no output)", ANSI.gray),
    );
    return;
  }

  process.stdout.write(
    renderedOutput.endsWith("\n")
      ? renderedOutput
      : `${renderedOutput.replace(/\s+$/g, "")}\n`,
  );
}
