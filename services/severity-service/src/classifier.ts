import { GoogleGenerativeAI } from "@google/generative-ai";

export type Severity = "high" | "medium" | "low";
export type Category = "medical" | "fire" | "rescue" | "other";

export interface Classification {
  severity: Severity;
  category: Category;
}

const validSeverities = new Set<Severity>(["high", "medium", "low"]);
const validCategories = new Set<Category>(["medical", "fire", "rescue", "other"]);

export function fallbackClassify(description: string): Classification {
  const text = description.toLowerCase();
  if (["chest pain", "bleeding", "unconscious"].some((keyword) => text.includes(keyword))) {
    return { severity: "high", category: "medical" };
  }
  if (["fire", "smoke", "aag"].some((keyword) => text.includes(keyword))) {
    return { severity: "high", category: "fire" };
  }
  if (["stuck", "trapped"].some((keyword) => text.includes(keyword))) {
    return { severity: "medium", category: "rescue" };
  }
  return { severity: "low", category: "other" };
}

function stripJsonFences(value: string): string {
  return value.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/, "").trim();
}

function isClassification(value: unknown): value is Classification {
  if (!value || typeof value !== "object") return false;
  const result = value as Record<string, unknown>;
  return validSeverities.has(result.severity as Severity) && validCategories.has(result.category as Category);
}

export async function classify(description: string): Promise<Classification> {
  const apiKey = process.env.GEMINI_KEY;
  if (!apiKey) return fallbackClassify(description);

  try {
    const client = new GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = [
      "Classify this emergency. Respond with STRICT JSON only, no markdown, no extra text:",
      '{"severity":"high|medium|low","category":"medical|fire|rescue|other"}.',
      `Emergency text: ${JSON.stringify(description)}`
    ].join(" ");
    const result = await model.generateContent(prompt);
    const parsed: unknown = JSON.parse(stripJsonFences(result.response.text()));
    if (!isClassification(parsed)) throw new Error("Gemini returned an invalid classification");
    return parsed;
  } catch (error) {
    console.error("Gemini classification failed; using keyword fallback", error);
    return fallbackClassify(description);
  }
}
