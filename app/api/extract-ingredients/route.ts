import { NextResponse } from "next/server";

import { normalizeIngredient } from "@/lib/ingredient-utils";
import { parseJsonFromText } from "@/lib/json-response";
import {
  type ExtractIngredientsResponse,
  extractIngredientsResponseSchema,
} from "@/lib/meal-models";
import {
  fileToAnthropicImage,
  getAnthropicClient,
  getAnthropicModel,
  toBase64,
} from "@/lib/server/anthropic-client";
import { ingredientExtractionPrompt } from "@/lib/server/prompts";

const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxImageCount = 3;
const maxImageBytes = 6 * 1024 * 1024;

export async function POST(request: Request) {
  try {
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
          fileToAnthropicImage(file.name, file.type, base64Data),
        ];
      }),
    );

    const client = getAnthropicClient();
    const completion = await client.messages.create({
      model: getAnthropicModel(),
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

    const response = {
      ...parsed.data,
      ingredients: parsed.data.ingredients.map((ingredient) =>
        normalizeIngredient(ingredient),
      ),
    };

    return NextResponse.json(response);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown extraction error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
