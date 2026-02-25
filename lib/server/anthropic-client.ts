import "server-only";

import Anthropic from "@anthropic-ai/sdk";

const defaultModel = "claude-3-5-sonnet-latest";

export function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("Missing ANTHROPIC_API_KEY.");
  }
  return new Anthropic({ apiKey });
}

export function getAnthropicModel(): string {
  return process.env.ANTHROPIC_MODEL ?? defaultModel;
}

export function fileToAnthropicImage(
  fileName: string,
  mediaType: string,
  base64Data: string,
) {
  return {
    type: "image" as const,
    source: {
      type: "base64" as const,
      media_type: mediaType as "image/jpeg" | "image/png" | "image/webp",
      data: base64Data,
    },
    name: fileName,
  };
}

export function toBase64(arrayBuffer: ArrayBuffer): string {
  return Buffer.from(arrayBuffer).toString("base64");
}
