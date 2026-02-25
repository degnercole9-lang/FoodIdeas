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

function sanitizeApiKey(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readAnthropicApiKeyFromEnv(): string | null {
  for (const envName of apiKeyEnvNames) {
    const value = sanitizeApiKey(process.env[envName]);
    if (value) {
      return value;
    }
  }
  return null;
}

function readAnthropicApiKey(requestApiKey?: string | null): string | null {
  const override = sanitizeApiKey(requestApiKey);
  if (override) {
    return override;
  }
  return readAnthropicApiKeyFromEnv();
}

export function getAnthropicClient(options?: {
  requestApiKey?: string | null;
}): Anthropic {
  const apiKey = readAnthropicApiKey(options?.requestApiKey);
  if (!apiKey) {
    throw new Error(
      "Missing Anthropic API key. Set ANTHROPIC_API_KEY (or provide key in preview input).",
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
