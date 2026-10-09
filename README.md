# Pretty Recipes

Turn a messy recipe into a clean page you'll want to print. Paste text, drop a photo of a cookbook page, or share a TikTok or Instagram link; review what was read; pick a style; download it as PDF, PNG, Markdown or JSON. French and English.

The design and roadmap are in the [implementation plan](https://claude.ai/code/artifact/a91a16e9-713a-4f2a-b567-cca3e6ae47b8).

## Run it with Docker

```bash
cp .env.example .env        # optional: add a free Gemini key, see below
docker compose up --build
```

Open http://localhost:3000.

### Choose who reads the recipes

| Option | Cost | Setup | Quality |
| --- | --- | --- | --- |
| Gemini free tier (recommended) | free | get a key at [Google AI Studio](https://aistudio.google.com/apikey), put it in `GEMINI_API_KEY` | best, reads photos well |
| Ollama, fully local | free | `docker compose --profile ollama up`, then `docker compose exec ollama ollama pull gemma3:4b`, and set `OLLAMA_URL=http://ollama:11434` | good on text, weaker on photos, needs about 8 GB RAM |
| Offline reader | free | nothing | well-formatted text only, no photos |

With no key the app uses the offline reader. If Gemini hits its free quota, text imports fall back to the offline reader and the page says so.

Google may use requests sent on the free tier to improve its models, so don't send private material through it.

## Develop

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm test         # unit tests (Vitest)
pnpm lint && pnpm typecheck
```

PDF export drives headless Chromium. Locally, install it once with `pnpm exec playwright-core install chromium`, or point `CHROMIUM_PATH` at an existing Chrome.

## How it works

```
text / photo / TikTok / Instagram
        │  src/lib/social     (TikTok oEmbed, Instagram embed page)
        ▼
  AI or offline reader       src/lib/ai, src/lib/recipe/heuristic.ts
        │  returns a draft, then normalizeDraft() repairs ids and units
        ▼
  canonical Recipe           src/lib/recipe/schema.ts (Zod)
        │  edited in the browser, scaled and converted by toView()
        ▼
  styles                     src/components/templates (Classic, Recipe card)
        ▼
  PDF (/api/pdf, Chromium) · PNG (in the browser) · Markdown · JSON
```

Nothing is stored on the server; the current recipe is kept in the browser.
