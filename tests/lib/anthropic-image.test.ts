import { describe, expect, it } from "vitest";

import { fileToAnthropicImage } from "../../lib/server/anthropic-image";

describe("anthropic image payload", () => {
  it("does not include unsupported name field", () => {
    const block = fileToAnthropicImage("image/jpeg", "abcd");

    expect(block).toMatchObject({
      type: "image",
      source: {
        type: "base64",
        media_type: "image/jpeg",
        data: "abcd",
      },
    });
    expect("name" in block).toBe(false);
  });
});
