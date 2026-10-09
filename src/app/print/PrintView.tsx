"use client";

import { useEffect, useState } from "react";
import { RecipePage, type StyleId } from "@/components/templates";
import { Recipe } from "@/lib/recipe/schema";
import type { UnitSystem } from "@/lib/recipe/units";
import { toView, type RecipeView } from "@/lib/recipe/view";

declare global {
  interface Window {
    __PRETTY_RECIPE__?: { recipe: unknown; style: StyleId; units: UnitSystem; servings: number | null };
  }
}

/** Rendered by headless Chromium for PDF export; the payload is injected before the page loads. */
export function PrintView() {
  const [state] = useState<{ view: RecipeView; style: StyleId } | null>(() => {
    if (!window.__PRETTY_RECIPE__) return null;
    const p = window.__PRETTY_RECIPE__;
    const parsed = Recipe.safeParse(p.recipe);
    if (!parsed.success) return null;
    return { view: toView(parsed.data, { servings: p.servings, units: p.units }), style: p.style };
  });

  useEffect(() => {
    if (!state) return;
    let cancelled = false;
    document.fonts.ready.then(() => {
      if (!cancelled) document.body.dataset.ready = "1";
    });
    return () => {
      cancelled = true;
    };
  }, [state]);

  if (!state) return null;
  return <RecipePage style={state.style} view={state.view} />;
}
