import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { heuristicDraft } from "@/lib/recipe/heuristic";
import { normalizeDraft, NotARecipeError } from "@/lib/recipe/normalize";

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

describe("offline parser", () => {
  it("parses a structured French recipe", () => {
    const text = fixture("crepes-fr.txt");
    const r = normalizeDraft(heuristicDraft(text), { kind: "text" }, text);
    expect(r.language).toBe("fr");
    expect(r.title).toBe("Crêpes de la Chandeleur");
    expect(r.servings?.amount).toBe(4);
    expect(r.times).toEqual({ prepMin: 10, cookMin: 20, restMin: 60 });
    const items = r.ingredientGroups.flatMap((g) => g.items);
    expect(items).toHaveLength(7);
    expect(items[2]).toMatchObject({ quantity: 50, unit: "cl", name: "lait" });
    expect(items[6].optional).toBe(true);
    expect(r.steps).toHaveLength(6);
    expect(r.steps[0].uses).toEqual(expect.arrayContaining(["i1"]));
    expect(r.steps[1].uses).toContain("s1");
    expect(r.notes[0]).toMatch(/rhum/);
    expect(r.tags).toContain("crepes");
  });

  it("parses an English caption", () => {
    const text = fixture("cookies-en.txt");
    const r = normalizeDraft(heuristicDraft(text), { kind: "tiktok" }, text);
    expect(r.language).toBe("en");
    expect(r.title).toBe("The BEST chewy chocolate chip cookies");
    expect(r.servings).toBeNull();
    const items = r.ingredientGroups.flatMap((g) => g.items);
    expect(items).toHaveLength(8);
    expect(items[0]).toMatchObject({ quantity: 1, unit: "cup", preparation: "melted" });
    expect(items[4]).toMatchObject({ quantity: 2.25, unit: "cup", name: "all-purpose flour" });
    expect(r.steps).toHaveLength(6);
    expect(r.steps[0].temperature).toEqual({ value: 350, unit: "F" });
    expect(r.steps[5].durationMin).toBe(10);
  });

  it("parses unstructured lines without headings", () => {
    const text = "Quick pancakes\n1 cup flour\n1 egg\n1 cup milk\n1. Whisk everything together until smooth and no lumps remain.\n2. Cook ladlefuls in a hot pan for 2 minutes per side.";
    const r = normalizeDraft(heuristicDraft(text), { kind: "text" }, text);
    expect(r.ingredientGroups[0].items).toHaveLength(3);
    expect(r.steps).toHaveLength(2);
  });

  it("rejects text without a recipe", () => {
    const text = "Recipe in the comments! Follow for more 💕";
    expect(() => normalizeDraft(heuristicDraft(text), { kind: "text" }, text)).toThrow(NotARecipeError);
  });
});
