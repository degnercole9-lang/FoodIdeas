import { NextResponse } from "next/server";

import {
  applyIngredientVerifications,
  filterIngredientCandidates,
} from "@/lib/ingredient-extraction-postprocess";
import { normalizeIngredient } from "@/lib/ingredient-utils";
import { parseJsonFromText } from "@/lib/json-response";
import {
  type ExtractIngredientsResponse,
  extractIngredientsResponseSchema,
  type VerifyIngredientsResponse,
  verifyIngredientsResponseSchema,
} from "@/lib/meal-models";
import {
  createMessageWithModelFallback,
  getAnthropicClient,
  toBase64,
} from "@/lib/server/anthropic-client";
import { fileToAnthropicImage } from "@/lib/server/anthropic-image";
import {
  ingredientExtractionPrompt,
  ingredientVerificationPrompt,
} from "@/lib/server/prompts";

const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxImageCount = 3;
const maxImageBytes = 6 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const requestApiKey = request.headers.get("x-anthropic-api-key");
    const formData = await request.formData();
    const imageCandidates = formData.getAll("images");

    const files = imageCandidates.filter(
      (value): value is File => value instanceof File,
    );
    if (files.length === 0) {
      return NextResponse.json(
        { error: "No images provided." },
        { status: 400 },
      );
    }
    if (files.length > maxImageCount) {
      return NextResponse.json(
        { error: `Maximum ${maxImageCount} images allowed.` },
        { status: 400 },
      );
    }

    for (const file of files) {
      if (!allowedMimeTypes.has(file.type)) {
        return NextResponse.json(
          {
            error:
              "Unsupported image format. Use JPEG, PNG, or WEBP after preprocessing.",
          },
          { status: 400 },
        );
      }
      if (file.size > maxImageBytes) {
        return NextResponse.json(
          {
            error: `Image exceeds ${Math.round(maxImageBytes / (1024 * 1024))}MB limit.`,
          },
          { status: 400 },
        );
      }
    }

    const imageBlocks = await Promise.all(
      files.map(async (file, index) => {
        const base64Data = toBase64(await file.arrayBuffer());
        return [
          { type: "text" as const, text: `Image ${index + 1}` },
          fileToAnthropicImage(file.type, base64Data),
        ];
      }),
    );

    const client = getAnthropicClient({ requestApiKey });
    const completion = await createMessageWithModelFallback(client, {
      max_tokens: 1200,
      temperature: 0.1,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: ingredientExtractionPrompt },
            ...imageBlocks.flat(),
          ],
        },
      ],
    });

    const modelText = completion.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    const rawJson = parseJsonFromText<ExtractIngredientsResponse>(modelText);
    const parsed = extractIngredientsResponseSchema.safeParse(rawJson);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Model response schema validation failed." },
        { status: 502 },
      );
    }

    const normalizedIngredients = parsed.data.ingredients.map((ingredient) =>
      normalizeIngredient(ingredient),
    );
    const filtered = filterIngredientCandidates(normalizedIngredients);
    let finalIngredients = filtered.ingredients;
    const verificationWarnings: string[] = [];

    if (filtered.ingredients.length > 0) {
      const verificationCompletion = await createMessageWithModelFallback(
        client,
        {
          max_tokens: 900,
          temperature: 0,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: ingredientVerificationPrompt(
                    filtered.ingredients.map((ingredient) => ({
                      id: ingredient.id,
                      name: ingredient.name,
                    })),
                  ),
                },
                ...imageBlocks.flat(),
              ],
            },
          ],
        },
      );

      const verificationText = verificationCompletion.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("\n");
      const verificationRaw =
        parseJsonFromText<VerifyIngredientsResponse>(verificationText);
      const parsedVerification =
        verifyIngredientsResponseSchema.safeParse(verificationRaw);
      if (parsedVerification.success) {
        const verified = applyIngredientVerifications(
          filtered.ingredients,
          parsedVerification.data.verifications,
        );
        finalIngredients = verified.ingredients;
        verificationWarnings.push(
          ...parsedVerification.data.warnings,
          ...verified.warnings,
        );
      } else {
        verificationWarnings.push(
          "Verification pass returned invalid format; using primary detections.",
        );
      }
    }

    const response = {
      ...parsed.data,
      ingredients: finalIngredients.map((ingredient) =>
        normalizeIngredient(ingredient),
      ),
      warnings: [
        ...parsed.data.warnings,
        ...filtered.warnings,
        ...verificationWarnings,
      ],
    };

    return NextResponse.json(response);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown extraction error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
