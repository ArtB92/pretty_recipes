import { describe, expect, it } from "vitest";
import { convertAmount, formatAmount, parseIngredientLine, parseNumber, parseUnit } from "@/lib/recipe/units";

describe("parseUnit", () => {
  it.each([
    ["c. à soupe", "tbsp"], ["càs", "tbsp"], ["cuillères à café", "tsp"], ["Tbsp", "tbsp"], ["T", "tbsp"],
    ["cl", "cl"], ["grammes", "g"], ["tasses", "cup"], ["pincée", "pinch"], ["gousses", "clove"], ["fl oz", "fl_oz"],
  ])("%s -> %s", (input, code) => expect(parseUnit(input)).toBe(code));

  it("returns null for unknown words", () => expect(parseUnit("handful")).toBeNull());
});

describe("parseNumber", () => {
  it.each([["1 1/2", 1.5], ["½", 0.5], ["2,5", 2.5], ["1½", 1.5], ["3/4", 0.75], ["12", 12]])(
    "%s -> %d",
    (input, n) => expect(parseNumber(input)).toBeCloseTo(n),
  );
});

describe("parseIngredientLine", () => {
  it("splits a French line with 'de'", () => {
    expect(parseIngredientLine("- 250 g de farine")).toMatchObject({ quantity: 250, unit: "g", name: "farine" });
  });
  it("handles elision and spoons", () => {
    expect(parseIngredientLine("2 c. à soupe d'huile d'olive")).toMatchObject({ quantity: 2, unit: "tbsp", name: "huile d'olive" });
  });
  it("handles glued units and preparation", () => {
    expect(parseIngredientLine("50g butter, melted")).toMatchObject({ quantity: 50, unit: "g", name: "butter", preparation: "melted" });
  });
  it("handles ranges", () => {
    expect(parseIngredientLine("2-3 large eggs")).toMatchObject({ quantity: 2, quantityMax: 3, unit: null, name: "large eggs" });
  });
  it("handles articles", () => {
    expect(parseIngredientLine("une pincée de sel")).toMatchObject({ quantity: 1, unit: "pinch", name: "sel" });
  });
  it("does not read a unit inside a word", () => {
    expect(parseIngredientLine("2 gousses d'ail")).toMatchObject({ unit: "clove", name: "ail" });
    expect(parseIngredientLine("3 tomatoes")).toMatchObject({ unit: null, name: "tomatoes" });
    expect(parseIngredientLine("2 large eggs")).toMatchObject({ unit: null, name: "large eggs" });
  });
  it("flags optional ingredients", () => {
    expect(parseIngredientLine("1 sachet de sucre vanillé (facultatif)")).toMatchObject({ optional: true, unit: "packet", name: "sucre vanillé" });
  });
});

describe("conversion and formatting", () => {
  it("converts cups to ml", () => {
    const a = convertAmount({ quantity: 1, quantityMax: null, unit: "cup" }, "metric");
    expect(a.unit).toBe("ml");
    expect(a.quantity).toBeCloseTo(236.6, 0);
    expect(formatAmount(a, "en")).toBe("235 ml");
  });
  it("converts grams to ounces", () => {
    expect(formatAmount(convertAmount({ quantity: 115, quantityMax: null, unit: "g" }, "us"), "en")).toBe("4 oz");
  });
  it("keeps spoons in metric", () => {
    expect(convertAmount({ quantity: 2, quantityMax: null, unit: "tbsp" }, "metric").unit).toBe("tbsp");
  });
  it("formats French decimals and labels", () => {
    expect(formatAmount({ quantity: 2.5, quantityMax: null, unit: "g" }, "fr")).toBe("2,5 g");
    expect(formatAmount({ quantity: 2, quantityMax: null, unit: "tbsp" }, "fr")).toBe("2 c. à soupe");
  });
  it("formats fractions for cups", () => {
    expect(formatAmount({ quantity: 1.5, quantityMax: null, unit: "cup" }, "en")).toBe("1½ cups");
    expect(formatAmount({ quantity: 2, quantityMax: 3, unit: null }, "en")).toBe("2–3");
  });
});
