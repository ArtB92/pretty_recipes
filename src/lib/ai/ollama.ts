import "server-only";
import { ProviderError, type ExtractInput } from "./types";
import { DRAFT_JSON_SCHEMA, SYSTEM_PROMPT, userPrompt } from "./prompt";

/** Small vision model that runs on a laptop; override with OLLAMA_MODEL. */
export const OLLAMA_DEFAULT_MODEL = "gemma3:4b";

export async function ollamaExtract(input: ExtractInput): Promise<string> {
  const base = (process.env.OLLAMA_URL || "http://localhost:11434").replace(/\/$/, "");
  const model = process.env.OLLAMA_MODEL || OLLAMA_DEFAULT_MODEL;
  const images = input.images ?? [];

  let res: Response;
  try {
    res = await fetch(`${base}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model,
        stream: false,
        format: DRAFT_JSON_SCHEMA,
        options: { temperature: 0.1 },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: userPrompt(input.text, images.length),
            ...(images.length ? { images: images.map((i) => i.base64) } : {}),
          },
        ],
      }),
      signal: AbortSignal.timeout(180_000),
    });
  } catch (err) {
    throw new ProviderError(`Could not reach Ollama at ${base}: ${(err as Error).message}`, "unavailable");
  }
  if (res.status === 404) {
    throw new ProviderError(`Ollama has no model "${model}". Run: ollama pull ${model}`, "unavailable");
  }
  if (!res.ok) throw new ProviderError(`Ollama error ${res.status}`, "unavailable");
  const body = (await res.json()) as { message?: { content?: string } };
  const content = body.message?.content;
  if (!content) throw new ProviderError("Ollama returned an empty answer.", "bad_output");
  return content;
}
