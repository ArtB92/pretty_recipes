import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { heuristicDraft } from "@/lib/recipe/heuristic";
import { normalizeDraft } from "@/lib/recipe/normalize";
import { isoMinutes, pageRecipeToText, parseYield, readableText, recipeFromJsonLd } from "@/lib/web/recipe-page";

vi.mock("server-only", () => ({}));

const fixture = (f: string) => readFileSync(new URL(`./fixtures/${f}`, import.meta.url), "utf8");

describe("recipeFromJsonLd", () => {
  it("reads a Marmiton-style Recipe", () => {
    const r = recipeFromJsonLd(fixture("web-flan-fr.html"))!;
    expect(r.title).toBe("Flan pâtissier traditionnel");
    expect(r.servings).toEqual({ amount: 8, label: "personnes" });
    expect([r.prepMin, r.cookMin]).toEqual([20, 50]);
    expect(r.ingredients).toHaveLength(6);
    expect(r.sections[0].steps[3]).toContain("jusqu'à épaississement");
    expect(r.author).toBe("Camille");
    expect(r.tags).toEqual(["flan", "dessert", "pâtisserie"]);
  });

  it("finds the Recipe inside a WordPress @graph with sections", () => {
    const r = recipeFromJsonLd(fixture("web-cake-en.html"))!;
    expect(r.title).toBe("The Best Chocolate Cake Recipe {Ever}");
    expect(r.author).toBe("Robin Example");
    expect(r.servings).toEqual({ amount: 24, label: "servings" });
    expect(r.ingredients[2]).toBe("¾ cup (63 g) unsweetened cocoa powder");
    expect(r.sections.map((s) => s.name)).toEqual(["Prep", "Chocolate cake"]);
    expect(r.sections[1].steps[1]).toBe("Add the milk and eggs and mix until smooth, then stir in the boiling water.");
    expect(r.description).toBe("A rich, moist chocolate cake that’s easy to make.");
  });

  it("returns null without a Recipe", () => {
    expect(recipeFromJsonLd(`<script type="application/ld+json">{"@type":"Article"}</script>`)).toBeNull();
  });

  it("feeds the offline reader a clean recipe", () => {
    for (const [f, lang] of [["web-flan-fr.html", "fr"], ["web-cake-en.html", "en"]] as const) {
      const text = pageRecipeToText(recipeFromJsonLd(fixture(f))!, lang);
      const recipe = normalizeDraft(heuristicDraft(text), { kind: "web" }, text);
      expect(recipe.language).toBe(lang);
      expect(recipe.ingredientGroups.flatMap((g) => g.items).length).toBeGreaterThanOrEqual(6);
      expect(recipe.steps.length).toBeGreaterThanOrEqual(4);
    }
  });
});

describe("page helpers", () => {
  it("parses durations and yields", () => {
    expect(isoMinutes("PT1H20M")).toBe(80);
    expect(isoMinutes("P0DT0H45M")).toBe(45);
    expect(isoMinutes("PT0S")).toBeNull();
    expect(parseYield(4)).toEqual({ amount: 4, label: null });
    expect(parseYield("Pour 6 parts")).toEqual({ amount: 6, label: "parts" });
  });

  it("keeps the article text and drops page chrome", () => {
    const html = `<body><nav>Home Recipes</nav><article><h1>Soup</h1><script>x()</script><p>2 carrots</p></article><footer>©</footer></body>`;
    expect(readableText(html)).toBe("Soup\n2 carrots");
  });
});

describe("assertPublicUrl", () => {
  it("refuses local and private addresses", async () => {
    const { assertPublicUrl, isPrivateAddress } = await import("@/lib/net");
    for (const a of ["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "169.254.169.254", "::1", "fd00::1", "::ffff:10.0.0.1"]) {
      expect(isPrivateAddress(a)).toBe(true);
    }
    expect(isPrivateAddress("93.184.216.34")).toBe(false);
    for (const u of ["http://localhost:3000/", "https://127.0.0.1/", "http://[::1]/", "file:///etc/passwd", "https://example.com:8080/", "http://app.internal/"]) {
      await expect(assertPublicUrl(new URL(u))).rejects.toThrow();
    }
  });
});

describe("fetchRecipePage", () => {
  it("follows a redirect and returns the structured recipe", async () => {
    vi.resetModules();
    vi.doMock("node:dns/promises", () => ({ lookup: async () => [{ address: "93.184.216.34", family: 4 }] }));
    const html = fixture("web-flan-fr.html");
    const fetchMock = vi.fn(async (url: URL) =>
      url.pathname === "/old"
        ? new Response(null, { status: 301, headers: { location: "/recettes/flan" } })
        : new Response(html, { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { fetchRecipePage } = await import("@/lib/web/fetch");
    const page = await fetchRecipePage("https://www.example.fr/old");
    expect(page.url).toBe("https://www.example.fr/recettes/flan");
    expect(page.structured?.title).toBe("Flan pâtissier traditionnel");
    expect(page.text).toMatch(/^Flan pâtissier traditionnel\n/);
    expect(page.text).toContain("Ingrédients :");
    vi.unstubAllGlobals();
    vi.doUnmock("node:dns/promises");
  });
});
