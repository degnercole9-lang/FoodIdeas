import type { Recipe } from "@/lib/meal-models";

const favoritesKey = "foodideas:favorites:v1";

export function readFavorites(): Recipe[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(favoritesKey);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as Recipe[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeFavorites(favorites: Recipe[]) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(favoritesKey, JSON.stringify(favorites));
}

export function upsertFavorite(favorites: Recipe[], recipe: Recipe): Recipe[] {
  const existing = favorites.find((item) => item.id === recipe.id);
  if (existing) {
    return favorites;
  }
  return [recipe, ...favorites];
}

export function removeFavoriteById(
  favorites: Recipe[],
  recipeId: string,
): Recipe[] {
  return favorites.filter((item) => item.id !== recipeId);
}
