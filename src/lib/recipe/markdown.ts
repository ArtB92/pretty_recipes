import { RECIPE_LABELS } from "@/lib/i18n/recipe-labels";
import type { RecipeView } from "./view";

export function toMarkdown(r: RecipeView): string {
  const L = RECIPE_LABELS[r.language];
  const out: string[] = [`# ${r.title}`, ""];
  if (r.description) out.push(r.description, "");
  const meta = [
    r.category && `**${L.category}:** ${r.category}`,
    r.servingsText && `**${L.serves}:** ${r.servingsText}`,
    r.prepText && `**${L.prep}:** ${r.prepText}`,
    r.cookText && `**${L.cook}:** ${r.cookText}`,
    r.restText && `**${L.rest}:** ${r.restText}`,
  ].filter(Boolean);
  if (meta.length) out.push(meta.join("  \n"), "");

  out.push(`## ${L.ingredients}`, "");
  for (const g of r.ingredientGroups) {
    if (g.name) out.push(`### ${g.name}`, "");
    for (const it of g.items) out.push(`- [ ] ${it.line}${it.optional ? ` (${L.optional})` : ""}`);
    out.push("");
  }

  out.push(`## ${L.directions}`, "");
  r.steps.forEach((s, i) => out.push(`${i + 1}. ${s.text}`));
  out.push("");

  if (r.notes.length) {
    out.push(`## ${L.notes}`, "", ...r.notes.map((n) => `- ${n}`), "");
  }
  if (r.source.url) out.push(`${L.source}: ${r.source.url}${r.source.author ? ` (${r.source.author})` : ""}`, "");
  return out.join("\n");
}
