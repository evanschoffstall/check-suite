import type { PostProcessMessage, PostProcessSection } from "@/types/index.ts";

import { ANSI, paint } from "./base.ts";
import { getToneColor } from "./tone.ts";

/** Prints a list of post-processor messages to stdout. */
export function printPostProcessMessages(messages: PostProcessMessage[]): void {
  for (const message of messages) {
    console.info(
      `\n${paint(message.text, ANSI.bold, getToneColor(message.tone))}`,
    );
  }
}

/** Prints a list of post-processor sections (titled bullet lists) to stdout. */
export function printPostProcessSections(sections: PostProcessSection[]): void {
  for (const section of sections) {
    const color = getToneColor(section.tone);
    console.info(`\n${paint(section.title, ANSI.bold, color)}`);
    for (const item of section.items) {
      console.info(`  ${paint("•", color)} ${paint(item, color)}`);
    }
  }
}

/** Prints a labeled step output block to stdout. */
export function printStepOutput(label: string, output: string): void {
  console.info(`\n${paint(label, ANSI.bold)}`);
  if (!output.trim()) {
    console.info(paint("(no output)", ANSI.gray));
    return;
  }

  process.stdout.write(
    output.endsWith("\n") ? output : `${output.replace(/\s+$/g, "")}\n`,
  );
}
