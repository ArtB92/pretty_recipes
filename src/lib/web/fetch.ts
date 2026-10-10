import "server-only";
import { assertPublicUrl, FetchBlockedError, safeFetch } from "@/lib/net";
import { detectLanguage } from "@/lib/recipe/normalize";
import { pageLanguage, pageRecipeToText, pageTitle, readableText, recipeFromJsonLd, type PageRecipe } from "./recipe-page";

export class WebFetchError extends Error {
  constructor(
    message: string,
    readonly code: "unsupported_url" | "not_found" | "blocked" | "no_recipe",
  ) {
    super(message);
    this.name = "WebFetchError";
  }
}

export type WebPage = {
  url: string;
  /** Text handed to the reader: the structured recipe when the page has one, else the page text. */
  text: string;
  structured: PageRecipe | null;
  host: string;
};

const MAX_TEXT = 20_000;

export async function fetchRecipePage(input: string): Promise<WebPage> {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new WebFetchError("That is not a valid link.", "unsupported_url");
  }

  let res: Awaited<ReturnType<typeof safeFetch>>;
  try {
    res = await safeFetch(url, { check: assertPublicUrl });
  } catch (err) {
    if (err instanceof FetchBlockedError) {
      throw new WebFetchError(err.message, err.reason === "unknown_host" ? "not_found" : "unsupported_url");
    }
    throw new WebFetchError(`Could not reach ${url.hostname}. Paste the recipe as text instead.`, "blocked");
  }
  if (res.status === 404 || res.status === 410) throw new WebFetchError("This page does not exist.", "not_found");
  if (res.status !== 200) {
    throw new WebFetchError(
      `${res.url.hostname} refused the request (${res.status}). Paste the recipe as text instead.`,
      "blocked",
    );
  }

  const structured = recipeFromJsonLd(res.body);
  if (structured) {
    const sample = [structured.title, ...structured.ingredients, ...structured.sections.flatMap((s) => s.steps)].join("\n");
    const lang = structured.language?.slice(0, 2) ?? pageLanguage(res.body);
    const textLang = lang === "fr" || lang === "en" ? lang : detectLanguage(sample);
    return { url: res.url.toString(), text: pageRecipeToText(structured, textLang), structured, host: res.url.hostname };
  }

  const text = readableText(res.body);
  if (text.length < 80) throw new WebFetchError("No recipe found on this page.", "no_recipe");
  const title = pageTitle(res.body);
  return {
    url: res.url.toString(),
    text: `${title ? `${title}\n` : ""}${text}`.slice(0, MAX_TEXT),
    structured: null,
    host: res.url.hostname,
  };
}
