import "server-only";

import Anthropic from "@anthropic-ai/sdk";

const defaultModel = "claude-3-5-haiku-latest";
const apiKeyEnvNames = [
  "ANTHROPIC_API_KEY",
  // Common typo fallback to reduce preview setup failures.
  "ATHNROPIC_API_KEY",
  // Optional fallback if entered as a public-prefixed key in preview config.
  "NEXT_PUBLIC_ANTHROPIC_API_KEY",
] as const;

function readAnthropicApiKey(): string | null {
  for (const envName of apiKeyEnvNames) {
    const value = process.env[envName];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

export function getAnthropicClient(): Anthropic {
  const apiKey = readAnthropicApiKey();
  if (!apiKey) {
    throw new Error(
      "Missing Anthropic API key. Set ANTHROPIC_API_KEY (or ATHNROPIC_API_KEY in existing preview configs).",
    );
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
