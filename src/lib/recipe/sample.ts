import type { Recipe } from "./schema";

/** Shown before the first import so the page opens on a finished result. Matches template 1. */
export const SAMPLE_RECIPE: Recipe = {
  title: "Vanilla cupcakes",
  language: "en",
  category: "Desserts",
  description: null,
  servings: { amount: 12, label: "cupcakes" },
  times: { prepMin: 40, cookMin: 20, restMin: null },
  difficulty: 2,
  ingredientGroups: [
    {
      id: "g1",
      name: "Cupcake mix",
      items: [
        { id: "i1", quantity: 120, quantityMax: null, unit: "g", name: "butter", preparation: "softened", optional: false, raw: "120g Butter" },
        { id: "i2", quantity: 120, quantityMax: null, unit: "g", name: "caster sugar", preparation: null, optional: false, raw: "120g Caster Sugar" },
        { id: "i3", quantity: 2, quantityMax: null, unit: null, name: "eggs", preparation: null, optional: false, raw: "2 Eggs" },
        { id: "i4", quantity: 1, quantityMax: null, unit: "tsp", name: "vanilla extract", preparation: null, optional: false, raw: "1 tsp Vanilla extract" },
        { id: "i5", quantity: 120, quantityMax: null, unit: "g", name: "self-raising flour", preparation: null, optional: false, raw: "120g Self-raising flour" },
        { id: "i6", quantity: 2, quantityMax: null, unit: "tbsp", name: "milk", preparation: null, optional: false, raw: "2 tbsp milk" },
      ],
    },
    {
      id: "g2",
      name: "Icing",
      items: [
        { id: "i7", quantity: 140, quantityMax: null, unit: "g", name: "butter", preparation: "softened", optional: false, raw: "140g Butter" },
        { id: "i8", quantity: 275, quantityMax: null, unit: "g", name: "icing sugar", preparation: null, optional: false, raw: "275g Icing Sugar" },
        { id: "i9", quantity: 2, quantityMax: null, unit: "tbsp", name: "milk", preparation: null, optional: false, raw: "2 tbsp Milk" },
        { id: "i10", quantity: 1, quantityMax: null, unit: "dash", name: "food colouring", preparation: null, optional: true, raw: "1 drop food coloring" },
      ],
    },
  ],
  steps: [
    { id: "s1", text: "Heat the oven to 180°C (160°C fan) and line a 12-hole muffin tray with paper cases.", uses: [], action: "preheat", durationMin: null, temperature: { value: 180, unit: "C" } },
    { id: "s2", text: "Cream the butter, sugar, vanilla and eggs in a bowl until pale.", uses: ["i1", "i2", "i3", "i4"], action: "cream", durationMin: null, temperature: null },
    { id: "s3", text: "Fold in the flour and milk until the mixture is smooth.", uses: ["s2", "i5", "i6"], action: "fold in", durationMin: null, temperature: null },
    { id: "s4", text: "Spoon the mixture into the cases and bake for 15 to 20 minutes, until golden.", uses: ["s1", "s3"], action: "bake", durationMin: 20, temperature: { value: 180, unit: "C" } },
    { id: "s5", text: "Leave the cakes to cool completely on a wire rack.", uses: ["s4"], action: "cool", durationMin: null, temperature: null },
    { id: "s6", text: "Beat the butter, icing sugar and milk until smooth and creamy, then add the colouring.", uses: ["i7", "i8", "i9", "i10"], action: "beat", durationMin: null, temperature: null },
    { id: "s7", text: "Pipe the icing in a swirl on top of each cake.", uses: ["s5", "s6"], action: "pipe", durationMin: null, temperature: null },
  ],
  equipment: ["12-hole muffin tray", "piping bag"],
  notes: ["Great one to do with the kids!", "Keeps 3 days in an airtight tin."],
  tags: ["baking"],
  source: { kind: "text", url: null, author: null },
  confidence: {},
};
