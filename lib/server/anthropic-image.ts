export function fileToAnthropicImage(mediaType: string, base64Data: string) {
  return {
    type: "image" as const,
    source: {
      type: "base64" as const,
      media_type: mediaType as "image/jpeg" | "image/png" | "image/webp",
      data: base64Data,
    },
  };
}
