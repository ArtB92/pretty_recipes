"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { STYLE_IDS, type StyleId } from "@/components/templates";
import { load, save } from "@/lib/client/storage";
import { Recipe } from "@/lib/recipe/schema";
import { SAMPLE_RECIPE } from "@/lib/recipe/sample";
import type { UnitSystem } from "@/lib/recipe/units";
import { toView } from "@/lib/recipe/view";

const KEY = "pretty-recipes:studio:v1";

type Saved = { recipe: Recipe; isSample: boolean; style: StyleId; units: UnitSystem; servings: number | null };

export type ImportMeta = { provider: string; warning: string | null };

export function useStudio() {
  const [recipe, setRecipe] = useState<Recipe>(SAMPLE_RECIPE);
  const [isSample, setIsSample] = useState(true);
  const [style, setStyle] = useState<StyleId>("classic");
  const [units, setUnits] = useState<UnitSystem>("original");
  const [servings, setServings] = useState<number | null>(null);
  const [lastImport, setLastImport] = useState<ImportMeta | null>(null);
  /** Bumped on every import so the preview replays its landing animation once. */
  const [importCount, setImportCount] = useState(0);
  const restored = useRef(false);

  // Restore the last session after hydration; the server always renders the sample.
  useEffect(() => {
    const saved = load<Saved>(KEY);
    restored.current = true;
    if (!saved) return;
    const parsed = Recipe.safeParse(saved.recipe);
    if (!parsed.success) return;
    /* eslint-disable react-hooks/set-state-in-effect -- one-time restore from browser storage */
    setRecipe(parsed.data);
    setIsSample(Boolean(saved.isSample));
    setStyle(STYLE_IDS.includes(saved.style as StyleId) ? (saved.style as StyleId) : "classic");
    setUnits(["original", "metric", "us"].includes(saved.units) ? saved.units : "original");
    setServings(typeof saved.servings === "number" ? saved.servings : null);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!restored.current) return;
    save(KEY, { recipe, isSample, style, units, servings } satisfies Saved);
  }, [recipe, isSample, style, units, servings]);

  const view = useMemo(() => toView(recipe, { servings, units }), [recipe, servings, units]);

  const importRecipe = useCallback((next: Recipe, meta: ImportMeta) => {
    setRecipe(next);
    setIsSample(false);
    setServings(null);
    setUnits("original");
    setLastImport(meta);
    setImportCount((n) => n + 1);
  }, []);

  const update = useCallback((fn: (r: Recipe) => Recipe) => {
    setRecipe((r) => fn(structuredClone(r)));
    setIsSample(false);
  }, []);

  const reset = useCallback(() => {
    setRecipe(SAMPLE_RECIPE);
    setIsSample(true);
    setServings(null);
    setUnits("original");
    setLastImport(null);
  }, []);

  return {
    recipe, view, isSample, style, setStyle, units, setUnits, servings, setServings,
    lastImport, importCount, importRecipe, update, reset,
  };
}

export type Studio = ReturnType<typeof useStudio>;
