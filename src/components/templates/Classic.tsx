import { RECIPE_LABELS } from "@/lib/i18n/recipe-labels";
import { jost } from "./fonts";
import { PAGE_HEIGHT, PAGE_WIDTH, stagger, type TemplateProps } from "./types";

/**
 * Style 1, after docs/recipes_formats_templates/recipe_format_1: tracked capitals, ruled lines,
 * ingredients with checkboxes on the left, numbered directions on the right.
 */
export function Classic({ view, animate }: TemplateProps) {
  const L = RECIPE_LABELS[view.language];
  const land = animate ? "land" : "";
  const meta = [
    view.servingsText && { label: L.serves, value: view.servingsText },
    view.prepText && { label: L.prep, value: view.prepText },
    view.cookText && { label: L.cook, value: view.cookText },
    view.restText && { label: L.rest, value: view.restText },
  ].filter((x): x is { label: string; value: string } => Boolean(x));
  let line = 0;

  return (
    <article
      className={`${jost.className} bg-white text-[#1b1b1b]`}
      style={{ width: PAGE_WIDTH, minHeight: PAGE_HEIGHT, padding: "56px 60px 48px" }}
      lang={view.language}
    >
      {view.category && (
        <p className="text-center text-[15px] font-medium uppercase tracking-[0.42em]">{view.category}</p>
      )}
      <div className="mt-4 border-y-2 border-[#1b1b1b] py-4">
        <h1 className="text-center text-[34px] font-medium uppercase leading-tight tracking-[0.22em]">{view.title}</h1>
      </div>
      {meta.length > 0 && (
        <div className="flex justify-around border-b-2 border-[#1b1b1b] py-3.5 text-[15px] uppercase tracking-[0.06em]">
          {meta.map((m) => (
            <span key={m.label}>
              {m.label}: <span className="normal-case">{m.value}</span>
            </span>
          ))}
        </div>
      )}
      {view.description && <p className="mx-auto mt-6 max-w-[560px] text-center text-[15px] font-light italic">{view.description}</p>}

      <div className="mt-9 grid grid-cols-[36%_1fr] gap-x-9">
        <section>
          <h2 className="border-b-2 border-[#1b1b1b] pb-2 text-[24px] font-medium uppercase tracking-[0.3em]">{L.ingredients}</h2>
          {view.ingredientGroups.map((g) => (
            <div key={g.id} className="mb-5">
              {g.name && (
                <h3 className="border-b border-[#9a9a9a] pb-1.5 pt-3 text-[14px] uppercase tracking-[0.08em]">{g.name}</h3>
              )}
              <ul>
                {g.items.map((it) => (
                  <li
                    key={it.id}
                    className={`${land} flex items-start gap-3 border-b border-[#9a9a9a] py-[7px] text-[14.5px] leading-snug`}
                    style={stagger(line++)}
                  >
                    <span aria-hidden className="mt-[3px] inline-block size-[12px] shrink-0 border border-[#555]" />
                    <span>
                      {it.line}
                      {it.optional && <span className="text-[#666]"> ({L.optional})</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {view.notes.length > 0 && (
            <div className="mt-8 border border-[#1b1b1b] px-5 pb-5 pt-4">
              <h2 className="text-center text-[22px] font-medium uppercase tracking-[0.3em]">{L.notes}</h2>
              <ul className="mt-3 space-y-2 text-[14px] leading-snug">
                {view.notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section>
          <h2 className="border-b-2 border-[#1b1b1b] pb-2 text-center text-[24px] font-medium uppercase tracking-[0.3em]">
            {L.directions}
          </h2>
          <ol>
            {view.steps.map((s, i) => (
              <li
                key={s.id}
                className={`${land} flex gap-3 border-b border-[#9a9a9a] py-[7px] text-[14.5px] leading-snug`}
                style={stagger(line++)}
              >
                <span className="w-6 shrink-0 text-right font-semibold">{i + 1}.</span>
                <span>{s.text}</span>
              </li>
            ))}
          </ol>
          {view.source.url && (
            <p className="mt-6 break-all text-[11px] text-[#777]">
              {L.source}: {view.source.author ? `${view.source.author} · ` : ""}
              {view.source.url}
            </p>
          )}
        </section>
      </div>
    </article>
  );
}
