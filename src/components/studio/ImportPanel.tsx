"use client";

import { useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import type { ImportResponse } from "@/app/api/import/route";
import { ImageReadError, prepareImage, type PreparedImage } from "@/lib/client/images";
import { Button, cn, inputClass, Segmented } from "@/components/ui/primitives";
import { useUi } from "./locale";
import type { Studio } from "./useStudio";

type Mode = "text" | "link" | "photo";
const MAX_PHOTOS = 4;

export function ImportPanel({ studio }: { studio: Studio }) {
  const { t } = useUi();
  const [mode, setMode] = useState<Mode>("text");
  const [text, setText] = useState("");
  const [link, setLink] = useState("");
  const [photos, setPhotos] = useState<PreparedImage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imagesSupported, setImagesSupported] = useState<boolean | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/import")
      .then((r) => r.json())
      .then((d: { images: boolean }) => !cancelled && setImagesSupported(Boolean(d.images)))
      .catch(() => !cancelled && setImagesSupported(false));
    return () => {
      cancelled = true;
    };
  }, []);

  async function addFiles(files: FileList | File[]) {
    setError(null);
    const list = Array.from(files).filter((f) => f.type.startsWith("image/") || /\.hei[cf]$/i.test(f.name));
    const room = MAX_PHOTOS - photos.length;
    const prepared: PreparedImage[] = [];
    for (const f of list.slice(0, room)) {
      try {
        prepared.push(await prepareImage(f));
      } catch (e) {
        const name = e instanceof ImageReadError ? e.fileName : f.name;
        setError(`${name}: ${t.errorPhotoFormat}`);
      }
    }
    setPhotos((p) => [...p, ...prepared]);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) void addFiles(e.dataTransfer.files);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    let body: unknown;
    if (mode === "text") {
      if (text.trim().length < 10) return setError(t.errorTooShort);
      body = { kind: "text", text };
    } else if (mode === "link") {
      body = { kind: "link", url: link };
    } else {
      if (!photos.length) return;
      body = { kind: "images", images: photos.map(({ mimeType, base64 }) => ({ mimeType, base64 })) };
    }
    setBusy(true);
    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as ImportResponse;
      if (!data.ok) {
        setError(data.code === "not_a_recipe" ? t.errorNotRecipe : data.error || t.errorGeneric);
        return;
      }
      studio.importRecipe(data.recipe, { provider: data.provider, warning: data.warning });
      document.getElementById("review")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch {
      setError(t.errorGeneric);
    } finally {
      setBusy(false);
    }
  }

  const canSubmit =
    !busy &&
    ((mode === "text" && text.trim().length > 0) ||
      (mode === "link" && link.trim().length > 0) ||
      (mode === "photo" && photos.length > 0 && imagesSupported !== false));

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" aria-busy={busy}>
      <Segmented
        label={t.textLabel}
        value={mode}
        onChange={(m) => {
          setMode(m);
          setError(null);
        }}
        options={[
          { value: "text", label: t.tabText },
          { value: "photo", label: t.tabPhoto },
          { value: "link", label: t.tabLink },
        ]}
      />

      {mode === "text" && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="import-text" className="sr-only">
            {t.textLabel}
          </label>
          <textarea
            id="import-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t.textPlaceholder}
            rows={9}
            maxLength={20_000}
            className={cn(inputClass, "min-h-[220px] resize-y leading-relaxed")}
          />
        </div>
      )}

      {mode === "link" && (
        <div className="flex flex-col gap-2">
          <label htmlFor="import-link" className="text-[13px] font-medium text-charcoal-soft">
            {t.linkLabel}
          </label>
          <input
            id="import-link"
            type="url"
            inputMode="url"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder={t.linkPlaceholder}
            className={inputClass}
          />
          <p className="text-[13px] text-charcoal-soft">{t.linkHint}</p>
        </div>
      )}

      {mode === "photo" && (
        <div className="flex flex-col gap-3">
          {imagesSupported === false ? (
            <p className="rounded-[14px] bg-saffron-tint px-4 py-3 text-sm">{t.photoNeedsAi}</p>
          ) : (
            <>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                className={cn(
                  "flex min-h-[160px] flex-col items-center justify-center gap-2 rounded-[14px] border-2 border-dashed px-4 text-center transition-colors",
                  dragging ? "border-basil bg-basil-tint" : "border-mist-strong",
                )}
              >
                <Button type="button" onClick={() => fileInput.current?.click()} disabled={photos.length >= MAX_PHOTOS}>
                  {t.photoDrop}
                </Button>
                <p className="max-w-sm text-[13px] text-charcoal-soft">{t.photoHint}</p>
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*,.heic,.heif"
                  multiple
                  className="sr-only"
                  aria-label={t.photoLabel}
                  onChange={(e) => {
                    if (e.target.files) void addFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </div>
              {photos.length > 0 && (
                <ul className="flex flex-wrap gap-3">
                  {photos.map((p, i) => (
                    <li key={p.previewUrl.slice(-32) + i} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element -- local data URL preview */}
                      <img src={p.previewUrl} alt={p.name} className="size-20 rounded-[10px] object-cover" />
                      <button
                        type="button"
                        onClick={() => setPhotos((ps) => ps.filter((_, j) => j !== i))}
                        aria-label={`${t.photoRemove}: ${p.name}`}
                        className="absolute -right-2 -top-2 grid size-6 place-items-center rounded-full bg-charcoal text-xs text-enamel"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-[14px] bg-beet-tint px-4 py-3 text-sm text-beet">
          {error}
        </p>
      )}

      <div className="flex items-center gap-4">
        <Button type="submit" variant="primary" disabled={!canSubmit}>
          {busy ? t.working : t.submit}
        </Button>
        {busy && (
          <span aria-hidden className="size-5 animate-spin rounded-full border-2 border-basil border-t-transparent motion-reduce:animate-none" />
        )}
      </div>
    </form>
  );
}
