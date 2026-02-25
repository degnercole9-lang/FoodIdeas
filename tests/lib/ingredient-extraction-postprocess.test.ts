import { describe, expect, it } from "vitest";
import {
  applyIngredientVerifications,
  filterIngredientCandidates,
} from "../../lib/ingredient-extraction-postprocess";
import type { Ingredient, IngredientVerification } from "../../lib/meal-models";

function ingredient(
  name: string,
  confidence: number,
  extra?: Partial<Ingredient>,
): Ingredient {
  return {
    id: name.toLowerCase().replace(/\s+/g, "-"),
    name,
    confidence,
    ...extra,
  };
}

describe("ingredient extraction postprocess", () => {
  it("drops low-confidence and generic labels", () => {
    const result = filterIngredientCandidates([
      ingredient("egg", 0.91),
      ingredient("red cabbage", 0.41),
      ingredient("food", 0.99),
    ]);

    expect(result.ingredients.map((item) => item.name)).toEqual(["egg"]);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("keeps strongest duplicate candidate", () => {
    const result = filterIngredientCandidates([
      ingredient("tomato", 0.65),
      ingredient("tomato", 0.88, { quantity: 3, unit: "count" }),
    ]);

    expect(result.ingredients).toHaveLength(1);
    expect(result.ingredients[0]?.confidence).toBe(0.88);
    expect(result.ingredients[0]?.quantity).toBe(3);
  });

  it("removes items rejected in verification pass", () => {
    const candidates = [
      ingredient("egg", 0.9),
      ingredient("red cabbage", 0.86),
    ];
    const verifications: IngredientVerification[] = [
      { id: "egg", visible: true, confidence: 0.88 },
      {
        id: "red-cabbage",
        visible: false,
        confidence: 0.15,
        reason: "no visible cabbage leaves",
      },
    ];

    const result = applyIngredientVerifications(candidates, verifications);

    expect(result.ingredients.map((item) => item.name)).toEqual(["egg"]);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
