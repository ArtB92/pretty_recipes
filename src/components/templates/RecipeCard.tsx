import { RECIPE_LABELS } from "@/lib/i18n/recipe-labels";
import { archivo, sacramento } from "./fonts";
import { PAGE_HEIGHT, PAGE_WIDTH, stagger, type TemplateProps } from "./types";

const INK = "#3d3a38";
const RULE = "#b9b3ad";
const PINK = "#e7a6a8";
const PINK_DEEP = "#c97a80";

function Bowl() {
  return (
    <svg width="104" height="96" viewBox="0 0 104 96" aria-hidden>
      <path d="M10 44h84c0 24-18 40-42 40S10 68 10 44z" fill={PINK} opacity="0.85" />
      <path d="M10 44h84" stroke={PINK_DEEP} strokeWidth="3" strokeLinecap="round" />
      <path d="M40 84h24l4 8H36z" fill={PINK_DEEP} opacity="0.7" />
      <path d="M58 40c6-14 14-26 22-34" stroke="#b08a6a" strokeWidth="4" strokeLinecap="round" />
      <ellipse cx="82" cy="6" rx="7" ry="5" fill="#d7b48f" transform="rotate(-40 82 6)" />
      <path d="M30 40c2-10 10-16 18-16s14 6 16 16" fill="none" stroke="#f3d3cf" strokeWidth="3" />
    </svg>
  );
}

function Utensils() {
  return (
    <svg width="120" height="110" viewBox="0 0 120 110" aria-hidden>
      <g transform="rotate(-28 60 55)">
        <ellipse cx="44" cy="22" rx="11" ry="18" fill="none" stroke="#c9c4be" strokeWidth="2" />
        <path d="M44 4v36M36 9c4 8 4 22 0 30M52 9c-4 8-4 22 0 30" stroke="#c9c4be" strokeWidth="1.5" fill="none" />
        <rect x="41" y="40" width="6" height="52" rx="3" fill="#d9d4cf" />
      </g>
      <g transform="rotate(8 60 55)">
        <rect x="52" y="8" width="20" height="32" rx="7" fill={PINK} />
        <rect x="59" y="38" width="6" height="56" rx="3" fill={PINK_DEEP} opacity="0.75" />
      </g>
      <g transform="rotate(30 60 55)">
        <ellipse cx="80" cy="22" rx="10" ry="14" fill="#e3c08f" />
        <rect x="77" y="34" width="6" height="56" rx="3" fill="#c99e66" />
      </g>
      <path d="M40 66c10 6 30 6 40 0M60 64c-6 10-14 16-20 18M60 64c6 10 14 16 20 18" stroke={PINK_DEEP} strokeWidth="2" fill="none" />
    </svg>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className={`${archivo.className} text-[11px] font-extrabold uppercase tracking-[0.12em]`}>{label}</p>
      <p className="mt-1 min-h-[26px] border-b-2 pb-1 text-[16px]" style={{ borderColor: RULE }}>
        {value ?? ""}
      </p>
    </div>
  );
}

/**
 * Style 2, after docs/recipes_formats_templates/recipe_format_3: a soft illustrated card with
 * difficulty dots, labelled fields, bullet ingredients and a notes box.
 */
export function RecipeCard({ view, animate }: TemplateProps) {
  const L = RECIPE_LABELS[view.language];
  const land = animate ? "land" : "";
  const difficulty = view.difficulty ?? 0;
  let line = 0;

  return (
    <article
      className={`${archivo.className} relative`}
      style={{ width: PAGE_WIDTH, minHeight: PAGE_HEIGHT, padding: 40, background: "#ffffff", color: INK }}
      lang={view.language}
    >
      <div className="relative flex min-h-[1042px] flex-col rounded-[28px] px-12 pb-12 pt-10" style={{ background: "#f3f0ec" }}>
        <header className="flex items-start gap-5">
          <Bowl />
          <div className="flex-1">
            <div className="flex items-end justify-between">
              <p className={`${sacramento.className} text-[64px] leading-none`}>{L.recipeCard}</p>
              <div className="pb-2 text-center">
                <div className="flex gap-1.5" aria-label={`${L.difficulty}: ${difficulty}/5`}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <span
                      key={n}
                      className="inline-block size-[18px] rounded-full border-2"
                      style={{ borderColor: INK, background: n <= difficulty ? PINK_DEEP : "transparent" }}
                    />
                  ))}
                </div>
                <p className="mt-1 text-[10px] font-extrabold uppercase tracking-[0.14em]">{L.difficulty}</p>
              </div>
            </div>
            <div className="mt-3 border-2 px-4 pb-3 pt-2" style={{ borderColor: "#8f8984" }}>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.14em]">{L.nameOfDish}</p>
              <h1 className="mt-1 text-[26px] font-normal leading-tight">{view.title}</h1>
            </div>
          </div>
        </header>

        <div className="mt-7 grid grid-cols-3 gap-8">
          <Field label={L.category} value={view.category} />
          <Field label={L.prep} value={view.prepText} />
          <Field label={L.cook} value={view.cookText} />
        </div>

        <div className="mt-9 grid flex-1 grid-cols-[42%_1fr] gap-10">
          <section>
            <h2 className="text-center text-[12px] font-extrabold uppercase tracking-[0.14em]">
              {L.ingredients}
              {view.servingsText ? ` · ${view.servingsText}` : ""}
            </h2>
            {view.ingredientGroups.map((g) => (
              <div key={g.id} className="mt-3">
                {g.name && <p className="mt-2 text-[12px] font-extrabold">{g.name}</p>}
                <ul>
                  {g.items.map((it) => (
                    <li
                      key={it.id}
                      className={`${land} flex gap-2.5 border-b py-[6px] text-[14px] leading-snug`}
                      style={{ ...stagger(line++), borderColor: RULE }}
                    >
                      <span aria-hidden className="mt-[7px] inline-block size-[5px] shrink-0 rounded-full" style={{ background: INK }} />
                      <span>
                        {it.line}
                        {it.optional && <span className="opacity-60"> ({L.optional})</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>

          <section>
            <h2 className="text-center text-[18px] font-extrabold uppercase tracking-[0.08em]">{L.directions}</h2>
            <ol className="mt-2">
              {view.steps.map((s, i) => (
                <li
                  key={s.id}
                  className={`${land} flex gap-2.5 border-b py-[6px] text-[14px] leading-snug`}
                  style={{ ...stagger(line++), borderColor: RULE }}
                >
                  <span className="shrink-0 font-extrabold" style={{ color: PINK_DEEP }}>
                    {i + 1}
                  </span>
                  <span>{s.text}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <footer className="mt-10 flex items-end gap-8">
          <div className="relative flex-1 border-2 px-5 pb-5 pt-6" style={{ borderColor: "#8f8984", maxWidth: "52%" }}>
            <p
              className={`${sacramento.className} absolute -top-6 left-1/2 -translate-x-1/2 px-3 text-[36px] leading-none`}
              style={{ background: "#f3f0ec" }}
            >
              {L.notes.toLowerCase()}
            </p>
            <ul className="space-y-1.5 text-[13px] leading-snug">
              {view.notes.length ? view.notes.map((n, i) => <li key={i}>{n}</li>) : <li className="h-16" />}
            </ul>
          </div>
          <Utensils />
        </footer>
      </div>
    </article>
  );
}
