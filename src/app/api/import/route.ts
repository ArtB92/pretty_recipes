import { z } from "zod";
import { activeProvider, extractDraft, ProviderError, supportsImages, type ProviderName } from "@/lib/ai/provider";
import { heuristicDraft } from "@/lib/recipe/heuristic";
import { NotARecipeError, normalizeDraft } from "@/lib/recipe/normalize";
import type { Recipe, SourceKind } from "@/lib/recipe/schema";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { fetchSocialPost, isSocialUrl, SocialFetchError } from "@/lib/social/fetch";
import { fetchRecipePage, WebFetchError } from "@/lib/web/fetch";
import type { PageRecipe } from "@/lib/web/recipe-page";

const MAX_TEXT = 20_000;
const MAX_IMAGES = 4;
const MAX_IMAGE_BASE64 = 8_000_000; // about 6 MB once decoded; the browser resizes before upload
const MAX_BODY = MAX_IMAGES * MAX_IMAGE_BASE64 + 100_000;

const Body = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("text"), text: z.string().trim().min(10).max(MAX_TEXT) }),
  z.object({ kind: z.literal("link"), url: z.string().trim().min(8).max(2_000) }),
  z.object({
    kind: z.literal("images"),
    text: z.string().max(2_000).optional(),
    images: z
      .array(
        z.object({
          mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
          base64: z.string().max(MAX_IMAGE_BASE64),
        }),
      )
      .min(1)
      .max(MAX_IMAGES),
  }),
]);

export type ImportResponse =
  | { ok: true; recipe: Recipe; provider: ProviderName; warning: string | null }
  | { ok: false; error: string; code: string };

function fail(status: number, code: string, error: string, headers?: HeadersInit) {
  return Response.json({ ok: false, code, error } satisfies ImportResponse, { status, headers });
}

async function fromText(
  text: string,
  source: { kind: SourceKind; url?: string | null; author?: string | null },
): Promise<{ recipe: Recipe; provider: ProviderName; warning: string | null }> {
  const provider = activeProvider();
  if (provider === "offline") {
    return { recipe: normalizeDraft(heuristicDraft(text), source, text), provider, warning: null };
  }
  try {
    const draft = await extractDraft(provider, { text });
    return { recipe: normalizeDraft(draft, source, text), provider, warning: null };
  } catch (err) {
    if (!(err instanceof ProviderError)) throw err;
    console.warn(`[import] ${provider} failed, using the offline parser: ${err.message}`);
    return {
      recipe: normalizeDraft(heuristicDraft(text), source, text),
      provider: "offline",
      warning: err.code === "rate_limited" ? "ai_rate_limited" : "ai_unavailable",
    };
  }
}

/** Facts a page states in its structured data beat what the reader inferred. */
function withPageFacts(recipe: Recipe, page: PageRecipe): Recipe {
  const r = { ...recipe, confidence: { ...recipe.confidence } };
  if (page.title) {
    r.title = page.title;
    r.confidence.title = 1;
  }
  if (page.servings) {
    r.servings = page.servings;
    r.confidence.servings = 1;
  }
  if (page.prepMin !== null || page.cookMin !== null) {
    r.times = { ...r.times, prepMin: page.prepMin ?? r.times.prepMin, cookMin: page.cookMin ?? r.times.cookMin };
  }
  if (page.category) {
    r.category = page.category;
    r.confidence.category = 1;
  }
  if (page.description && !r.description) r.description = page.description;
  if (page.tags.length && !r.tags.length) r.tags = page.tags;
  return r;
}

export async function POST(request: Request) {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BODY) return fail(413, "too_large", "This upload is too large.");

  const limit = rateLimit(clientKey(request.headers), Number(process.env.IMPORTS_PER_HOUR ?? 30), 3_600_000);
  if (!limit.ok) {
    return fail(429, "rate_limited", "Too many imports in the last hour.", { "retry-after": String(limit.retryAfterS) });
  }

  let body: z.infer<typeof Body>;
  try {
    const parsed = Body.safeParse(await request.json());
    if (!parsed.success) return fail(400, "invalid_input", parsed.error.issues[0]?.message ?? "Invalid input.");
    body = parsed.data;
  } catch {
    return fail(400, "invalid_input", "The request body must be JSON.");
  }

  const started = Date.now();
  try {
    let result: { recipe: Recipe; provider: ProviderName; warning: string | null };
    if (body.kind === "text") {
      result = await fromText(body.text, { kind: "text" });
    } else if (body.kind === "link" && isSocialUrl(body.url)) {
      const post = await fetchSocialPost(body.url);
      result = await fromText(post.caption, { kind: post.platform, url: post.url, author: post.author });
    } else if (body.kind === "link") {
      const page = await fetchRecipePage(body.url);
      result = await fromText(page.text, { kind: "web", url: page.url, author: page.structured?.author ?? page.host });
      if (page.structured) result = { ...result, recipe: withPageFacts(result.recipe, page.structured) };
    } else {
      const provider = activeProvider();
      if (!supportsImages(provider)) {
        return fail(501, "images_need_ai", "Reading photos needs an AI provider. Set GEMINI_API_KEY or OLLAMA_URL.");
      }
      const draft = await extractDraft(provider, { text: body.text, images: body.images });
      result = { recipe: normalizeDraft(draft, { kind: "image" }, body.text ?? ""), provider, warning: null };
    }
    console.info(
      JSON.stringify({ event: "import", kind: body.kind, provider: result.provider, ms: Date.now() - started, ok: true }),
    );
    return Response.json({ ok: true, ...result } satisfies ImportResponse);
  } catch (err) {
    console.info(JSON.stringify({ event: "import", kind: body.kind, ms: Date.now() - started, ok: false, error: (err as Error).name }));
    if (err instanceof NotARecipeError) return fail(422, "not_a_recipe", err.message);
    if (err instanceof SocialFetchError || err instanceof WebFetchError) {
      return fail(err.code === "unsupported_url" ? 400 : err.code === "no_recipe" ? 422 : 502, `link_${err.code}`, err.message);
    }
    if (err instanceof ProviderError) return fail(err.code === "rate_limited" ? 429 : 502, `ai_${err.code}`, err.message);
    console.error(err);
    return fail(500, "internal", "Something went wrong while reading this recipe.");
  }
}

export function GET() {
  const provider = activeProvider();
  return Response.json({ provider, images: supportsImages(provider) });
}
