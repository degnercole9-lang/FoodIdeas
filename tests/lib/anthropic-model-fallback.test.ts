import { describe, expect, it } from "vitest";

import {
  getAnthropicModelCandidates,
  isAnthropicModelNotFoundError,
} from "../../lib/server/anthropic-model-fallback";

describe("anthropic model fallback", () => {
  it("prefers configured model and appends stable fallbacks without duplicates", () => {
    expect(getAnthropicModelCandidates("claude-3-haiku-20240307")).toEqual([
      "claude-3-haiku-20240307",
      "claude-haiku-4-5-20251001",
      "claude-3-5-haiku-20241022",
    ]);
  });

  it("uses stable fallback list when model is not configured", () => {
    expect(getAnthropicModelCandidates(undefined)).toEqual([
      "claude-haiku-4-5-20251001",
      "claude-3-5-haiku-20241022",
      "claude-3-haiku-20240307",
    ]);
  });

  it("detects model-not-found errors from anthropic payloads", () => {
    const error = {
      status: 404,
      error: {
        type: "not_found_error",
        message: "model: claude-3-5-haiku-latest not found",
      },
    };
    expect(isAnthropicModelNotFoundError(error)).toBe(true);
  });
});
