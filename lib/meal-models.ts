import { z } from "zod";

export const ingredientSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  quantity: z.number().positive().optional(),
  unit: z.string().min(1).optional(),
  confidence: z.number().min(0).max(1).optional(),
  evidence: z.string().min(1).optional(),
  sourceImageIndex: z.number().int().min(0).optional(),
});

export const recipeSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  totalMinutes: z.number().int().positive().optional(),
  servings: z.number().int().positive().optional(),
  ingredients: z.array(z.string().min(1)).min(1),
  steps: z.array(z.string().min(1)).min(1),
  usesIngredients: z.array(z.string().min(1)).default([]),
  missingIngredients: z.array(z.string().min(1)).default([]),
});

export const extractIngredientsResponseSchema = z.object({
  ingredients: z.array(ingredientSchema).default([]),
  warnings: z.array(z.string()).default([]),
});

export const generateRecipesResponseSchema = z.object({
  recipes: z.array(recipeSchema).min(1),
  warnings: z.array(z.string()).default([]),
});

export const generateRecipesRequestSchema = z.object({
  ingredients: z.array(ingredientSchema).min(1),
});

export const ingredientVerificationSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  visible: z.boolean(),
  confidence: z.number().min(0).max(1).optional(),
  reason: z.string().min(1).optional(),
});

export const verifyIngredientsResponseSchema = z.object({
  verifications: z.array(ingredientVerificationSchema).default([]),
  warnings: z.array(z.string()).default([]),
});

export type Ingredient = z.infer<typeof ingredientSchema>;
export type Recipe = z.infer<typeof recipeSchema>;
export type ExtractIngredientsResponse = z.infer<
  typeof extractIngredientsResponseSchema
>;
export type GenerateRecipesResponse = z.infer<
  typeof generateRecipesResponseSchema
>;
export type GenerateRecipesRequest = z.infer<
  typeof generateRecipesRequestSchema
>;
export type IngredientVerification = z.infer<
  typeof ingredientVerificationSchema
>;
export type VerifyIngredientsResponse = z.infer<
  typeof verifyIngredientsResponseSchema
>;
