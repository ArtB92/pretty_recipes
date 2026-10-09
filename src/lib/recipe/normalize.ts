import type { DraftRecipe } from "./draft";
import { Recipe, type Ingredient, type Language, type SourceKind, type Step } from "./schema";
import { parseIngredientLine, parseUnit } from "./units";

const FR_WORDS = /\b(le|la|les|des|du|de|et|une?|pour|avec|dans|au|aux|cuill[eè]re|farine|sucre|beurre|œufs?|oeufs?|four|minutes?|pr[ée]chauffer|m[ée]langer|ajouter|faire)\b/gi;
const EN_WORDS = /\b(the|and|of|with|for|into|cup|cups|flour|sugar|butter|eggs?|oven|minutes?|preheat|mix|add|until|bake|stir)\b/gi;

export function detectLanguage(text: string): Language {
  const fr = text.match(FR_WORDS)?.length ?? 0;
  const en = text.match(EN_WORDS)?.length ?? 0;
  return fr > en ? "fr" : "en";
}

const clean = (s: string | null | undefined) => {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  return t.length ? t : null;
};
const positive = (n: number | null | undefined) =>
  typeof n === "number" && Number.isFinite(n) && n > 0 ? n : null;

export class NotARecipeError extends Error {
  constructor() {
    super("The input does not contain a recipe.");
    this.name = "NotARecipeError";
  }
}

/**
 * Repairs a model draft into a valid `Recipe`: unique ids, normalised units, dangling step
 * references removed, per-field confidence. Throws `NotARecipeError` when there is nothing usable.
 */
export function normalizeDraft(
  draft: DraftRecipe,
  source: { kind: SourceKind; url?: string | null; author?: string | null },
  originalText = "",
): Recipe {
  const idMap = new Map<string, string>();
  let ingredientCount = 0;

  const ingredientGroups = draft.ingredientGroups
    .map((group, gi) => {
      const items: Ingredient[] = group.items
        .filter((it) => clean(it.name) || clean(it.raw))
        .map((it) => {
          const id = `i${++ingredientCount}`;
          if (it.id) idMap.set(it.id, id);
          let unit = parseUnit(it.unit);
          let name = clean(it.name) ?? "";
          let quantity = typeof it.quantity === "number" && Number.isFinite(it.quantity) ? it.quantity : null;
          let quantityMax = positive(it.quantityMax);
          let preparation = clean(it.preparation);
          // When the model left the line unsplit, parse it ourselves.
          if (!name || (quantity === null && !unit && /^\s*[\d½¼¾⅓⅔]/.test(it.raw ?? ""))) {
            const parsed = parseIngredientLine(it.raw || it.name);
            name = parsed.name || name;
            quantity = parsed.quantity;
            quantityMax = parsed.quantityMax;
            unit = parsed.unit;
            preparation = preparation ?? parsed.preparation;
          }
          // An unknown unit word ("handful") is kept in the name rather than dropped.
          if (!unit && clean(it.unit) && quantity !== null && !name.toLowerCase().includes(it.unit!.toLowerCase())) {
            name = `${clean(it.unit)} ${name}`;
          }
          return {
            id,
            quantity,
            quantityMax: quantityMax !== null && quantity !== null && quantityMax > quantity ? quantityMax : null,
            unit,
            name,
            preparation,
            optional: Boolean(it.optional),
            raw: clean(it.raw) ?? name,
          };
        });
      return { id: `g${gi + 1}`, name: clean(group.name), items };
    })
    .filter((g) => g.items.length > 0);

  const steps: Step[] = [];
  draft.steps.forEach((s) => {
    const text = clean(s.text);
    if (!text) return;
    const id = `s${steps.length + 1}`;
    const earlierSteps = new Set(steps.map((x) => x.id));
    const uses = Array.from(
      new Set(
        (s.uses ?? [])
          .map((ref) => idMap.get(ref) ?? ref)
          .filter((ref) => /^i\d+$/.test(ref) ? Number(ref.slice(1)) <= ingredientCount : earlierSteps.has(ref)),
      ),
    );
    if (s.id) idMap.set(s.id, id);
    const temp = positive(s.temperature);
    steps.push({
      id,
      text,
      uses,
      action: clean(s.action),
      durationMin: positive(s.durationMinutes),
      temperature: temp ? { value: temp, unit: s.temperatureUnit ?? (temp > 260 ? "F" : "C") } : null,
    });
  });

  if (ingredientGroups.length === 0 && steps.length === 0) throw new NotARecipeError();

  const confidence: Record<string, number> = {};
  for (const path of draft.uncertain ?? []) {
    const mapped = idMap.get(path) ?? path;
    confidence[mapped] = 0.4;
  }
  if (!clean(draft.title)) confidence.title = 0.3;

  const language =
    draft.language === "fr" || draft.language === "en" ? draft.language : detectLanguage(originalText);
  const difficulty = positive(draft.difficulty);

  return Recipe.parse({
    title: clean(draft.title) ?? (language === "fr" ? "Ma recette" : "My recipe"),
    language,
    category: clean(draft.category),
    description: clean(draft.description),
    servings: positive(draft.servings)
      ? { amount: draft.servings!, label: clean(draft.servingsLabel) }
      : null,
    times: {
      prepMin: positive(draft.prepMinutes),
      cookMin: positive(draft.cookMinutes),
      restMin: positive(draft.restMinutes),
    },
    difficulty: difficulty ? Math.min(5, Math.max(1, Math.round(difficulty))) : null,
    ingredientGroups: ingredientGroups.length ? ingredientGroups : [{ id: "g1", name: null, items: [] }],
    steps,
    equipment: draft.equipment.map(clean).filter((x): x is string => Boolean(x)),
    notes: draft.notes.map(clean).filter((x): x is string => Boolean(x)),
    tags: draft.tags.map(clean).filter((x): x is string => Boolean(x)).slice(0, 8),
    source: {
      kind: source.kind,
      url: source.url ?? null,
      author: source.author ?? clean(draft.author),
    },
    confidence,
  });
}
