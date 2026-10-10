import { describe, expect, it } from "vitest";
import { DRAFT_JSON_SCHEMA } from "@/lib/ai/prompt";
import type { DraftRecipe } from "@/lib/recipe/draft";
import { normalizeDraft } from "@/lib/recipe/normalize";

const draft: DraftRecipe = {
  isRecipe: true,
  title: "Tarte aux pommes",
  language: "fr",
  category: "Dessert",
  description: null,
  servings: 6,
  servingsLabel: "personnes",
  prepMinutes: 20,
  cookMinutes: 35,
  restMinutes: null,
  difficulty: 2.4,
  ingredientGroups: [
    {
      name: null,
      items: [
        { id: "a", quantity: 1, quantityMax: null, unit: null, name: "pâte brisée", preparation: null, optional: false, raw: "1 pâte brisée" },
        { id: "b", quantity: 4, quantityMax: null, unit: null, name: "pommes", preparation: "en lamelles", optional: false, raw: "4 pommes" },
        { id: "c", quantity: 2, quantityMax: null, unit: "c. à soupe", name: "sucre", preparation: null, optional: false, raw: "2 c. à soupe de sucre" },
        { id: "d", quantity: 1, quantityMax: null, unit: "poignée", name: "amandes", preparation: null, optional: true, raw: "1 poignée d'amandes" },
        { id: "e", quantity: null, quantityMax: null, unit: null, name: "", preparation: null, optional: false, raw: "" },
      ],
    },
  ],
  steps: [
    { id: "x1", text: "Étalez la pâte dans un moule.", uses: ["a"], action: "étaler", durationMinutes: null, temperature: null, temperatureUnit: null },
    { id: "x2", text: "Disposez les pommes et le sucre.", uses: ["x1", "b", "c", "zzz"], action: "garnir", durationMinutes: null, temperature: null, temperatureUnit: null },
    { id: "x3", text: "Enfournez 35 min à 180 °C.", uses: ["x2", "x9"], action: "cuire", durationMinutes: 35, temperature: 180, temperatureUnit: null },
    { id: "x4", text: "   ", uses: [], action: null, durationMinutes: null, temperature: null, temperatureUnit: null },
  ],
  equipment: ["moule à tarte"],
  notes: [],
  tags: ["tarte"],
  author: "@chef",
  uncertain: ["c", "x3"],
};

describe("normalizeDraft", () => {
  const r = normalizeDraft(draft, { kind: "instagram", url: "https://www.instagram.com/reel/abc/" });

  it("renumbers ids and drops empty entries", () => {
    expect(r.ingredientGroups[0].items.map((i) => i.id)).toEqual(["i1", "i2", "i3", "i4"]);
    expect(r.steps.map((s) => s.id)).toEqual(["s1", "s2", "s3"]);
  });
  it("maps step references and drops dangling ones", () => {
    expect(r.steps[1].uses).toEqual(["s1", "i2", "i3"]);
    expect(r.steps[2].uses).toEqual(["s2"]);
  });
  it("normalises units and keeps unknown unit words in the name", () => {
    expect(r.ingredientGroups[0].items[2].unit).toBe("tbsp");
    expect(r.ingredientGroups[0].items[3]).toMatchObject({ unit: null, name: "poignée amandes", optional: true });
  });
  it("infers temperature units and rounds difficulty", () => {
    expect(r.steps[2].temperature).toEqual({ value: 180, unit: "C" });
    expect(r.difficulty).toBe(2);
  });
  it("maps uncertainty onto new ids", () => {
    expect(r.confidence.i3).toBeLessThan(0.6);
    expect(r.confidence.s3).toBeLessThan(0.6);
  });
  it("keeps the source", () => {
    expect(r.source).toEqual({ kind: "instagram", url: "https://www.instagram.com/reel/abc/", author: "@chef" });
  });
});

describe("model JSON schema", () => {
  it("has no keywords the Gemini API rejects", () => {
    const s = JSON.stringify(DRAFT_JSON_SCHEMA);
    expect(s).not.toContain("$schema");
    expect(s).not.toContain("additionalProperties");
    expect(DRAFT_JSON_SCHEMA.type).toBe("object");
  });
});
