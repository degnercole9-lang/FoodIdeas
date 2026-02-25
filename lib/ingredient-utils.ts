import type { Ingredient } from "@/lib/meal-models";

export function toKebabCase(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function normalizeIngredient(
  ingredient: Partial<Ingredient>,
): Ingredient {
  const baseName = (ingredient.name ?? "unknown").trim() || "unknown";
  const id = toKebabCase(ingredient.id ?? ingredient.name ?? "ingredient");

  return {
    id: id || crypto.randomUUID(),
    name: baseName,
    quantity: ingredient.quantity,
    unit: ingredient.unit,
    confidence: ingredient.confidence,
    evidence: ingredient.evidence,
    sourceImageIndex: ingredient.sourceImageIndex,
  };
}
