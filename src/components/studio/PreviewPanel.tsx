"use client";

import { useEffect, useRef, useState } from "react";
import { PAGE_WIDTH, RecipePage, type StyleId } from "@/components/templates";
import { Button, cn, inputClass, Segmented } from "@/components/ui/primitives";
import { saveBlob, slugify } from "@/lib/client/download";
import { toMarkdown } from "@/lib/recipe/markdown";
import type { UnitSystem } from "@/lib/recipe/units";
import { useUi } from "./locale";
import type { Studio } from "./useStudio";

type Busy = null | "pdf" | "png";

/** Scales an A4-wide page to the available width and keeps the wrapper's height in step. */
function useFitScale() {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.6);
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const o = outer.current;
    const i = inner.current;
    if (!o || !i) return;
    const ro = new ResizeObserver(() => {
      const s = Math.min(1, o.clientWidth / PAGE_WIDTH);
      setScale(s);
      setHeight(i.offsetHeight * s);
    });
    ro.observe(o);
    ro.observe(i);
    return () => ro.disconnect();
  }, []);
  return { outer, inner, scale, height };
}

export function PreviewPanel({ studio }: { studio: Studio }) {
  const { t } = useUi();
  const { view, style, setStyle, units, setUnits, servings, setServings, recipe } = studio;
  const { outer, inner, scale, height } = useFitScale();
  const [busy, setBusy] = useState<Busy>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const filename = slugify(recipe.title);

  async function downloadPdf() {
    setBusy("pdf");
    setError(null);
    try {
      const res = await fetch("/api/pdf", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ recipe, style, units, servings }),
      });
      if (!res.ok) throw new Error(String(res.status));
      saveBlob(await res.blob(), `${filename}.pdf`);
      setStatus(t.downloaded);
    } catch {
      setError(t.errorPdf);
    } finally {
      setBusy(null);
    }
  }

  async function downloadPng() {
    const node = inner.current?.firstElementChild as HTMLElement | null;
    if (!node) return;
    setBusy("png");
    setError(null);
    try {
      const { domToBlob } = await import("modern-screenshot");
      await document.fonts.ready;
      const blob = await domToBlob(node, { scale: 2, type: "image/png", backgroundColor: "#ffffff" });
      saveBlob(blob, `${filename}.png`);
      setStatus(t.downloaded);
    } catch {
      setError(t.errorGeneric);
    } finally {
      setBusy(null);
    }
  }

  function downloadText(kind: "md" | "json") {
    const blob =
      kind === "md"
        ? new Blob([toMarkdown(view)], { type: "text/markdown;charset=utf-8" })
        : new Blob([JSON.stringify(recipe, null, 2)], { type: "application/json" });
    saveBlob(blob, `${filename}.${kind}`);
    setStatus(t.downloaded);
  }

  useEffect(() => {
    if (!status) return;
    const id = setTimeout(() => setStatus(null), 2500);
    return () => clearTimeout(id);
  }, [status]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-charcoal-soft">{t.style}</span>
          <Segmented<StyleId>
            label={t.style}
            value={style}
            onChange={setStyle}
            options={[
              { value: "classic", label: t.styleClassic, hint: t.styleClassicHint },
              { value: "card", label: t.styleCard, hint: t.styleCardHint },
            ]}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-charcoal-soft">{t.units}</span>
          <Segmented<UnitSystem>
            label={t.units}
            value={units}
            onChange={setUnits}
            size="sm"
            options={[
              { value: "original", label: t.unitsOriginal },
              { value: "metric", label: t.unitsMetric },
              { value: "us", label: t.unitsUs },
            ]}
          />
        </div>
        {recipe.servings && (
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-charcoal-soft">{t.scaleTo}</span>
            <input
              type="number"
              min={1}
              max={200}
              className={cn(inputClass, "w-24 py-1.5")}
              value={servings ?? recipe.servings.amount}
              onChange={(e) => {
                const n = Number(e.target.value);
                setServings(Number.isFinite(n) && n > 0 ? n : null);
              }}
            />
          </label>
        )}
      </div>

      <div className="rounded-[14px] bg-mist/70 p-3 sm:p-5" role="region" aria-label={t.preview}>
        <div
          ref={outer}
          className="relative w-full"
          style={{ height: height || undefined, overflow: "clip", overflowClipMargin: 24 }}
        >
          <div
            ref={inner}
            className="absolute left-0 top-0 origin-top-left shadow-paper"
            style={{ transform: `scale(${scale})`, width: PAGE_WIDTH }}
          >
            <RecipePage key={studio.importCount} style={style} view={view} animate={studio.importCount > 0} />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={downloadPdf} disabled={busy !== null}>
          {busy === "pdf" ? t.downloading : t.downloadPdf}
        </Button>
        <Button onClick={downloadPng} disabled={busy !== null}>
          {busy === "png" ? t.downloading : t.downloadPng}
        </Button>
        <Button onClick={() => downloadText("md")}>{t.downloadMd}</Button>
        <Button onClick={() => downloadText("json")}>{t.downloadJson}</Button>
        <span role="status" className="text-sm text-basil">
          {status}
        </span>
      </div>
      {error && (
        <p role="alert" className="rounded-[14px] bg-beet-tint px-4 py-3 text-sm text-beet">
          {error}
        </p>
      )}
    </div>
  );
}
