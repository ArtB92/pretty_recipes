import type { RecipeView } from "@/lib/recipe/view";
import { Classic } from "./Classic";
import { RecipeCard } from "./RecipeCard";
import type { StyleId } from "./types";

export { STYLE_IDS, PAGE_WIDTH, PAGE_HEIGHT, type StyleId } from "./types";

export function RecipePage({ style, view, animate }: { style: StyleId; view: RecipeView; animate?: boolean }) {
  return style === "card" ? <RecipeCard view={view} animate={animate} /> : <Classic view={view} animate={animate} />;
}
