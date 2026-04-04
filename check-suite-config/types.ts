/**
 * Represents a single pass/fail check rendered in post-process output.
 */
export interface ConfigCheck {
  details: string;
  label: string;
  status: "fail" | "pass";
}

/**
 * Represents a free-form post-process message with optional severity.
 */
export interface ConfigMessage {
  text: string;
  tone?: "fail" | "warn";
}

/**
 * Represents a titled list section in post-process output with optional severity.
 */
export interface ConfigSection {
  items: string[];
  title: string;
  tone?: "fail" | "warn";
}
