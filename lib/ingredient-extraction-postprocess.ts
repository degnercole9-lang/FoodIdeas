import { toKebabCase } from "./ingredient-utils";
import type { Ingredient, IngredientVerification } from "./meal-models";

const DEFAULT_CONFIDENCE = 0.5;
const MIN_CANDIDATE_CONFIDENCE = 0.58;
const MIN_VERIFIED_CONFIDENCE = 0.62;

const genericNames = new Set([
  "food",
  "ingredient",
  "produce",
  "vegetable",
  "fruit",
  "item",
  "unknown",
  "container",
  "package",
  "bottle",
  "jar",
  "can",
  "person",
  "face",
  "human",
]);

function readConfidence(value: number | undefined): number {
  return typeof value === "number" ? value : DEFAULT_CONFIDENCE;
}

function isGenericIngredientName(name: string): boolean {
  const normalized = name.trim().toLowerCase();
  return genericNames.has(normalized);
}

export function filterIngredientCandidates(
  ingredients: Ingredient[],
  minConfidence = MIN_CANDIDATE_CONFIDENCE,
): {
  ingredients: Ingredient[];
  warnings: string[];
} {
  const warnings: string[] = [];
  let removedLowConfidence = 0;
  let removedGeneric = 0;
  const bestById = new Map<string, Ingredient>();

  for (const ingredient of ingredients) {
    const name = ingredient.name.trim();
    if (!name) {
      continue;
    }
    if (isGenericIngredientName(name)) {
      removedGeneric += 1;
      continue;
    }

    const confidence = readConfidence(ingredient.confidence);
    if (confidence < minConfidence) {
      removedLowConfidence += 1;
      continue;
    }

    const canonicalId = toKebabCase(ingredient.id || name);
    const current = bestById.get(canonicalId);
    if (!current) {
      bestById.set(canonicalId, {
        ...ingredient,
        id: canonicalId,
        confidence,
      });
      continue;
    }

    const currentConfidence = readConfidence(current.confidence);
    if (confidence > currentConfidence) {
      bestById.set(canonicalId, {
        ...ingredient,
        id: canonicalId,
        confidence,
        quantity: ingredient.quantity ?? current.quantity,
        unit: ingredient.unit ?? current.unit,
      });
    }
  }

  if (removedLowConfidence > 0) {
    warnings.push(
      `Dropped ${removedLowConfidence} low-confidence ingredient detection(s).`,
    );
  }
  if (removedGeneric > 0) {
    warnings.push(
      `Dropped ${removedGeneric} non-specific ingredient label(s).`,
    );
  }

  return {
    ingredients: [...bestById.values()].sort(
      (a, b) => readConfidence(b.confidence) - readConfidence(a.confidence),
    ),
    warnings,
  };
}

export function applyIngredientVerifications(
  candidates: Ingredient[],
  verifications: IngredientVerification[],
  minVerifiedConfidence = MIN_VERIFIED_CONFIDENCE,
): {
  ingredients: Ingredient[];
  warnings: string[];
} {
  const verificationById = new Map<string, IngredientVerification>();
  for (const verification of verifications) {
    const key = toKebabCase(verification.id ?? verification.name ?? "");
    if (key) {
      verificationById.set(key, verification);
    }
  }

  const warnings: string[] = [];
  const kept: Ingredient[] = [];
  let removedByVerification = 0;

  for (const candidate of candidates) {
    const key = toKebabCase(candidate.id || candidate.name);
    const verification = verificationById.get(key);
    const candidateConfidence = readConfidence(candidate.confidence);

    if (!verification) {
      kept.push(candidate);
      continue;
    }

    const verificationConfidence = readConfidence(verification.confidence);
    const mergedConfidence = Math.min(
      candidateConfidence,
      verificationConfidence,
    );
    if (!verification.visible || mergedConfidence < minVerifiedConfidence) {
      removedByVerification += 1;
      continue;
    }

    kept.push({
      ...candidate,
      confidence: mergedConfidence,
      evidence: verification.reason ?? candidate.evidence,
    });
  }

  if (removedByVerification > 0) {
    warnings.push(
      `Removed ${removedByVerification} ingredient(s) after visual verification.`,
    );
  }

  return { ingredients: kept, warnings };
}
