"use client";

import { Button, Card, cn, CommitInput, Field, inputClass } from "@/components/ui/primitives";
import { LOW_CONFIDENCE, UNIT_CODES, type Ingredient, type Recipe, type UnitCode } from "@/lib/recipe/schema";
import { unitLabel } from "@/lib/recipe/units";
import { useUi } from "./locale";
import type { Studio } from "./useStudio";

const num = (v: string): number | null => {
  const n = Number(v.replace(",", "."));
  return v.trim() === "" || !Number.isFinite(n) ? null : n;
};

function nextId(r: Recipe, prefix: "i" | "s" | "g"): string {
  const ids =
    prefix === "i"
      ? r.ingredientGroups.flatMap((g) => g.items.map((i) => i.id))
      : prefix === "s"
        ? r.steps.map((s) => s.id)
        : r.ingredientGroups.map((g) => g.id);
  const max = ids.reduce((m, id) => Math.max(m, Number(id.slice(1)) || 0), 0);
  return `${prefix}${max + 1}`;
}

/** Grid style only: the short label and what the step combines, which shape the nesting. */
function StepLinks({ studio, index }: { studio: Studio; index: number }) {
  const { t } = useUi();
  const { recipe: r, update } = studio;
  const step = r.steps[index];
  const options = [
    ...r.steps.slice(0, index).map((s, i) => ({ id: s.id, label: `${t.step} ${i + 1}` })),
    ...r.ingredientGroups.flatMap((g) => g.items.map((it) => ({ id: it.id, label: it.name || "…" }))),
  ];
  // An ingredient or step result goes into one step only; the grid follows the first one.
  const takenBy = new Map<string, number>();
  r.steps.forEach((s, i) => s.uses.forEach((u) => takenBy.has(u) || takenBy.set(u, i)));

  const toggle = (id: string) =>
    update((x) => {
      const target = x.steps[index];
      target.uses = target.uses.includes(id) ? target.uses.filter((u) => u !== id) : [...target.uses, id];
      return x;
    });

  return (
    <div className="flex flex-col gap-2 rounded-[12px] bg-mist/50 p-2.5">
      <label className="flex items-center gap-2 text-[13px] text-charcoal-soft">
        <span className="shrink-0">{t.gridLabel}</span>
        <CommitInput
          className={cn(inputClass, "py-1.5")}
          placeholder={t.gridLabelHint}
          value={step.action ?? ""}
          onCommit={(v) =>
            update((x) => {
              x.steps[index].action = v.trim() || null;
              return x;
            })
          }
        />
      </label>
      <div role="group" aria-label={`${t.combines} (${t.step} ${index + 1})`} className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[13px] text-charcoal-soft">{t.combines}</span>
        {options.map((o) => {
          const on = step.uses.includes(o.id);
          const elsewhere = !on && takenBy.has(o.id) && takenBy.get(o.id)! < index;
          return (
            <button
              key={o.id}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(o.id)}
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-[13px] transition-colors",
                on ? "border-basil bg-basil text-white" : "border-mist-strong bg-surface hover:border-basil",
                elsewhere && "opacity-50",
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ReviewEditor({ studio }: { studio: Studio }) {
  const { t } = useUi();
  const { recipe: r, update } = studio;
  const unsure = (path: string) => (r.confidence[path] ?? 1) < LOW_CONFIDENCE;

  const setIngredient = (gid: string, iid: string, patch: Partial<Ingredient>) =>
    update((x) => {
      const it = x.ingredientGroups.find((g) => g.id === gid)?.items.find((i) => i.id === iid);
      if (it) Object.assign(it, patch);
      delete x.confidence[iid];
      return x;
    });

  return (
    <div className="flex flex-col gap-4">
      <Card title={t.basics}>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-6">
          <Field label={t.title} className="col-span-2 sm:col-span-4" uncertain={unsure("title")}>
            {(id) => (
              <input
                id={id}
                className={inputClass}
                value={r.title}
                onChange={(e) => update((x) => ({ ...x, title: e.target.value, confidence: { ...x.confidence, title: 1 } }))}
              />
            )}
          </Field>
          <Field label={t.category} className="col-span-2" uncertain={unsure("category")}>
            {(id) => (
              <input
                id={id}
                className={inputClass}
                value={r.category ?? ""}
                onChange={(e) => update((x) => ({ ...x, category: e.target.value || null }))}
              />
            )}
          </Field>
          <Field label={t.servings} uncertain={unsure("servings")}>
            {(id) => (
              <input
                id={id}
                className={inputClass}
                inputMode="decimal"
                value={r.servings?.amount ?? ""}
                onChange={(e) =>
                  update((x) => {
                    const amount = num(e.target.value);
                    return { ...x, servings: amount && amount > 0 ? { amount, label: x.servings?.label ?? null } : null };
                  })
                }
              />
            )}
          </Field>
          <Field label={t.servingsLabel}>
            {(id) => (
              <input
                id={id}
                className={inputClass}
                value={r.servings?.label ?? ""}
                disabled={!r.servings}
                onChange={(e) =>
                  update((x) => (x.servings ? { ...x, servings: { ...x.servings, label: e.target.value || null } } : x))
                }
              />
            )}
          </Field>
          {(["prepMin", "cookMin", "restMin"] as const).map((k) => (
            <Field key={k} label={k === "prepMin" ? t.prep : k === "cookMin" ? t.cook : t.rest}>
              {(id) => (
                <input
                  id={id}
                  className={inputClass}
                  inputMode="numeric"
                  value={r.times[k] ?? ""}
                  onChange={(e) => update((x) => ({ ...x, times: { ...x.times, [k]: num(e.target.value) } }))}
                />
              )}
            </Field>
          ))}
          <Field label={t.difficulty} className="col-span-2 sm:col-span-6">
            {() => (
              <div role="radiogroup" aria-label={t.difficulty} className="flex gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={r.difficulty === n}
                    aria-label={`${n}/5`}
                    onClick={() => update((x) => ({ ...x, difficulty: x.difficulty === n ? null : n }))}
                    className={cn(
                      "size-8 rounded-full border-2 transition-colors",
                      (r.difficulty ?? 0) >= n ? "border-basil bg-basil" : "border-mist-strong hover:border-basil",
                    )}
                  />
                ))}
              </div>
            )}
          </Field>
        </div>
      </Card>

      <Card
        title={t.ingredients}
        action={
          <Button
            variant="ghost"
            onClick={() =>
              update((x) => ({ ...x, ingredientGroups: [...x.ingredientGroups, { id: nextId(x, "g"), name: "", items: [] }] }))
            }
          >
            + {t.addGroup}
          </Button>
        }
      >
        <div className="flex flex-col gap-6">
          {r.ingredientGroups.map((g) => (
            <div key={g.id} className="flex flex-col gap-2">
              {(g.name !== null || r.ingredientGroups.length > 1) && (
                <div className="flex items-center gap-2">
                  <input
                    aria-label={t.groupName}
                    placeholder={t.groupName}
                    className={cn(inputClass, "font-semibold")}
                    value={g.name ?? ""}
                    onChange={(e) =>
                      update((x) => {
                        x.ingredientGroups.find((y) => y.id === g.id)!.name = e.target.value || null;
                        return x;
                      })
                    }
                  />
                  {r.ingredientGroups.length > 1 && (
                    <Button
                      variant="ghost"
                      aria-label={`${t.removeGroup}: ${g.name ?? ""}`}
                      onClick={() => update((x) => ({ ...x, ingredientGroups: x.ingredientGroups.filter((y) => y.id !== g.id) }))}
                    >
                      ✕
                    </Button>
                  )}
                </div>
              )}
              <ul className="flex flex-col gap-2">
                {g.items.map((it) => (
                  <li
                    key={it.id}
                    className={cn(
                      "grid grid-cols-[4.5rem_7.5rem_1fr_auto] items-center gap-2 rounded-[12px] p-1 max-sm:grid-cols-[4rem_6.5rem_1fr_auto]",
                      unsure(it.id) && "bg-saffron-tint",
                    )}
                  >
                    <CommitInput
                      aria-label={`${t.quantity}: ${it.name}`}
                      className={cn(inputClass, "px-2 text-right")}
                      inputMode="decimal"
                      value={it.quantity === null ? "" : String(Math.round(it.quantity * 1000) / 1000)}
                      onCommit={(v) => setIngredient(g.id, it.id, { quantity: num(v) })}
                    />
                    <select
                      aria-label={`${t.unit}: ${it.name}`}
                      className={cn(inputClass, "px-2")}
                      value={it.unit ?? ""}
                      onChange={(e) => setIngredient(g.id, it.id, { unit: (e.target.value || null) as UnitCode | null })}
                    >
                      <option value="">{t.noUnit}</option>
                      {UNIT_CODES.map((u) => (
                        <option key={u} value={u}>
                          {unitLabel(u, 1, r.language)}
                        </option>
                      ))}
                    </select>
                    <CommitInput
                      aria-label={t.name}
                      className={inputClass}
                      value={it.preparation ? `${it.name}, ${it.preparation}` : it.name}
                      onCommit={(v) => {
                        const [name, ...rest] = v.split(",");
                        setIngredient(g.id, it.id, { name: name.trim(), preparation: rest.join(",").trim() || null });
                      }}
                    />
                    <Button
                      variant="ghost"
                      aria-label={`${t.remove}: ${it.name}`}
                      onClick={() =>
                        update((x) => {
                          const grp = x.ingredientGroups.find((y) => y.id === g.id)!;
                          grp.items = grp.items.filter((i) => i.id !== it.id);
                          x.steps.forEach((s) => (s.uses = s.uses.filter((u) => u !== it.id)));
                          return x;
                        })
                      }
                    >
                      ✕
                    </Button>
                  </li>
                ))}
              </ul>
              <Button
                variant="ghost"
                className="self-start"
                onClick={() =>
                  update((x) => {
                    x.ingredientGroups
                      .find((y) => y.id === g.id)!
                      .items.push({ id: nextId(x, "i"), quantity: null, quantityMax: null, unit: null, name: "", preparation: null, optional: false, raw: "" });
                    return x;
                  })
                }
              >
                + {t.addIngredient}
              </Button>
            </div>
          ))}
        </div>
      </Card>

      <Card title={t.steps}>
        <ol className="flex flex-col gap-2">
          {r.steps.map((s, i) => (
            <li key={s.id} className={cn("flex items-start gap-2 rounded-[12px] p-1", unsure(s.id) && "bg-saffron-tint")}>
              <span className="mt-2 w-6 shrink-0 text-right font-display font-semibold text-basil">{i + 1}</span>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <textarea
                  aria-label={`${t.steps} ${i + 1}`}
                  className={cn(inputClass, "min-h-[44px] resize-y")}
                  rows={2}
                  value={s.text}
                  onChange={(e) =>
                    update((x) => {
                      x.steps[i].text = e.target.value;
                      delete x.confidence[s.id];
                      return x;
                    })
                  }
                />
                {studio.style === "grid" && <StepLinks studio={studio} index={i} />}
              </div>
              <div className="flex shrink-0 flex-col">
                <Button
                  variant="ghost"
                  aria-label={`${t.moveUp}: ${i + 1}`}
                  disabled={i === 0}
                  onClick={() =>
                    update((x) => {
                      [x.steps[i - 1], x.steps[i]] = [x.steps[i], x.steps[i - 1]];
                      return x;
                    })
                  }
                >
                  ↑
                </Button>
                <Button
                  variant="ghost"
                  aria-label={`${t.moveDown}: ${i + 1}`}
                  disabled={i === r.steps.length - 1}
                  onClick={() =>
                    update((x) => {
                      [x.steps[i + 1], x.steps[i]] = [x.steps[i], x.steps[i + 1]];
                      return x;
                    })
                  }
                >
                  ↓
                </Button>
              </div>
              <Button
                variant="ghost"
                aria-label={`${t.remove}: ${i + 1}`}
                onClick={() =>
                  update((x) => {
                    x.steps = x.steps.filter((y) => y.id !== s.id);
                    x.steps.forEach((y) => (y.uses = y.uses.filter((u) => u !== s.id)));
                    return x;
                  })
                }
              >
                ✕
              </Button>
            </li>
          ))}
        </ol>
        <Button
          variant="ghost"
          className="mt-2"
          onClick={() =>
            update((x) => {
              x.steps.push({ id: nextId(x, "s"), text: "", uses: [], action: null, durationMin: null, temperature: null });
              return x;
            })
          }
        >
          + {t.addStep}
        </Button>
      </Card>

      <Card title={t.notes}>
        <Field label={t.notesHint}>
          {(id) => (
            <textarea
              id={id}
              className={cn(inputClass, "min-h-[88px] resize-y")}
              value={r.notes.join("\n")}
              onChange={(e) => update((x) => ({ ...x, notes: e.target.value.split("\n") }))}
              onBlur={() => update((x) => ({ ...x, notes: x.notes.map((n) => n.trim()).filter(Boolean) }))}
            />
          )}
        </Field>
      </Card>
    </div>
  );
}
