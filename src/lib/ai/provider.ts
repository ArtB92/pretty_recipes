import "server-only";
import { DraftRecipe } from "@/lib/recipe/draft";
import { geminiExtract } from "./gemini";
import { ollamaExtract } from "./ollama";
import { ProviderError, type ExtractInput, type ProviderName } from "./types";

export { ProviderError };
export type { ExtractInput, ImageInput, ProviderName } from "./types";

/** AI_PROVIDER wins; otherwise Gemini when a key is set, then Ollama when a URL is set. */
export function activeProvider(): ProviderName {
  const forced = process.env.AI_PROVIDER?.toLowerCase();
  if (forced === "gemini" || forced === "ollama" || forced === "offline") return forced;
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.OLLAMA_URL) return "ollama";
  return "offline";
}

export function supportsImages(provider: ProviderName): boolean {
  return provider !== "offline";
}

export async function extractDraft(provider: ProviderName, input: ExtractInput): Promise<DraftRecipe> {
  const raw =
    provider === "gemini"
      ? await geminiExtract(input)
      : provider === "ollama"
        ? await ollamaExtract(input)
        : null;
  if (raw === null) throw new ProviderError("No AI provider is configured.", "not_configured");

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new ProviderError("The AI returned text that is not JSON.", "bad_output");
  }
  const parsed = DraftRecipe.safeParse(json);
  if (!parsed.success) {
    throw new ProviderError(`The AI returned an unexpected shape: ${parsed.error.issues[0]?.message}`, "bad_output");
  }
  return parsed.data;
}
