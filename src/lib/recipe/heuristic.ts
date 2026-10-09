import type { DraftRecipe } from "./draft";
import { detectLanguage } from "./normalize";
import { fold, parseIngredientLine } from "./units";

/**
 * Rule-based parser used when no AI provider is configured, and as a safety net when the
 * provider is down. It handles well-structured French and English text; social captions with
 * no headings come out rougher, which the review step shows.
 */

const H_INGREDIENTS = /^(?:ingr[eé]dients?|what you(?:'|’)?ll need|you(?:'|’)?ll need|liste de courses|il vous faut)\b/i;
const H_STEPS = /^(?:pr[eé]paration|instructions?|directions?|m[eé]thode|method|steps?|[eé]tapes?|d[eé]roul[eé]|recette|how to make(?: it)?|to make)\b/i;
const H_NOTES = /^(?:notes?|tips?|astuces?|conseils?|storage|conservation)\b/i;

const QUANTITY_START = /^\s*(?:\d|[½¼¾⅓⅔⅛]|(?:une?|a|an)\s+(?:pinc[eé]e|pinch|filet|trait|dash|gousse|clove|bo[iî]te|can|sachet|packet|botte|bunch)\b)/i;
const STEP_NUMBER = /^\s*(?:(?:[ée]tape|step)\s*)?\d{1,2}\s*[.):\-–]\s*/i;
/** "Pour 4 personnes", "Cuisson : 20 min": facts, not a description. */
const META_LINE = /^(?:pour|serves?|makes?|portions?|pr[eé]paration|prep|cuisson|cook|repos|rest|temps|time|total)\b|\d+\s*(?:min|h\b|personnes|people|servings)/i;
const EMOJI = /[\p{Extended_Pictographic}️‍⃣]/gu;

function stripDecor(line: string): string {
  return line
    .replace(EMOJI, " ")
    .replace(/^[\s\-*•·▪◦‣>#=_~|]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function headerText(line: string): string {
  return stripDecor(line).replace(/[:：\-–—]+$/, "").trim();
}

/** A heading is the keyword alone ("Préparation :"), not a value line ("Préparation : 10 min"). */
function isHeading(re: RegExp, head: string, maxLength: number): boolean {
  const m = head.match(re);
  return Boolean(m) && head.length < maxLength && !/\d/.test(head.slice(m![0].length));
}

/** Drops social filler: "The BEST cookies 🍪 save this for later!!" -> "The BEST cookies". */
function cleanTitle(line: string): string {
  return line
    .replace(/\s*(?:[-–|:]\s*)?\b(?:save (?:this|it)|follow (?:me|for)|like (?:and|&) |recette en commentaire|recipe (?:below|in (?:the )?(?:comments|caption))|enregistre)\b.*$/i, "")
    .replace(/#\S+/g, "")
    .replace(/[!.\s]+$/, "")
    .trim();
}

function isHashtagLine(line: string): boolean {
  const words = line.trim().split(/\s+/);
  return words.length > 0 && words.every((w) => w.startsWith("#") || w.startsWith("@"));
}

function minutesNear(text: string, labels: RegExp): number | null {
  const re = new RegExp(`${labels.source}[^\\d\\n]{0,20}(\\d+)\\s*(h|heures?|hours?|hrs?|min|minutes?|mn)\\s*(\\d+)?`, "i");
  const m = text.match(re);
  if (!m) return null;
  const n = Number(m[1]);
  if (/^h/i.test(m[2])) return n * 60 + (m[3] ? Number(m[3]) : 0);
  return n;
}

function keyword(name: string): string | null {
  const words = fold(name)
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .split(/[^a-zœæ]+/)
    .filter((w) => w.length > 2 && !["de", "des", "du", "the", "and", "for", "aux", "pour", "avec", "large", "small", "petit", "petite", "gros", "grosse", "fresh", "frais", "fraiche"].includes(w));
  // The noun is usually first in French ("farine de blé") and last in English ("plain flour").
  return words.length ? words[0] : null;
}

function keywords(name: string): string[] {
  const all = fold(name).toLowerCase().split(/[^a-zœæ]+/).filter((w) => w.length > 3);
  const first = keyword(name);
  return Array.from(new Set([...(first ? [first] : []), ...all.reverse()]));
}

export function heuristicDraft(input: string): DraftRecipe {
  const text = input.replace(/\r\n?/g, "\n");
  const language = detectLanguage(text);
  const rawLines = text.split("\n").map((l) => l.trim()).filter((l) => l && !isHashtagLine(l));

  type Section = "intro" | "ingredients" | "steps" | "notes";
  let section: Section = "intro";
  let title = "";
  const intro: string[] = [];
  const groups: DraftRecipe["ingredientGroups"] = [{ name: null, items: [] }];
  const stepTexts: string[] = [];
  const notes: string[] = [];
  let sawHeaders = false;
  let ingredientId = 0;

  const addIngredient = (line: string) => {
    const p = parseIngredientLine(line);
    if (!p.name) return;
    groups[groups.length - 1].items.push({
      id: `i${++ingredientId}`,
      quantity: p.quantity,
      quantityMax: p.quantityMax,
      unit: p.unit,
      name: p.name,
      preparation: p.preparation,
      optional: p.optional,
      raw: stripDecor(line),
    });
  };

  for (const original of rawLines) {
    const line = stripDecor(original);
    if (!line) continue;
    const head = headerText(original);
    if (isHeading(H_INGREDIENTS, head, 40)) {
      section = "ingredients";
      sawHeaders = true;
      continue;
    }
    if (isHeading(H_STEPS, head, 40)) {
      section = "steps";
      sawHeaders = true;
      continue;
    }
    if (isHeading(H_NOTES, head, 30)) {
      section = "notes";
      sawHeaders = true;
      continue;
    }

    // "Astuce : …" on one line is a note wherever it appears.
    const inlineNote = line.match(/^(?:astuces?|tips?|notes?|conseils?)\s*[:：]\s*(\S.*)$/i);
    if (inlineNote) {
      notes.push(inlineNote[1]);
      continue;
    }

    if (section === "intro") {
      if (!title && line.length <= 80 && !QUANTITY_START.test(line)) {
        title = cleanTitle(line);
        continue;
      }
      if (!sawHeaders && QUANTITY_START.test(line) && !STEP_NUMBER.test(original)) {
        section = "ingredients";
      } else {
        intro.push(line);
        continue;
      }
    }

    if (section === "ingredients") {
      // "Pour la pâte :" / "For the icing:" starts a new group.
      if (/[:：]$/.test(line) && !QUANTITY_START.test(line) && line.length < 50) {
        const name = line.replace(/[:：]$/, "").trim();
        if (groups[groups.length - 1].items.length === 0) groups[groups.length - 1].name = name;
        else groups.push({ name, items: [] });
        continue;
      }
      if (!sawHeaders && (STEP_NUMBER.test(original) || (line.length > 70 && !QUANTITY_START.test(line)))) {
        section = "steps";
      } else {
        addIngredient(original);
        continue;
      }
    }

    if (section === "steps") {
      const stepText = line.replace(STEP_NUMBER, "").trim();
      if (stepText) stepTexts.push(stepText);
      continue;
    }

    notes.push(line);
  }

  const allIngredients = groups.flatMap((g) => g.items);
  const claimed = new Set<string>();
  const steps: DraftRecipe["steps"] = stepTexts.map((stepText, i) => {
    const folded = fold(stepText).toLowerCase();
    const uses: string[] = i > 0 ? [`s${i}`] : [];
    for (const ing of allIngredients) {
      if (claimed.has(ing.id)) continue;
      if (keywords(ing.name).some((k) => folded.includes(k))) {
        uses.push(ing.id);
        claimed.add(ing.id);
      }
    }
    const temp = stepText.match(/(\d{2,3})\s*°\s*([CF])?/i);
    const dur = stepText.match(/(\d+)\s*(?:-|à|to)?\s*(?:\d+\s*)?(min|minutes?|mn|h|heures?|hours?)\b/i);
    return {
      id: `s${i + 1}`,
      text: stepText,
      uses,
      action: null,
      durationMinutes: dur ? Number(dur[1]) * (/^h/i.test(dur[2]) ? 60 : 1) : null,
      temperature: temp ? Number(temp[1]) : null,
      temperatureUnit: temp?.[2] ? (temp[2].toUpperCase() as "C" | "F") : null,
    };
  });

  // "Serves 4" / "Makes 12" stand alone; "pour"/"for" need a unit, or "bake for 10 minutes" would count.
  const servingsMatch =
    text.match(/\b(?:serves?|makes?|donne|yield[s]?)\s*:?\s*(\d+)\s*([\p{L}]+)?/iu) ??
    text.match(/\b(?:pour|for)\s*:?\s*(\d+)\s*(personnes?|pers\.?|people|servings?|portions?|parts?)\b/i) ??
    text.match(/\b(\d+)\s*(personnes|people|servings|portions|parts)\b/i);
  const servingsLabel = servingsMatch?.[2] && !/^(minutes?|min|h|hours?|heures?)$/i.test(servingsMatch[2]) ? servingsMatch[2] : null;

  return {
    isRecipe: allIngredients.length > 0 || steps.length > 0,
    title,
    language,
    category: null,
    description: intro.find((l) => l.length < 200 && !META_LINE.test(l)) ?? null,
    servings: servingsMatch ? Number(servingsMatch[1]) : null,
    servingsLabel,
    prepMinutes: minutesNear(text, /(?:pr[eé]paration|prep(?:aration)?(?: time)?)/),
    cookMinutes: minutesNear(text, /(?:cuisson|cook(?:ing)?(?: time)?|bake)/),
    restMinutes: minutesNear(text, /(?:repos|rest(?:ing)?|chill)/),
    difficulty: null,
    ingredientGroups: groups.filter((g) => g.items.length > 0),
    steps,
    equipment: [],
    notes,
    tags: Array.from(text.matchAll(/#([\p{L}\p{N}_]+)/gu), (m) => m[1]).slice(0, 6),
    author: null,
    uncertain: ["title", "category", "servings"],
  };
}
