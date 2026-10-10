import { RECIPE_LABELS } from "@/lib/i18n/recipe-labels";
import { buildGrid, stepLabel, type GridCell } from "@/lib/recipe/grid";
import type { Step } from "@/lib/recipe/schema";
import { formatMinutes, formatTemperature } from "@/lib/recipe/units";
import { archivo } from "./fonts";
import { PAGE_HEIGHT, PAGE_WIDTH, stagger, type TemplateProps } from "./types";

/**
 * Style 2, after docs/recipes_formats_templates/recipe_format_2: the "engineer's grid".
 * Ingredients run down the left; each step is a cell that spans exactly what it combines, so
 * the steps nest like Russian dolls until the last one wraps the whole dish. Preparation steps
 * sit as full-width bars on top, and the full directions follow below for reference.
 */

const GREEN = "#3f9a45";
const LINE = `2px solid ${GREEN}`;

function stepMeta(step: Step): string[] {
  return [step.temperature && formatTemperature(step.temperature), formatMinutes(step.durationMin)].filter(
    (x): x is string => Boolean(x),
  );
}

function StepNumber({ n }: { n: number }) {
  return (
    <span aria-hidden className="absolute left-1 top-0.5 text-[10px] font-semibold leading-none" style={{ color: GREEN }}>
      {n}
    </span>
  );
}

export function EngineerGrid({ view, animate }: TemplateProps) {
  const L = RECIPE_LABELS[view.language];
  const land = animate ? "land" : "";
  const grid = buildGrid(view);
  const stepCols = grid.cols - 1;
  // The ingredient column gives up room as the nesting gets deeper.
  const ingredientWidth = stepCols <= 3 ? 54 : stepCols <= 5 ? 46 : stepCols <= 7 ? 40 : 34;
  const stepWidth = ((PAGE_WIDTH - 96 - 30) * (100 - ingredientWidth)) / 100 / Math.max(1, stepCols);
  const stepFont = stepWidth < 56 ? 12 : stepWidth < 72 ? 13 : 14.5;

  const rows: GridCell[][] = Array.from({ length: grid.rows }, () => []);
  for (const c of grid.cells) rows[c.row].push(c);

  const meta = [
    view.servingsText && { label: L.serves, value: view.servingsText },
    view.prepText && { label: L.prep, value: view.prepText },
    view.cookText && { label: L.cook, value: view.cookText },
    view.restText && { label: L.rest, value: view.restText },
  ].filter((x): x is { label: string; value: string } => Boolean(x));
  let line = 0;

  return (
    <article
      className={`${archivo.className} bg-white text-[#1d1f1d]`}
      style={{ width: PAGE_WIDTH, minHeight: PAGE_HEIGHT, padding: "52px 48px 44px" }}
      lang={view.language}
    >
      <header className="flex flex-col gap-2">
        {view.category && (
          <p className="text-[12.5px] font-semibold uppercase tracking-[0.18em]" style={{ color: GREEN }}>
            {view.category}
          </p>
        )}
        <h1 className="text-[32px] font-semibold leading-[1.1] tracking-[-0.01em]">{view.title}</h1>
        {view.description && <p className="max-w-[600px] text-[14.5px] leading-snug text-[#4a524b]">{view.description}</p>}
        {meta.length > 0 && (
          <ul className="mt-1 flex flex-wrap gap-2 text-[13px]">
            {meta.map((m) => (
              <li key={m.label} className="rounded-full border px-3 py-1" style={{ borderColor: GREEN }}>
                <span className="text-[#4a524b]">{m.label}</span> <span className="font-semibold">{m.value}</span>
              </li>
            ))}
          </ul>
        )}
      </header>

      {/* The table lands as one piece: transforms on table rows smear the collapsed borders. */}
      <div className={`${land} mt-6 rounded-[22px] p-3`} style={{ background: "#fbf9d9", boxShadow: "inset 0 0 0 1px #ece8b4" }}>
        <table
          className="w-full border-collapse bg-white text-left"
          style={{ tableLayout: "fixed", border: `3px solid ${GREEN}` }}
          aria-label={L.ingredients}
        >
          <colgroup>
            <col style={{ width: `${ingredientWidth}%` }} />
            {Array.from({ length: stepCols }, (_, i) => (
              <col key={i} />
            ))}
          </colgroup>
          <tbody>
            {grid.prep.map((p) => (
              <tr key={p.step.id}>
                <td colSpan={grid.cols} className="relative px-6 py-[7px] text-center text-[15px] leading-snug" style={{ border: LINE }}>
                  <StepNumber n={p.number} />
                  {p.step.text}
                </td>
              </tr>
            ))}
            {rows.map((cells, r) => (
              <tr key={r}>
                {cells.map((c) => {
                  const box = { border: LINE };
                  if (c.kind === "ingredient") {
                    return (
                      <td key={c.ingredient.id} className="px-2.5 py-[6px] align-middle text-[14.5px] leading-[1.25]" style={box}>
                        <span className={c.ingredient.optional ? "italic" : undefined}>{c.ingredient.dualLine}</span>
                        {c.ingredient.optional && <span className="text-[#6b736c]"> ({L.optional})</span>}
                      </td>
                    );
                  }
                  if (c.kind === "blank") {
                    return <td key={`b${c.row}-${c.col}`} rowSpan={c.rowSpan} colSpan={c.colSpan} style={box} />;
                  }
                  // Long single words ("incorporez") shrink rather than break mid-word.
                  const label = stepLabel(c.step);
                  const longest = Math.max(...label.split(/\s+/).map((w) => w.length));
                  const fontSize = Math.max(11, Math.min(stepFont, (stepWidth * c.colSpan - 12) / (longest * 0.52)));
                  return (
                    <td
                      key={c.step.id}
                      rowSpan={c.rowSpan}
                      colSpan={c.colSpan}
                      className="relative px-1.5 pb-1.5 pt-3.5 text-center align-middle leading-[1.15]"
                      style={{ ...box, fontSize, overflowWrap: "break-word" }}
                    >
                      <StepNumber n={c.number} />
                      <span className="block">{label}</span>
                      {stepMeta(c.step).map((m) => (
                        <span key={m} className="mt-1 block text-[0.86em] text-[#3d5a40]">
                          {m}
                        </span>
                      ))}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.18em]" style={{ color: GREEN }}>
          {L.directions}
        </h2>
        <ol className="columns-2 gap-8 text-[13.5px] leading-snug">
          {view.steps.map((s, i) => (
            <li key={s.id} className={`${land} mb-2 flex break-inside-avoid gap-2`} style={stagger(line++)}>
              <span className="w-5 shrink-0 text-right font-semibold" style={{ color: GREEN }}>
                {i + 1}
              </span>
              <span>{s.text}</span>
            </li>
          ))}
        </ol>
      </section>

      {view.notes.length > 0 && (
        <section className="mt-6 rounded-[14px] px-5 py-4" style={{ background: "#fbf9d9" }}>
          <h2 className="mb-1.5 text-[13px] font-semibold uppercase tracking-[0.18em]" style={{ color: GREEN }}>
            {L.notes}
          </h2>
          <ul className="list-disc pl-5 text-[13.5px] leading-snug">
            {view.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </section>
      )}

      {view.source.url && (
        <p className="mt-6 truncate text-[11.5px] text-[#6b736c]">
          {L.source}: {view.source.author ? `${view.source.author} · ` : ""}
          {view.source.url}
        </p>
      )}
    </article>
  );
}
