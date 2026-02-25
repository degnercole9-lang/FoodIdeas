export function extractJsonFromText(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    return fenced[1];
  }

  const startIndex = text.indexOf("{");
  const endIndex = text.lastIndexOf("}");
  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    return null;
  }

  return text.slice(startIndex, endIndex + 1);
}

export function parseJsonFromText<T>(text: string): T {
  const json = extractJsonFromText(text);
  if (!json) {
    throw new Error("No JSON object found in model output.");
  }
  return JSON.parse(json) as T;
}
