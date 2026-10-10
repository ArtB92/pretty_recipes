"use client";

import { Button, Segmented } from "@/components/ui/primitives";
import type { UiLocale } from "@/lib/i18n/ui";
import { ImportPanel } from "./ImportPanel";
import { LocaleProvider, useUi } from "./locale";
import { PreviewPanel } from "./PreviewPanel";
import { ReviewEditor } from "./ReviewEditor";
import { useStudio } from "./useStudio";

function Wordmark() {
  return (
    <span className="flex items-center gap-2.5">
      <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden>
        <rect x="3" y="5" width="22" height="24" rx="6" fill="var(--basil)" />
        <rect x="7" y="3" width="22" height="24" rx="6" fill="var(--surface)" stroke="var(--charcoal)" strokeWidth="2" />
        <path d="M12 11h12M12 16h12M12 21h7" stroke="var(--charcoal)" strokeWidth="2" strokeLinecap="round" />
        <circle cx="25" cy="22" r="4" fill="var(--saffron)" />
      </svg>
      <span className="font-display text-xl font-bold tracking-tight">Pretty Recipes</span>
    </span>
  );
}

function StudioBody() {
  const { t, locale, setLocale } = useUi();
  const studio = useStudio();
  const warning =
    studio.lastImport?.warning === "ai_rate_limited"
      ? t.warnAiRateLimited
      : studio.lastImport?.warning === "ai_unavailable"
        ? t.warnAiUnavailable
        : null;

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col px-4 pb-16 sm:px-6 lg:px-8">
      <header className="flex items-center justify-between py-5">
        <Wordmark />
        <Segmented<UiLocale>
          label={t.language}
          value={locale}
          onChange={setLocale}
          size="sm"
          options={[
            { value: "fr", label: "FR" },
            { value: "en", label: "EN" },
          ]}
        />
      </header>

      <main className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-8">
        <section className="pt-6 lg:pt-12">
          <h1 className="max-w-[16ch] font-display text-[clamp(2.4rem,4.6vw,3.9rem)] font-bold leading-[1.02] tracking-[-0.02em]">
            {t.tagline}
          </h1>
          <p className="mt-5 max-w-[52ch] text-[17px] leading-relaxed text-charcoal-soft">{t.intro}</p>
        </section>

        <section className="rounded-[28px] border border-mist bg-surface p-5 sm:p-7">
          <ImportPanel studio={studio} />
        </section>

        <section
          aria-label={t.preview}
          className="rounded-[28px] bg-surface p-4 sm:p-6 lg:sticky lg:top-6 lg:col-start-2 lg:row-span-3 lg:row-start-1 lg:self-start"
        >
          {studio.isSample && <p className="mb-3 text-sm text-charcoal-soft">{t.sampleNote}</p>}
          {warning && (
            <p role="status" className="mb-3 rounded-[14px] bg-saffron-tint px-4 py-3 text-sm">
              {warning}
            </p>
          )}
          <PreviewPanel studio={studio} />
        </section>

        <section id="review" className="scroll-mt-6">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-3xl font-bold tracking-tight">{t.review}</h2>
              <p className="mt-1 text-[15px] text-charcoal-soft">
                {t.reviewHint}
                {studio.lastImport && (
                  <span className="ml-2 inline-block rounded-full bg-basil-tint px-2.5 py-0.5 text-xs font-medium text-basil-strong">
                    {studio.lastImport.provider === "offline" ? t.poweredOffline : t.poweredAi}
                  </span>
                )}
              </p>
            </div>
            {!studio.isSample && (
              <Button variant="ghost" onClick={studio.reset}>
                {t.startOver}
              </Button>
            )}
          </div>
          <ReviewEditor key={studio.importCount} studio={studio} />
        </section>
      </main>

      <footer className="mt-16 text-sm text-charcoal-soft">{t.footer}</footer>
    </div>
  );
}

export function Studio() {
  return (
    <LocaleProvider>
      <StudioBody />
    </LocaleProvider>
  );
}
