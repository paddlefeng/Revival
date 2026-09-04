export interface FontOption {
  label: string;
  value: string;
  file?: string;
}

export const AVAILABLE_FONTS: FontOption[] = [
  { label: "系统默认", value: "system-ui, sans-serif" },
  { label: "Helvetica Neue", value: "Helvetica Neue, sans-serif" },
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Inter", value: "Inter, sans-serif" },
  { label: "Roboto", value: "Roboto, sans-serif" },
  { label: "PingFang SC", value: "PingFang SC, system-ui" },
  { label: "Microsoft YaHei", value: "Microsoft YaHei, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Times New Roman", value: "Times New Roman, serif" },
  { label: "Monospace", value: "monospace" },
  { label: "Courier New", value: "Courier New, monospace" },
  { label: "Cursive", value: "cursive" },
];

export const DEFAULT_LOGO_FONT = "Helvetica Neue, sans-serif";
export const DEFAULT_TEXT_FONT = "monospace";