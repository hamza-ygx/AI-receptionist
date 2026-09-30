export function langOf(assistantName: string | null | undefined): "sv" | "en" {
  return assistantName && /(^|[-_])en($|[-_])/i.test(assistantName) ? "en" : "sv";
}
