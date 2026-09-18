import he from "he";

export function cleanText(value: unknown): string {
  if (typeof value !== "string") return "";
  return he.decode(value.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

export function safeHttpUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}
