import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import {
  getAnthropicModelCandidates,
  isAnthropicModelNotFoundError,
} from "@/lib/server/anthropic-model-fallback";

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

export function getAnthropicEnvKeyStatus(): {
  hasKey: boolean;
  source: string | null;
} {
  for (const envName of apiKeyEnvNames) {
    const value = sanitizeApiKey(process.env[envName]);
    if (value) {
      return { hasKey: true, source: envName };
    }
  }
  return { hasKey: false, source: null };
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
  const [firstCandidate] = getAnthropicModelCandidates(
    process.env.ANTHROPIC_MODEL,
  );
  return firstCandidate;
}

export async function createMessageWithModelFallback(
  client: Anthropic,
  params: Omit<Anthropic.MessageCreateParamsNonStreaming, "model">,
): Promise<Anthropic.Message> {
  const candidates = getAnthropicModelCandidates(process.env.ANTHROPIC_MODEL);
  let lastModelError: unknown = null;

  for (const model of candidates) {
    try {
      return await client.messages.create({
        ...params,
        model,
      });
    } catch (error) {
      if (isAnthropicModelNotFoundError(error)) {
        lastModelError = error;
        continue;
      }
      throw error;
    }
  }

  const attemptedModels = candidates.join(", ");
  const reason =
    lastModelError instanceof Error
      ? lastModelError.message
      : "All candidate models were rejected.";
  throw new Error(
    `No compatible Anthropic model found for this API key. Tried: ${attemptedModels}. Set ANTHROPIC_MODEL to a model available in your Anthropic account. Last error: ${reason}`,
  );
}

export function toBase64(arrayBuffer: ArrayBuffer): string {
  return Buffer.from(arrayBuffer).toString("base64");
}
