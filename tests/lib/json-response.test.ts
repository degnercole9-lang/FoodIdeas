import { describe, expect, it } from "vitest";

import {
  extractJsonFromText,
  parseJsonFromText,
} from "../../lib/json-response";

describe("json response parsing", () => {
  it("extracts json from fenced blocks", () => {
    const output = '```json\n{"value":1}\n```';
    expect(extractJsonFromText(output)).toBe('{"value":1}');
  });

  it("extracts json from plain text response", () => {
    const output = 'Model output {"value":2} trailing';
    expect(extractJsonFromText(output)).toBe('{"value":2}');
  });

  it("throws when parse target has no json", () => {
    expect(() => parseJsonFromText("no structured content")).toThrow(
      "No JSON object found in model output.",
    );
  });
});
