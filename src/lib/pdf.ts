import "server-only";
import { chromium, type Browser } from "playwright-core";

let browser: Promise<Browser> | null = null;

/** One shared headless Chromium per server process; relaunched if it crashes. */
function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = chromium
      .launch({
        executablePath: process.env.CHROMIUM_PATH || undefined,
        args: ["--no-sandbox", "--disable-dev-shm-usage", "--font-render-hinting=none"],
      })
      .then((b) => {
        b.on("disconnected", () => {
          browser = null;
        });
        return b;
      })
      .catch((err) => {
        browser = null;
        throw err;
      });
  }
  return browser;
}

/** Internal origin of this same server. Never derived from request headers. */
function selfOrigin(): string {
  return process.env.INTERNAL_URL || `http://127.0.0.1:${process.env.PORT || 3000}`;
}

export async function renderPdf(payload: unknown): Promise<Buffer> {
  const b = await getBrowser();
  const context = await b.newContext({ viewport: { width: 794, height: 1122 }, javaScriptEnabled: true });
  try {
    const page = await context.newPage();
    // Only the app itself may be loaded: block anything that tries to leave the origin.
    const origin = selfOrigin();
    await page.route("**/*", (route) =>
      route.request().url().startsWith(origin) ? route.continue() : route.abort(),
    );
    await page.addInitScript((data) => {
      (window as unknown as { __PRETTY_RECIPE__: unknown }).__PRETTY_RECIPE__ = data;
    }, payload);
    await page.goto(`${origin}/print`, { waitUntil: "domcontentloaded", timeout: 20_000 });
    await page.waitForSelector("body[data-ready='1']", { timeout: 20_000 });
    return await page.pdf({ printBackground: true, preferCSSPageSize: true });
  } finally {
    await context.close();
  }
}
