const stableFallbackModels = [
  "claude-haiku-4-5-20251001",
  "claude-3-5-haiku-20241022",
  "claude-3-haiku-20240307",
] as const;

function sanitizeModel(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function getAnthropicModelCandidates(
  configuredModel?: string,
): string[] {
  const configured = sanitizeModel(configuredModel);
  const candidates = configured
    ? [configured, ...stableFallbackModels]
    : [...stableFallbackModels];
  return [...new Set(candidates)];
}

export function isAnthropicModelNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const record = error as {
    status?: number;
    error?: {
      type?: string;
      message?: string;
    };
    message?: string;
  };

  const message = [
    typeof record.message === "string" ? record.message : "",
    typeof record.error?.message === "string" ? record.error.message : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    record.status === 404 ||
    record.error?.type === "not_found_error" ||
    /model:.*not\s*found/i.test(message)
  );
}
