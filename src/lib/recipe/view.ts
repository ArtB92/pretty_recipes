import type { Ingredient, Language, Recipe, UnitCode } from "./schema";
import { formatAmount, formatMinutes, transformAmount, type UnitSystem } from "./units";

const EN_OF_UNITS = new Set<UnitCode>(["pinch", "dash", "clove", "slice", "can", "bunch", "sprig", "piece", "packet", "stick"]);

/** "250 g de farine", "2 c. à soupe d'huile", "1 pinch of salt", "2 eggs". */
function joiner(unit: UnitCode | null, name: string, lang: Language): string {
  if (!unit) return "";
  if (lang === "fr") {
    if (/^(?:de |d'|d’|du |des )/i.test(name)) return "";
    return /^[aeiouyhœæàâéèêëîïôûù]/i.test(name) ? "d'" : "de ";
  }
  if (EN_OF_UNITS.has(unit) && !/^of /i.test(name)) return "of ";
  return "";
}

export type ViewOptions = { servings: number | null; units: UnitSystem };

export type IngredientView = Ingredient & { amount: string; line: string };
export type RecipeView = Omit<Recipe, "ingredientGroups"> & {
  ingredientGroups: Array<{ id: string; name: string | null; items: IngredientView[] }>;
  servingsText: string | null;
  prepText: string | null;
  cookText: string | null;
  restText: string | null;
};

/** Applies servings scaling and unit conversion, and pre-formats everything a style prints. */
export function toView(recipe: Recipe, opts: ViewOptions): RecipeView {
  const base = recipe.servings?.amount ?? null;
  const target = opts.servings && base ? opts.servings : base;
  const factor = base && target ? target / base : 1;
  const lang = recipe.language;

  const ingredientGroups = recipe.ingredientGroups.map((g) => ({
    id: g.id,
    name: g.name,
    items: g.items.map((it) => {
      const a = transformAmount({ quantity: it.quantity, quantityMax: it.quantityMax, unit: it.unit }, factor, opts.units);
      const amount = formatAmount(a, lang);
      const name = it.preparation ? `${it.name}, ${it.preparation}` : it.name;
      return { ...it, ...a, amount, line: amount ? `${amount} ${joiner(a.unit, name, lang)}${name}` : name };
    }),
  }));

  return {
    ...recipe,
    servings: target && recipe.servings ? { ...recipe.servings, amount: target } : recipe.servings,
    ingredientGroups,
    servingsText: target ? `${Math.round(target * 10) / 10}${recipe.servings?.label ? ` ${recipe.servings.label}` : ""}` : null,
    prepText: formatMinutes(recipe.times.prepMin),
    cookText: formatMinutes(recipe.times.cookMin),
    restText: formatMinutes(recipe.times.restMin),
  };
}
