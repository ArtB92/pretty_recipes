import { z } from "zod";

/**
 * The canonical recipe. Every importer produces one, every export style reads one.
 * Quantities are numbers with a normalised unit code so they can be scaled and converted.
 */

export const UNIT_CODES = [
  "g",
  "kg",
  "mg",
  "ml",
  "cl",
  "dl",
  "l",
  "tsp",
  "tbsp",
  "cup",
  "fl_oz",
  "oz",
  "lb",
  "pinch",
  "dash",
  "clove",
  "slice",
  "can",
  "bunch",
  "sprig",
  "piece",
  "packet",
  "stick",
] as const;

export const UnitCode = z.enum(UNIT_CODES);
export type UnitCode = z.infer<typeof UnitCode>;

export const Language = z.enum(["fr", "en"]);
export type Language = z.infer<typeof Language>;

export const Ingredient = z.object({
  id: z.string(),
  quantity: z.number().nullable(),
  quantityMax: z.number().nullable(),
  unit: UnitCode.nullable(),
  name: z.string(),
  preparation: z.string().nullable(),
  optional: z.boolean(),
  raw: z.string(),
});
export type Ingredient = z.infer<typeof Ingredient>;

export const IngredientGroup = z.object({
  id: z.string(),
  name: z.string().nullable(),
  items: z.array(Ingredient),
});
export type IngredientGroup = z.infer<typeof IngredientGroup>;

export const Temperature = z.object({
  value: z.number(),
  unit: z.enum(["C", "F"]),
});
export type Temperature = z.infer<typeof Temperature>;

export const Step = z.object({
  id: z.string(),
  text: z.string(),
  /** Ingredient ids and earlier step ids this step combines. */
  uses: z.array(z.string()),
  /** Short verb used by compact styles, e.g. "melt", "fold in". */
  action: z.string().nullable(),
  durationMin: z.number().nullable(),
  temperature: Temperature.nullable(),
});
export type Step = z.infer<typeof Step>;

export const SourceKind = z.enum(["text", "image", "tiktok", "instagram", "web"]);
export type SourceKind = z.infer<typeof SourceKind>;

export const Recipe = z.object({
  title: z.string(),
  language: Language,
  category: z.string().nullable(),
  description: z.string().nullable(),
  servings: z
    .object({ amount: z.number().positive(), label: z.string().nullable() })
    .nullable(),
  times: z.object({
    prepMin: z.number().nullable(),
    cookMin: z.number().nullable(),
    restMin: z.number().nullable(),
  }),
  difficulty: z.number().int().min(1).max(5).nullable(),
  ingredientGroups: z.array(IngredientGroup),
  steps: z.array(Step),
  equipment: z.array(z.string()),
  notes: z.array(z.string()),
  tags: z.array(z.string()),
  source: z.object({
    kind: SourceKind,
    url: z.string().nullable(),
    author: z.string().nullable(),
  }),
  /** Field path -> 0..1. Fields under 0.6 are highlighted in the editor. */
  confidence: z.record(z.string(), z.number()),
});
export type Recipe = z.infer<typeof Recipe>;

export const LOW_CONFIDENCE = 0.6;

export function emptyRecipe(language: Language = "en"): Recipe {
  return {
    title: "",
    language,
    category: null,
    description: null,
    servings: null,
    times: { prepMin: null, cookMin: null, restMin: null },
    difficulty: null,
    ingredientGroups: [{ id: "g1", name: null, items: [] }],
    steps: [],
    equipment: [],
    notes: [],
    tags: [],
    source: { kind: "text", url: null, author: null },
    confidence: {},
  };
}
