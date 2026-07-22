import Anthropic from "@anthropic-ai/sdk";
import { guessCategory } from "@/lib/mp-api";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface Category { _id: string; name: string; kind: string }

// Simple in-process cache: "description|kind" → categoryId
const cache = new Map<string, string>();

/**
 * Find the best category for a transaction.
 * 1. Try keyword rules (free, instant)
 * 2. If no match, call Claude with the user's actual category list
 */
export async function aiCategorize(
  description: string,
  operationType: string,
  poiType: string | undefined,
  txType: "income" | "expense",
  categories: Category[],
  defaultCategoryId: string,
): Promise<string> {
  const cacheKey = `${description}|${operationType}|${poiType ?? ""}|${txType}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey)!;

  // Step 1: keyword rules
  const guess = guessCategory(description, operationType, poiType);
  if (guess) {
    const hintLower = guess.hint.toLowerCase();
    const kindCats = categories.filter((c) => c.kind === txType);

    // Try name contains hint or hint contains name
    let match = kindCats.find((c) => c.name.toLowerCase().includes(hintLower));
    if (!match) match = kindCats.find((c) => hintLower.includes(c.name.toLowerCase()));
    if (match) {
      cache.set(cacheKey, match._id);
      return match._id;
    }
  }

  // Step 2: no keyword match — ask Claude
  const kindCats = categories.filter((c) => c.kind === txType);
  if (kindCats.length === 0) return defaultCategoryId;
  if (!process.env.ANTHROPIC_API_KEY) return defaultCategoryId;

  const categoryList = kindCats.map((c) => c.name).join(", ");
  const dirLabel = txType === "income" ? "ingreso" : "gasto";
  const opLabel = operationType.replace(/_/g, " ");

  const prompt = `Sos un asistente de finanzas personales argentino. Dado este movimiento de MercadoPago, elegí la categoría más apropiada de la lista.

Movimiento:
- Descripción: "${description}"
- Tipo de operación MP: ${opLabel}${poiType ? ` (${poiType})` : ""}
- Dirección: ${dirLabel}

Categorías disponibles (${dirLabel}s): ${categoryList}

Respondé ÚNICAMENTE con el nombre exacto de una de las categorías de la lista. Sin explicación, sin puntuación extra.`;

  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 32,
      messages: [{ role: "user", content: prompt }],
    });
    const chosen = (msg.content[0] as { text: string }).text.trim();
    const found = kindCats.find((c) => c.name.toLowerCase() === chosen.toLowerCase());
    const resultId = found?._id ?? defaultCategoryId;
    cache.set(cacheKey, resultId);
    return resultId;
  } catch {
    return defaultCategoryId;
  }
}
