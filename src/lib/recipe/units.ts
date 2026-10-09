import type { Language, UnitCode } from "./schema";

/* ------------------------------------------------------------------ */
/* Parsing                                                             */
/* ------------------------------------------------------------------ */

/** Aliases are matched on lowercased, accent-stripped text. Longest alias wins. */
const UNIT_ALIASES: Record<UnitCode, string[]> = {
  g: ["g", "gr", "grs", "gramme", "grammes", "gram", "grams"],
  kg: ["kg", "kgs", "kilo", "kilos", "kilogramme", "kilogrammes", "kilogram", "kilograms"],
  mg: ["mg", "milligramme", "milligrammes", "milligram", "milligrams"],
  ml: ["ml", "millilitre", "millilitres", "milliliter", "milliliters"],
  cl: ["cl", "centilitre", "centilitres", "centiliter", "centiliters"],
  dl: ["dl", "decilitre", "decilitres", "deciliter", "deciliters"],
  l: ["l", "litre", "litres", "liter", "liters"],
  tsp: [
    "tsp", "tsps", "teaspoon", "teaspoons", "t.",
    "c. a c.", "c.a.c.", "c.a.c", "c. a c", "cac", "cc", "c. a cafe", "c.a cafe",
    "cuillere a cafe", "cuilleres a cafe", "cuill. a cafe", "c. a the", "cuillere a the", "cuilleres a the",
  ],
  tbsp: [
    "tbsp", "tbsps", "tbs", "tbl", "tablespoon", "tablespoons", "T",
    "c. a s.", "c.a.s.", "c.a.s", "c. a s", "cas", "cs", "c. a soupe", "c.a soupe",
    "cuillere a soupe", "cuilleres a soupe", "cuill. a soupe",
  ],
  cup: ["cup", "cups", "c.", "tasse", "tasses", "verre", "verres"],
  fl_oz: ["fl oz", "fl. oz", "fl.oz", "fluid ounce", "fluid ounces"],
  oz: ["oz", "ounce", "ounces", "once", "onces"],
  lb: ["lb", "lbs", "pound", "pounds", "livre", "livres"],
  pinch: ["pinch", "pinches", "pincee", "pincees"],
  dash: ["dash", "dashes", "trait", "traits", "filet", "filets"],
  clove: ["clove", "cloves", "gousse", "gousses"],
  slice: ["slice", "slices", "tranche", "tranches"],
  can: ["can", "cans", "tin", "tins", "boite", "boites", "conserve", "conserves"],
  bunch: ["bunch", "bunches", "botte", "bottes", "bouquet", "bouquets"],
  sprig: ["sprig", "sprigs", "brin", "brins"],
  piece: ["piece", "pieces"],
  packet: ["packet", "packets", "pack", "packs", "sachet", "sachets"],
  stick: ["stick", "sticks", "baton", "batons"],
};

/** Strip accents one character at a time so string indices stay aligned with the original. */
export function fold(s: string): string {
  return Array.from(s, (c) => c.normalize("NFD").replace(/\p{M}/gu, "")).join("");
}

const ALIAS_LIST: Array<{ alias: string; code: UnitCode; caseSensitive: boolean }> = Object.entries(
  UNIT_ALIASES,
)
  .flatMap(([code, aliases]) =>
    aliases.map((alias) => ({
      alias: alias === "T" ? alias : alias.toLowerCase(),
      code: code as UnitCode,
      caseSensitive: alias === "T",
    })),
  )
  .sort((a, b) => b.alias.length - a.alias.length);

/** Returns the unit code for a free-form unit string such as "c. à soupe" or "Tbsp". */
export function parseUnit(input: string | null | undefined): UnitCode | null {
  if (!input) return null;
  const trimmed = input.trim().replace(/\s+/g, " ");
  if (trimmed === "T") return "tbsp";
  const folded = fold(trimmed).toLowerCase().replace(/\.$/, "");
  for (const { alias, code, caseSensitive } of ALIAS_LIST) {
    if (caseSensitive) continue;
    if (folded === alias || folded === alias.replace(/\.$/, "")) return code;
  }
  return null;
}

/**
 * Matches a unit at the very start of `text`. Returns the unit and how many characters it used,
 * including a following "de"/"d'"/"of".
 */
export function matchLeadingUnit(text: string): { unit: UnitCode; length: number } | null {
  const folded = fold(text);
  const lower = folded.toLowerCase();
  for (const { alias, code, caseSensitive } of ALIAS_LIST) {
    const hay = caseSensitive ? folded : lower;
    if (!hay.startsWith(alias)) continue;
    const next = hay.charAt(alias.length);
    // Units must end at a word boundary: "g " ok, "gousse" must not match "g".
    if (next && /[\p{L}\p{N}]/u.test(next) && !alias.endsWith(".")) continue;
    let length = alias.length;
    const rest = lower.slice(length);
    const connector = rest.match(/^\s*(?:de |d'|d’|of )/);
    if (connector) length += connector[0].length;
    else {
      const ws = rest.match(/^\s*/);
      length += ws ? ws[0].length : 0;
    }
    return { unit: code, length };
  }
  return null;
}

const VULGAR: Record<string, number> = {
  "½": 0.5, "⅓": 1 / 3, "⅔": 2 / 3, "¼": 0.25, "¾": 0.75,
  "⅕": 0.2, "⅖": 0.4, "⅗": 0.6, "⅘": 0.8, "⅙": 1 / 6, "⅚": 5 / 6, "⅛": 0.125, "⅜": 0.375, "⅝": 0.625, "⅞": 0.875,
};
const VULGAR_CLASS = Object.keys(VULGAR).join("");

const NUMBER = `(?:\\d+\\s+\\d+\\s*/\\s*\\d+|\\d+\\s*/\\s*\\d+|\\d+\\s*[${VULGAR_CLASS}]|[${VULGAR_CLASS}]|\\d+(?:[.,]\\d+)?)`;
const QUANTITY_RE = new RegExp(`^\\s*(${NUMBER})(?:\\s*(?:-|–|—|à|a|to|ou|or)\\s*(${NUMBER}))?\\s*`, "u");

/** Parses "1 1/2", "½", "2,5", "1½" into a number. */
export function parseNumber(token: string): number | null {
  const t = token.trim();
  let m = t.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (m) return Number(m[1]) + Number(m[2]) / Number(m[3]);
  m = t.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (m) return Number(m[2]) === 0 ? null : Number(m[1]) / Number(m[2]);
  m = t.match(new RegExp(`^(\\d+)\\s*([${VULGAR_CLASS}])$`, "u"));
  if (m) return Number(m[1]) + VULGAR[m[2]];
  if (VULGAR[t] !== undefined) return VULGAR[t];
  m = t.match(/^\d+(?:[.,]\d+)?$/);
  if (m) return Number(t.replace(",", "."));
  return null;
}

export type ParsedLine = {
  quantity: number | null;
  quantityMax: number | null;
  unit: UnitCode | null;
  name: string;
  preparation: string | null;
  optional: boolean;
};

/**
 * Splits an ingredient line such as "200 g de farine, tamisée" or "2-3 large eggs (optional)".
 * Used by the offline parser and to repair model output.
 */
export function parseIngredientLine(rawLine: string): ParsedLine {
  let line = rawLine
    .replace(/^\s*(?:[-*•·▪◦‣–—]|\d+[.)]\s|[\p{Extended_Pictographic}️‍]+)\s*/u, "")
    .trim();
  let quantity: number | null = null;
  let quantityMax: number | null = null;
  let unit: UnitCode | null = null;

  const q = line.match(QUANTITY_RE);
  if (q) {
    quantity = parseNumber(q[1]);
    quantityMax = q[2] ? parseNumber(q[2]) : null;
    if (quantity !== null) line = line.slice(q[0].length);
    else quantityMax = null;
    // "200g": the unit follows the number without a space, already handled by the regex.
  }
  if (quantity !== null) {
    // "1 (400 g) can of tomatoes": keep the parenthetical in the name.
    const u = matchLeadingUnit(line);
    if (u) {
      unit = u.unit;
      line = line.slice(u.length);
    }
  } else {
    // "Une pincée de sel", "a pinch of salt"
    const article = line.match(/^(?:une?|a|an|one)\s+/i);
    if (article) {
      const u = matchLeadingUnit(line.slice(article[0].length));
      if (u) {
        quantity = 1;
        unit = u.unit;
        line = line.slice(article[0].length + u.length);
      }
    }
  }

  let optional = false;
  const optRe = /\s*[(\[]?\s*(?:optional|optionnel(?:le)?|facultatif|facultative)\s*[)\]]?\s*/i;
  if (optRe.test(line)) {
    optional = true;
    line = line.replace(optRe, " ").trim();
  }

  let preparation: string | null = null;
  const comma = line.indexOf(",");
  if (comma > 0) {
    preparation = line.slice(comma + 1).trim() || null;
    line = line.slice(0, comma);
  }

  return {
    quantity,
    quantityMax,
    unit,
    name: line.replace(/\s+/g, " ").trim(),
    preparation,
    optional,
  };
}

/* ------------------------------------------------------------------ */
/* Conversion                                                          */
/* ------------------------------------------------------------------ */

export type UnitSystem = "original" | "metric" | "us";

const ML: Partial<Record<UnitCode, number>> = {
  ml: 1, cl: 10, dl: 100, l: 1000, tsp: 4.92892, tbsp: 14.7868, cup: 236.588, fl_oz: 29.5735,
};
const GRAMS: Partial<Record<UnitCode, number>> = { mg: 0.001, g: 1, kg: 1000, oz: 28.3495, lb: 453.592 };

export type Amount = { quantity: number | null; quantityMax: number | null; unit: UnitCode | null };

function scaleAmount(a: Amount, factor: number): Amount {
  return {
    unit: a.unit,
    quantity: a.quantity === null ? null : a.quantity * factor,
    quantityMax: a.quantityMax === null ? null : a.quantityMax * factor,
  };
}

function pickMetric(base: number, kind: "ml" | "g"): { unit: UnitCode; factor: number } {
  if (kind === "ml") return base >= 1000 ? { unit: "l", factor: 1000 } : { unit: "ml", factor: 1 };
  return base >= 1000 ? { unit: "kg", factor: 1000 } : { unit: "g", factor: 1 };
}

function pickUs(base: number, kind: "ml" | "g"): { unit: UnitCode; factor: number } {
  if (kind === "g") return base >= 453.592 ? { unit: "lb", factor: GRAMS.lb! } : { unit: "oz", factor: GRAMS.oz! };
  if (base >= 59) return { unit: "cup", factor: ML.cup! };
  if (base >= 14) return { unit: "tbsp", factor: ML.tbsp! };
  return { unit: "tsp", factor: ML.tsp! };
}

/** Converts between metric and US units. Spoons stay spoons in metric: every kitchen has them. */
export function convertAmount(a: Amount, system: UnitSystem): Amount {
  if (system === "original" || a.unit === null || a.quantity === null) return a;
  const unit = a.unit;
  const kind = ML[unit] !== undefined ? "ml" : GRAMS[unit] !== undefined ? "g" : null;
  if (!kind) return a;
  if (system === "metric" && (unit === "tsp" || unit === "tbsp")) return a;
  if (system === "metric" && ["ml", "cl", "dl", "l", "mg", "g", "kg"].includes(unit)) {
    // Normalise cl/dl to ml so the page reads consistently.
    if (unit === "cl" || unit === "dl") {
      const per = ML[unit]!;
      return { unit: "ml", quantity: a.quantity * per, quantityMax: a.quantityMax === null ? null : a.quantityMax * per };
    }
    return a;
  }
  if (system === "us" && ["tsp", "tbsp", "cup", "fl_oz", "oz", "lb"].includes(unit)) return a;
  const per = kind === "ml" ? ML[unit]! : GRAMS[unit]!;
  const base = a.quantity * per;
  const target = system === "metric" ? pickMetric(base, kind) : pickUs(base, kind);
  return {
    unit: target.unit,
    quantity: base / target.factor,
    quantityMax: a.quantityMax === null ? null : (a.quantityMax * per) / target.factor,
  };
}

export function transformAmount(a: Amount, factor: number, system: UnitSystem): Amount {
  return convertAmount(scaleAmount(a, factor), system);
}

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

const FRACTIONS: Array<[number, string]> = [
  [1 / 8, "⅛"], [1 / 4, "¼"], [1 / 3, "⅓"], [3 / 8, "⅜"], [1 / 2, "½"],
  [5 / 8, "⅝"], [2 / 3, "⅔"], [3 / 4, "¾"], [7 / 8, "⅞"],
];

const FRACTION_UNITS = new Set<UnitCode | null>([
  null, "tsp", "tbsp", "cup", "fl_oz", "oz", "lb", "pinch", "dash", "clove", "slice", "can", "bunch",
  "sprig", "piece", "packet", "stick",
]);

function formatFraction(n: number): string | null {
  const whole = Math.floor(n + 1e-9);
  const frac = n - whole;
  if (frac < 0.06) return String(whole);
  if (frac > 0.94) return String(whole + 1);
  let best: [number, string] = FRACTIONS[0];
  for (const f of FRACTIONS) if (Math.abs(f[0] - frac) < Math.abs(best[0] - frac)) best = f;
  if (Math.abs(best[0] - frac) > 0.05) return null;
  return whole === 0 ? best[1] : `${whole}${best[1]}`;
}

function formatDecimal(n: number, lang: Language): string {
  let rounded: number;
  if (n >= 100) rounded = Math.round(n / 5) * 5;
  else if (n >= 10) rounded = Math.round(n);
  else rounded = Math.round(n * 10) / 10;
  const s = String(rounded);
  return lang === "fr" ? s.replace(".", ",") : s;
}

export function formatNumber(n: number, unit: UnitCode | null, lang: Language): string {
  if (FRACTION_UNITS.has(unit)) {
    const f = formatFraction(n);
    if (f !== null) return f;
  }
  return formatDecimal(n, lang);
}

type Label = { one: string; many: string };
const UNIT_LABELS: Record<Language, Partial<Record<UnitCode, Label>>> = {
  en: {
    tsp: { one: "tsp", many: "tsp" },
    tbsp: { one: "tbsp", many: "tbsp" },
    cup: { one: "cup", many: "cups" },
    fl_oz: { one: "fl oz", many: "fl oz" },
    pinch: { one: "pinch", many: "pinches" },
    dash: { one: "dash", many: "dashes" },
    clove: { one: "clove", many: "cloves" },
    slice: { one: "slice", many: "slices" },
    can: { one: "can", many: "cans" },
    bunch: { one: "bunch", many: "bunches" },
    sprig: { one: "sprig", many: "sprigs" },
    piece: { one: "piece", many: "pieces" },
    packet: { one: "packet", many: "packets" },
    stick: { one: "stick", many: "sticks" },
  },
  fr: {
    tsp: { one: "c. à café", many: "c. à café" },
    tbsp: { one: "c. à soupe", many: "c. à soupe" },
    cup: { one: "tasse", many: "tasses" },
    fl_oz: { one: "fl oz", many: "fl oz" },
    oz: { one: "oz", many: "oz" },
    lb: { one: "livre", many: "livres" },
    pinch: { one: "pincée", many: "pincées" },
    dash: { one: "trait", many: "traits" },
    clove: { one: "gousse", many: "gousses" },
    slice: { one: "tranche", many: "tranches" },
    can: { one: "boîte", many: "boîtes" },
    bunch: { one: "botte", many: "bottes" },
    sprig: { one: "brin", many: "brins" },
    piece: { one: "pièce", many: "pièces" },
    packet: { one: "sachet", many: "sachets" },
    stick: { one: "bâton", many: "bâtons" },
  },
};

export function unitLabel(unit: UnitCode, quantity: number | null, lang: Language): string {
  const label = UNIT_LABELS[lang][unit];
  if (!label) return unit === "fl_oz" ? "fl oz" : unit;
  return quantity !== null && quantity > 1 ? label.many : label.one;
}

/** "200 g", "1½ cups", "2–3", "1 pincée". Returns "" when there is no quantity. */
export function formatAmount(a: Amount, lang: Language): string {
  if (a.quantity === null) return a.unit ? unitLabel(a.unit, null, lang) : "";
  let q = formatNumber(a.quantity, a.unit, lang);
  if (a.quantityMax !== null && a.quantityMax !== a.quantity) {
    q += `–${formatNumber(a.quantityMax, a.unit, lang)}`;
  }
  if (!a.unit) return q;
  const label = unitLabel(a.unit, a.quantityMax ?? a.quantity, lang);
  return `${q} ${label}`;
}

export function formatMinutes(min: number | null): string | null {
  if (min === null || min <= 0) return null;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${String(m).padStart(2, "0")}`;
}
