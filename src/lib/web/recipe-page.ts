import { decodeEntities, htmlToText } from "@/lib/social/parse";

/**
 * Pure helpers for recipe web pages. Most recipe sites (Marmiton, WordPress recipe plugins,
 * BBC Good Food…) publish a schema.org Recipe as JSON-LD for search engines; that is far more
 * reliable than scraping their markup. Pages without it fall back to their readable text.
 */

export type PageRecipe = {
  title: string | null;
  description: string | null;
  author: string | null;
  category: string | null;
  servings: { amount: number; label: string | null } | null;
  prepMin: number | null;
  cookMin: number | null;
  totalMin: number | null;
  ingredients: string[];
  /** Instruction sections; a recipe without sections has one with a null name. */
  sections: Array<{ name: string | null; steps: string[] }>;
  tags: string[];
  language: string | null;
};

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
type Obj = { [k: string]: Json };

const isObj = (v: Json | undefined): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const asArray = (v: Json | undefined): Json[] => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v]);

function hasType(o: Obj, type: string): boolean {
  return asArray(o["@type"]).some((t) => typeof t === "string" && t.toLowerCase() === type.toLowerCase());
}

/** Plain text from a JSON-LD string value, which may hold entities or HTML. */
function clean(v: Json | undefined): string | null {
  if (typeof v === "number") return String(v);
  if (typeof v !== "string") return null;
  const text = htmlToText(decodeEntities(v)).replace(/\s+/g, " ").trim();
  return text || null;
}

function nameOf(v: Json | undefined): string | null {
  for (const item of asArray(v)) {
    const s = isObj(item) ? clean(item.name) : clean(item);
    if (s) return s;
  }
  return null;
}

/** ISO 8601 durations as recipe sites write them: "PT1H20M", "P0DT0H45M", "PT90M". */
export function isoMinutes(v: Json | undefined): number | null {
  if (typeof v !== "string") return null;
  const m = v.trim().match(/^P(?:(\d+)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+)S)?)?$/i);
  if (!m) return null;
  const min = Number(m[1] ?? 0) * 1440 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0) + Math.round(Number(m[4] ?? 0) / 60);
  return min > 0 ? Math.round(min) : null;
}

/** "8 personnes", ["12", "12 slices"], 4 -> the first value with a number. */
export function parseYield(v: Json | undefined): PageRecipe["servings"] {
  const values = asArray(v).map(clean).filter((s): s is string => Boolean(s));
  const withLabel = values.find((s) => /\d\s*[\p{L}]/u.test(s));
  for (const s of withLabel ? [withLabel, ...values] : values) {
    const m = s.match(/(\d+(?:[.,]\d+)?)\s*([\p{L}][\p{L}\s.'’-]*)?/u);
    if (m) {
      const amount = Number(m[1].replace(",", "."));
      if (amount > 0) return { amount, label: m[2]?.trim().replace(/[.\s]+$/, "") || null };
    }
  }
  return null;
}

function instructionSections(v: Json | undefined): PageRecipe["sections"] {
  const sections: PageRecipe["sections"] = [];
  const loose: string[] = [];
  const stepText = (item: Json): string[] => {
    if (typeof item === "string") {
      // Some sites put every step in one string, one per line or paragraph.
      return htmlToText(decodeEntities(item))
        .split(/\n+/)
        .map((s) => s.replace(/^\s*\d{1,2}[.)]\s+/, "").trim())
        .filter(Boolean);
    }
    if (isObj(item)) {
      if (hasType(item, "HowToSection")) return [];
      const text = clean(item.text) ?? clean(item.name) ?? clean(item.description);
      return text ? [text] : [];
    }
    return [];
  };
  for (const item of asArray(v)) {
    if (isObj(item) && (hasType(item, "HowToSection") || Array.isArray(item.itemListElement))) {
      const steps = asArray(item.itemListElement).flatMap(stepText);
      if (steps.length) sections.push({ name: clean(item.name), steps });
    } else {
      loose.push(...stepText(item));
    }
  }
  if (loose.length) sections.unshift({ name: null, steps: loose });
  return sections;
}

function findRecipe(node: Json, depth = 0): Obj | null {
  if (depth > 6) return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const r = findRecipe(n, depth + 1);
      if (r) return r;
    }
    return null;
  }
  if (!isObj(node)) return null;
  if (hasType(node, "Recipe")) return node;
  for (const key of ["@graph", "mainEntity", "mainEntityOfPage", "itemListElement", "item"]) {
    if (node[key] !== undefined) {
      const r = findRecipe(node[key], depth + 1);
      if (r) return r;
    }
  }
  return null;
}

function parseJson(raw: string): Json | undefined {
  const text = raw.trim().replace(/^<!\[CDATA\[|\]\]>$/g, "");
  try {
    return JSON.parse(text);
  } catch {
    // Hand-written JSON-LD often has raw line breaks inside strings.
    try {
      return JSON.parse(text.replace(/[\u0000-\u001f]+/g, " "));
    } catch {
      return undefined;
    }
  }
}

export function recipeFromJsonLd(html: string): PageRecipe | null {
  const scripts = html.matchAll(/<script[^>]*type=["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi);
  for (const [, raw] of scripts) {
    const data = parseJson(raw);
    if (data === undefined) continue;
    const r = findRecipe(data);
    if (!r) continue;
    const ingredients = asArray(r.recipeIngredient ?? r.ingredients)
      .map(clean)
      .filter((s): s is string => Boolean(s));
    const sections = instructionSections(r.recipeInstructions);
    if (!ingredients.length && !sections.length) continue;
    const keywords = typeof r.keywords === "string" ? r.keywords.split(",") : asArray(r.keywords).map((k) => clean(k) ?? "");
    return {
      title: clean(r.name) ?? clean(r.headline),
      description: clean(r.description),
      author: nameOf(r.author),
      category: nameOf(r.recipeCategory),
      servings: parseYield(r.recipeYield ?? r.yield),
      prepMin: isoMinutes(r.prepTime),
      cookMin: isoMinutes(r.cookTime),
      totalMin: isoMinutes(r.totalTime),
      ingredients,
      sections,
      tags: keywords.map((k) => k.trim()).filter(Boolean).slice(0, 6),
      language: clean(r.inLanguage),
    };
  }
  return null;
}

/**
 * The recipe as plain text with clear headings, so the AI and the offline reader see the same
 * shape as a pasted recipe. Headings follow the page's language.
 */
export function pageRecipeToText(r: PageRecipe, lang: "fr" | "en"): string {
  const H = lang === "fr" ? { ing: "Ingrédients :", steps: "Préparation :" } : { ing: "Ingredients:", steps: "Instructions:" };
  const lines: string[] = [];
  if (r.title) lines.push(r.title);
  if (r.description) lines.push(r.description);
  lines.push("", H.ing, ...r.ingredients.map((i) => `- ${i}`), "", H.steps);
  let n = 0;
  for (const step of r.sections.flatMap((s) => s.steps)) lines.push(`${++n}. ${step}`);
  return lines.join("\n");
}

/** Readable text of a page without structured data: the article or main element, without chrome. */
export function readableText(html: string): string {
  const body =
    html.match(/<article\b[^>]*>([\s\S]*)<\/article>/i)?.[1] ??
    html.match(/<main\b[^>]*>([\s\S]*)<\/main>/i)?.[1] ??
    html.match(/<body\b[^>]*>([\s\S]*)<\/body>/i)?.[1] ??
    html;
  const stripped = body
    .replace(/<(script|style|noscript|svg|nav|header|footer|aside|form|iframe|template)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(h[1-6]|tr)>/gi, "\n");
  return htmlToText(stripped)
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

export function pageTitle(html: string): string | null {
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1];
  const title = og ?? html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return title ? decodeEntities(title).replace(/\s+/g, " ").trim() || null : null;
}

export function pageLanguage(html: string): string | null {
  return html.match(/<html[^>]*\blang=["']?([a-z]{2})/i)?.[1]?.toLowerCase() ?? null;
}
