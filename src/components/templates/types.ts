import type { CSSProperties } from "react";
import type { RecipeView } from "@/lib/recipe/view";

export type StyleId = "classic" | "grid" | "card";
export const STYLE_IDS: StyleId[] = ["classic", "grid", "card"];

export type TemplateProps = { view: RecipeView; animate?: boolean };

/** A4 at 96 dpi. Pages grow taller when a recipe needs more room; the PDF then spans pages. */
export const PAGE_WIDTH = 794;
export const PAGE_HEIGHT = 1122;

/** Stagger index for the landing animation; the class is applied only when `animate` is on. */
export function stagger(i: number): CSSProperties {
  return { ["--i" as string]: i } as CSSProperties;
}
