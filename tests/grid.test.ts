import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildGrid, stepLabel, type GridLayout } from "@/lib/recipe/grid";
import { heuristicDraft } from "@/lib/recipe/heuristic";
import { normalizeDraft } from "@/lib/recipe/normalize";
import { SAMPLE_RECIPE } from "@/lib/recipe/sample";
import type { Recipe } from "@/lib/recipe/schema";
import { toView } from "@/lib/recipe/view";

const view = (r: Recipe) => toView(r, { servings: null, units: "original" });

/** Every slot of the table must be covered by exactly one cell, or the HTML table breaks. */
function expectFullCoverage(g: GridLayout) {
  const seen = Array.from({ length: g.rows }, () => Array<number>(g.cols).fill(0));
  for (const c of g.cells) {
    for (let r = c.row; r < c.row + c.rowSpan; r++) for (let k = c.col; k < c.col + c.colSpan; k++) seen[r][k]++;
  }
  expect(seen.flat().every((n) => n === 1)).toBe(true);
}

describe("buildGrid", () => {
  it("nests the sample cupcakes like template 2", () => {
    const g = buildGrid(view(SAMPLE_RECIPE));
    expect(g.prep.map((p) => p.step.id)).toEqual(["s1"]);
    expect(g.rows).toBe(10);
    expect(g.cols).toBe(6);
    const step = (id: string) => g.cells.find((c) => c.kind === "step" && c.step.id === id)!;
    expect(step("s2")).toMatchObject({ row: 0, col: 1, rowSpan: 4 });
    expect(step("s3")).toMatchObject({ row: 0, col: 2, rowSpan: 6 });
    expect(step("s5")).toMatchObject({ row: 0, col: 4, rowSpan: 6 });
    expect(step("s6")).toMatchObject({ row: 6, col: 1, rowSpan: 4 });
    expect(step("s7")).toMatchObject({ row: 0, col: 5, rowSpan: 10 });
    // Icing waits in a blank cell until it is piped on the cooled cakes.
    expect(g.cells).toContainEqual(expect.objectContaining({ kind: "blank", row: 6, col: 2, rowSpan: 4, colSpan: 3 }));
    expectFullCoverage(g);
  });

  it("gives ingredients added later a blank run up to their step", () => {
    const r: Recipe = {
      ...SAMPLE_RECIPE,
      ingredientGroups: [{ id: "g1", name: null, items: SAMPLE_RECIPE.ingredientGroups[0].items.slice(0, 3) }],
      steps: [
        { id: "s1", text: "Melt the butter", uses: ["i1"], action: "melt", durationMin: null, temperature: null },
        { id: "s2", text: "Mix with sugar", uses: ["s1", "i2"], action: "mix", durationMin: null, temperature: null },
        { id: "s3", text: "Beat in eggs", uses: ["s2", "i3"], action: "beat", durationMin: null, temperature: null },
      ],
    };
    const g = buildGrid(view(r));
    expect(g.cols).toBe(4);
    expect(g.cells).toContainEqual(expect.objectContaining({ kind: "blank", row: 1, col: 1, rowSpan: 1, colSpan: 1 }));
    expect(g.cells).toContainEqual(expect.objectContaining({ kind: "blank", row: 2, col: 1, rowSpan: 1, colSpan: 2 }));
    expectFullCoverage(g);
  });

  it("keeps separate components aligned and attaches unused ingredients", () => {
    const r: Recipe = {
      ...SAMPLE_RECIPE,
      steps: [
        { id: "s1", text: "Cream", uses: ["i1", "i2"], action: "cream", durationMin: null, temperature: null },
        { id: "s2", text: "Fold", uses: ["s1", "i5", "i1"], action: "fold", durationMin: null, temperature: null },
        { id: "s3", text: "Icing", uses: ["i7", "i8"], action: "beat", durationMin: null, temperature: null },
      ],
    };
    const g = buildGrid(view(r));
    expect(g.rows).toBe(10);
    const s3 = g.cells.find((c) => c.kind === "step" && c.step.id === "s3")!;
    expect(s3.col + s3.colSpan).toBe(g.cols);
    expectFullCoverage(g);
  });

  it("covers the table for offline-parsed recipes", () => {
    for (const f of ["crepes-fr.txt", "cookies-en.txt"]) {
      const text = readFileSync(new URL(`./fixtures/${f}`, import.meta.url), "utf8");
      expectFullCoverage(buildGrid(view(normalizeDraft(heuristicDraft(text), { kind: "text" }, text))));
    }
  });
});

describe("stepLabel", () => {
  it("prefers the action and otherwise shortens the text", () => {
    expect(stepLabel({ id: "s1", text: "x", uses: [], action: "fold in", durationMin: null, temperature: null })).toBe("fold in");
    const label = (text: string) => stepLabel({ id: "s1", text, uses: [], action: null, durationMin: null, temperature: null });
    expect(label("Puis, ajoutez le lait petit à petit en fouettant.")).toBe("ajoutez");
    expect(label("Fold in the flour, baking soda and salt.")).toBe("fold in");
    expect(label("Faites cuire les crêpes dans une poêle chaude.")).toBe("faites cuire");
    expect(label("Faites un puits au milieu et versez-y les œufs.")).toBe("faites un puits");
    expect(label("Laissez reposer la pâte 1 h.")).toBe("laissez reposer");
  });
});

describe("blank runs", () => {
  it("merges neighbours that join the same step", () => {
    const r: Recipe = {
      ...SAMPLE_RECIPE,
      ingredientGroups: [{ id: "g1", name: null, items: SAMPLE_RECIPE.ingredientGroups[0].items.slice(0, 4) }],
      steps: [
        { id: "s1", text: "Melt", uses: ["i1"], action: "melt", durationMin: null, temperature: null },
        { id: "s2", text: "Mix", uses: ["s1", "i2"], action: "mix", durationMin: null, temperature: null },
        { id: "s3", text: "Fold in", uses: ["s2", "i3", "i4"], action: "fold in", durationMin: null, temperature: null },
      ],
    };
    const g = buildGrid(view(r));
    expect(g.cells).toContainEqual(expect.objectContaining({ kind: "blank", row: 2, col: 1, rowSpan: 2, colSpan: 2 }));
    expectFullCoverage(g);
  });
});
