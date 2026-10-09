import type { Language } from "@/lib/recipe/schema";

/** Words printed on the exported page. They follow the recipe's language, not the UI's. */
export const RECIPE_LABELS: Record<
  Language,
  {
    ingredients: string;
    directions: string;
    notes: string;
    serves: string;
    prep: string;
    cook: string;
    rest: string;
    difficulty: string;
    category: string;
    nameOfDish: string;
    optional: string;
    recipeCard: string;
    source: string;
    equipment: string;
  }
> = {
  en: {
    ingredients: "Ingredients",
    directions: "Directions",
    notes: "Notes",
    serves: "Serves",
    prep: "Prep time",
    cook: "Cook time",
    rest: "Rest",
    difficulty: "Difficulty",
    category: "Category",
    nameOfDish: "Name of dish",
    optional: "optional",
    recipeCard: "recipe card",
    source: "Source",
    equipment: "Equipment",
  },
  fr: {
    ingredients: "Ingrédients",
    directions: "Préparation",
    notes: "Notes",
    serves: "Pour",
    prep: "Préparation",
    cook: "Cuisson",
    rest: "Repos",
    difficulty: "Difficulté",
    category: "Catégorie",
    nameOfDish: "Nom du plat",
    optional: "facultatif",
    recipeCard: "fiche recette",
    source: "Source",
    equipment: "Matériel",
  },
};
