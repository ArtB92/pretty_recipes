import "server-only";
import { ApiError, GoogleGenAI } from "@google/genai";
import { ProviderError, type ExtractInput } from "./types";
import { DRAFT_JSON_SCHEMA, SYSTEM_PROMPT, userPrompt } from "./prompt";

let client: GoogleGenAI | null = null;

/** Free-tier friendly default; override with GEMINI_MODEL when Google renames its models. */
export const GEMINI_DEFAULT_MODEL = "gemini-flash-latest";

export async function geminiExtract(input: ExtractInput): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new ProviderError("GEMINI_API_KEY is not set.", "not_configured");
  client ??= new GoogleGenAI({ apiKey });
  const model = process.env.GEMINI_MODEL || GEMINI_DEFAULT_MODEL;
  const images = input.images ?? [];

  try {
    const response = await client.models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [
            ...images.map((img) => ({ inlineData: { mimeType: img.mimeType, data: img.base64 } })),
            { text: userPrompt(input.text, images.length) },
          ],
        },
      ],
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseJsonSchema: DRAFT_JSON_SCHEMA,
        temperature: 0.1,
      },
    });
    const text = response.text;
    if (!text) throw new ProviderError("Gemini returned an empty answer.", "bad_output");
    return text;
  } catch (err) {
    if (err instanceof ProviderError) throw err;
    if (err instanceof ApiError) {
      if (err.status === 429) throw new ProviderError("Gemini's free quota is used up for now.", "rate_limited");
      if (err.status === 404) {
        throw new ProviderError(`Gemini has no model called "${model}". Set GEMINI_MODEL to a current one.`, "unavailable");
      }
      throw new ProviderError(`Gemini error ${err.status}: ${err.message}`, "unavailable");
    }
    throw new ProviderError(`Could not reach Gemini: ${(err as Error).message}`, "unavailable");
  }
}
