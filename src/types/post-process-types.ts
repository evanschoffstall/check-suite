export interface PostProcessMessage {
  text: string;
  tone?: PostProcessTone;
}

export interface PostProcessSection {
  items: string[];
  title: string;
  tone?: PostProcessTone;
}

export type PostProcessTone = "fail" | "info" | "pass" | "warn";

export interface ProcessedCheck {
  details: string;
  label: string;
  status: "fail" | "pass";
}

export interface StepPostProcessResult {
  extraChecks?: ProcessedCheck[];
  messages?: PostProcessMessage[];
  output?: string;
  sections?: PostProcessSection[];
  status?: "fail" | "pass";
  summary?: string;
}
