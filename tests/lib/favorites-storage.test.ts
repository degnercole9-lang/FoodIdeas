import { describe, expect, it } from "vitest";

import {
  removeFavoriteById,
  upsertFavorite,
} from "../../lib/favorites-storage";
import type { Recipe } from "../../lib/meal-models";

function recipe(id: string, title: string): Recipe {
  return {
    id,
    title,
    summary: `${title} summary`,
    ingredients: ["1 egg"],
    steps: ["Cook"],
    usesIngredients: ["egg"],
    missingIngredients: [],
  };
}

describe("favorites storage helpers", () => {
  it("adds recipe only once", () => {
    const base = [recipe("a", "Recipe A")];
    const once = upsertFavorite(base, recipe("b", "Recipe B"));
    const twice = upsertFavorite(once, recipe("b", "Recipe B"));

    expect(once).toHaveLength(2);
    expect(twice).toHaveLength(2);
    expect(twice[0].id).toBe("b");
  });

  it("removes recipe by id", () => {
    const base = [recipe("a", "Recipe A"), recipe("b", "Recipe B")];
    const result = removeFavoriteById(base, "a");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("b");
  });
});
