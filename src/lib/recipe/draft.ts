import { z } from "zod";

/**
 * What a model is asked to return. Looser than `Recipe`: units are free text and ids are
 * assigned by the model, so `normalizeDraft` repairs and validates everything afterwards.
 */
export const DraftRecipe = z.object({
  isRecipe: z
    .boolean()
    .describe("false when the input contains no recipe (for example a caption saying 'recipe in comments')"),
  title: z.string().describe("Dish name, in the recipe's language, without emoji"),
  language: z.enum(["fr", "en"]),
  category: z.string().nullable().describe("e.g. Dessert, Main course, Plat, Entrée"),
  description: z.string().nullable().describe("One short sentence about the dish, or null"),
  servings: z.number().nullable(),
  servingsLabel: z.string().nullable().describe("e.g. 'people', 'cupcakes', 'personnes'"),
  prepMinutes: z.number().nullable(),
  cookMinutes: z.number().nullable(),
  restMinutes: z.number().nullable(),
  difficulty: z.number().nullable().describe("1 (very easy) to 5 (expert), your estimate"),
  ingredientGroups: z.array(
    z.object({
      name: z.string().nullable().describe("e.g. 'Icing', 'Pour la pâte'; null when there is one group"),
      items: z.array(
        z.object({
          id: z.string().describe("unique id like i1, i2"),
          quantity: z.number().nullable(),
          quantityMax: z.number().nullable().describe("upper bound for ranges like '2 to 3'"),
          unit: z.string().nullable().describe("unit as written, e.g. g, ml, tbsp, c. à soupe, cup"),
          name: z.string().describe("ingredient name without quantity, unit or preparation"),
          preparation: z.string().nullable().describe("e.g. melted, finely chopped"),
          optional: z.boolean(),
          raw: z.string().describe("the original line, copied verbatim"),
        }),
      ),
    }),
  ),
  steps: z.array(
    z.object({
      id: z.string().describe("unique id like s1, s2"),
      text: z.string().describe("one clear instruction, imperative mood, in the recipe's language"),
      uses: z
        .array(z.string())
        .describe("ids of ingredients first used in this step and ids of earlier steps whose result it uses"),
      action: z.string().nullable().describe("one or two words: melt, mix, fold in, bake, fouetter"),
      durationMinutes: z.number().nullable(),
      temperature: z.number().nullable(),
      temperatureUnit: z.enum(["C", "F"]).nullable(),
    }),
  ),
  equipment: z.array(z.string()),
  notes: z.array(z.string()).describe("tips, storage, variations; not the steps"),
  tags: z.array(z.string()),
  author: z.string().nullable().describe("creator handle or name when given"),
  uncertain: z
    .array(z.string())
    .describe("paths you guessed or could not read clearly, e.g. 'title', 'servings', 'i3', 's2'"),
});
export type DraftRecipe = z.infer<typeof DraftRecipe>;
