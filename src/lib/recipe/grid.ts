import type { Step } from "./schema";
import type { IngredientView, RecipeView } from "./view";

/**
 * Layout for the "Engineer's grid" style (docs/recipes_formats_templates/recipe_format_2).
 *
 * Ingredients are rows on the left. Each step is a cell placed to the right of everything it
 * combines and spanning exactly those rows, so the steps nest like Russian dolls: "melt" wraps
 * the butter, "mix" wraps the melted butter and the sugar, "bake" wraps the whole batter.
 *
 * The step graph comes from `step.uses`. It must be a tree for the nesting to work, so an
 * ingredient or a step result is attached to the first step that uses it; later uses are ignored.
 */

export type GridCell =
  | { kind: "ingredient"; row: number; col: 0; rowSpan: 1; colSpan: 1; ingredient: IngredientView }
  | { kind: "step"; row: number; col: number; rowSpan: number; colSpan: number; step: Step; number: number }
  | { kind: "blank"; row: number; col: number; rowSpan: number; colSpan: number };

export type GridLayout = {
  /** Steps that use no ingredient, shown as full-width lines above the grid ("Preheat the oven"). */
  prep: Array<{ step: Step; number: number }>;
  rows: number;
  /** Ingredient column plus step columns. */
  cols: number;
  cells: GridCell[];
};

type Node =
  | { kind: "ingredient"; id: string; order: number; ingredient: IngredientView }
  | { kind: "step"; id: string; order: number; step: Step; number: number; children: Node[] };

function firstLeafOrder(n: Node): number {
  if (n.kind === "ingredient") return n.order;
  return n.children.reduce((m, c) => Math.min(m, firstLeafOrder(c)), Number.POSITIVE_INFINITY);
}

function hasIngredient(n: Node): boolean {
  return n.kind === "ingredient" || n.children.some(hasIngredient);
}

export function buildGrid(view: RecipeView): GridLayout {
  const ingredients = view.ingredientGroups.flatMap((g) => g.items);
  const ingredientNodes = new Map<string, Node>(
    ingredients.map((ingredient, order) => [ingredient.id, { kind: "ingredient", id: ingredient.id, order, ingredient }]),
  );
  const stepNodes = new Map<string, Extract<Node, { kind: "step" }>>();
  const claimed = new Set<string>();

  view.steps.forEach((step, i) => {
    const node: Extract<Node, { kind: "step" }> = { kind: "step", id: step.id, order: i, step, number: i + 1, children: [] };
    for (const ref of step.uses) {
      if (claimed.has(ref)) continue;
      const child = ingredientNodes.get(ref) ?? stepNodes.get(ref);
      if (!child) continue;
      claimed.add(ref);
      node.children.push(child);
    }
    stepNodes.set(step.id, node);
  });

  const steps = [...stepNodes.values()];
  let roots: Node[] = steps.filter((s) => !claimed.has(s.id));

  // Ingredients no step mentions still belong on the page: the last step takes them.
  const orphans = ingredients.filter((i) => !claimed.has(i.id)).map((i) => ingredientNodes.get(i.id)!);
  if (orphans.length) {
    const last = [...roots].reverse().find((r): r is Extract<Node, { kind: "step" }> => r.kind === "step" && hasIngredient(r));
    if (last) last.children.push(...orphans);
    else roots = [...roots, ...orphans];
  }

  // Steps whose whole subtree holds no ingredient are preparation lines, not grid cells.
  const prep: GridLayout["prep"] = [];
  const prune = (n: Node): Node | null => {
    if (n.kind === "ingredient") return n;
    if (!hasIngredient(n)) {
      prep.push({ step: n.step, number: n.number });
      n.children.forEach((c) => prune(c));
      return null;
    }
    n.children = n.children.map(prune).filter((c): c is Node => c !== null);
    return n;
  };
  roots = roots.map(prune).filter((r): r is Node => r !== null);
  prep.sort((a, b) => a.number - b.number);

  // Rows follow the ingredient list as closely as the nesting allows.
  const sortTree = (n: Node) => {
    if (n.kind === "step") {
      n.children.forEach(sortTree);
      n.children.sort((a, b) => firstLeafOrder(a) - firstLeafOrder(b));
    }
  };
  roots.forEach(sortTree);
  roots.sort((a, b) => firstLeafOrder(a) - firstLeafOrder(b));

  const cells: GridCell[] = [];
  const depth = (n: Node): number => (n.kind === "ingredient" ? 0 : 1 + Math.max(...n.children.map(depth)));
  const cols = 1 + Math.max(0, ...roots.map(depth));
  let row = 0;

  /** Places a subtree; returns its first row, row count and column. */
  const place = (n: Node): { start: number; span: number; col: number } => {
    if (n.kind === "ingredient") {
      cells.push({ kind: "ingredient", row, col: 0, rowSpan: 1, colSpan: 1, ingredient: n.ingredient });
      return { start: row++, span: 1, col: 0 };
    }
    const placed = n.children.map((c) => ({ ...place(c) }));
    const col = 1 + Math.max(...placed.map((p) => p.col));
    const start = placed[0].start;
    const span = placed.reduce((s, p) => s + p.span, 0);
    // Neighbours that wait for the same step share one blank, as in the template.
    let run: Extract<GridCell, { kind: "blank" }> | null = null;
    for (const p of placed) {
      if (p.col >= col - 1) {
        run = null;
      } else if (run && run.col === p.col + 1 && run.row + run.rowSpan === p.start) {
        run.rowSpan += p.span;
      } else {
        run = { kind: "blank", row: p.start, col: p.col + 1, rowSpan: p.span, colSpan: col - 1 - p.col };
        cells.push(run);
      }
    }
    cells.push({ kind: "step", row: start, col, rowSpan: span, colSpan: 1, step: n.step, number: n.number });
    return { start, span, col };
  };

  for (const r of roots) {
    const p = place(r);
    // A finished dish reaches the right edge, so separate components line up.
    if (p.col < cols - 1) {
      const top = cells.findLast((c) => c.row === p.start && c.col === p.col)!;
      top.colSpan = cols - p.col;
    }
  }

  cells.sort((a, b) => a.row - b.row || a.col - b.col);
  return { prep, rows: row, cols, cells };
}

const PARTICLES = new Set(["in", "up", "together", "down", "off", "out", "over"]);
/** "Faites cuire", "Laissez reposer", "Let rest": the verb that matters is the second one. */
const CAUSATIVE = new Set(["faites", "faire", "fais", "laissez", "laisser", "laisse", "let"]);
const DETERMINERS = new Set(["le", "la", "les", "l", "un", "une", "des", "du", "the", "a", "an"]);

/**
 * Short label for a grid cell, a verb as in the template ("melt", "fold in"). The model's
 * `action` wins; otherwise the verb is taken from the start of the step text.
 */
export function stepLabel(step: Step): string {
  if (step.action?.trim()) return step.action.trim();
  const words = step.text
    .replace(/^(?:then|next|finally|puis|ensuite|enfin)[,\s]+/i, "")
    .split(/[,.;:(]/)[0]
    .trim()
    .toLowerCase()
    .split(/[\s'’]+/)
    .filter(Boolean);
  if (words.length <= 2) return words.join(" ");
  const [verb, next, third] = words;
  if (PARTICLES.has(next)) return `${verb} ${next}`;
  if (CAUSATIVE.has(verb)) return DETERMINERS.has(next) ? `${verb} ${next} ${third}` : `${verb} ${next}`;
  return verb;
}
