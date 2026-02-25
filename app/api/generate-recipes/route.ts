import { NextResponse } from "next/server";

import { parseJsonFromText } from "@/lib/json-response";
import {
  type GenerateRecipesResponse,
  generateRecipesRequestSchema,
  generateRecipesResponseSchema,
} from "@/lib/meal-models";
import {
  getAnthropicClient,
  getAnthropicModel,
} from "@/lib/server/anthropic-client";
import { recipeGenerationPrompt } from "@/lib/server/prompts";

export async function POST(request: Request) {
  try {
    const requestApiKey = request.headers.get("x-anthropic-api-key");
    const payload = await request.json();
    const parsedRequest = generateRecipesRequestSchema.safeParse(payload);
    if (!parsedRequest.success) {
      return NextResponse.json(
        { error: "Invalid recipe request payload." },
        { status: 400 },
      );
    }

    const client = getAnthropicClient({ requestApiKey });
    const completion = await client.messages.create({
      model: getAnthropicModel(),
      max_tokens: 1800,
      temperature: 0.3,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: recipeGenerationPrompt },
            {
              type: "text",
              text: `Ingredients JSON:\n${JSON.stringify(parsedRequest.data.ingredients)}`,
            },
          ],
        },
      ],
    });

    const modelText = completion.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    const rawJson = parseJsonFromText<GenerateRecipesResponse>(modelText);
    const parsedResponse = generateRecipesResponseSchema.safeParse(rawJson);
    if (!parsedResponse.success) {
      return NextResponse.json(
        { error: "Recipe response schema validation failed." },
        { status: 502 },
      );
    }

    return NextResponse.json(parsedResponse.data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown recipe error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
