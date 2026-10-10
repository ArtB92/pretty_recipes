import type { RecipeView } from "@/lib/recipe/view";
import { Classic } from "./Classic";
import { EngineerGrid } from "./EngineerGrid";
import { RecipeCard } from "./RecipeCard";
import type { StyleId } from "./types";

export { STYLE_IDS, PAGE_WIDTH, PAGE_HEIGHT, type StyleId } from "./types";

export function RecipePage({ style, view, animate }: { style: StyleId; view: RecipeView; animate?: boolean }) {
  if (style === "card") return <RecipeCard view={view} animate={animate} />;
  if (style === "grid") return <EngineerGrid view={view} animate={animate} />;
  return <Classic view={view} animate={animate} />;
}
