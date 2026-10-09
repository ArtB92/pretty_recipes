export type ImageInput = { mimeType: string; base64: string };
export type ExtractInput = { text?: string; images?: ImageInput[] };
export type ProviderName = "gemini" | "ollama" | "offline";

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly code: "rate_limited" | "unavailable" | "bad_output" | "not_configured",
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
