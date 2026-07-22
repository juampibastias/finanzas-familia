import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { connectDB } from "@/lib/db";
import { User } from "@/lib/models/User";
import { Account } from "@/lib/models/Account";
import { Category } from "@/lib/models/Category";
import { Transaction } from "@/lib/models/Transaction";
import { Types } from "mongoose";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface LeanAccount { _id: Types.ObjectId; name: string }
interface LeanCategory { _id: Types.ObjectId; name: string; kind: string }

function twiml(message: string): Response {
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${message}</Message></Response>`,
    { headers: { "Content-Type": "text/xml" } },
  );
}

async function parseTransaction(
  message: string,
  expenseCategories: string[],
  incomeCategories: string[],
): Promise<{ amount: number; description: string; type: "income" | "expense"; categoryName: string; accountHint: string } | null> {
  const prompt = `Sos un asistente de finanzas personales argentino. El usuario mandó este mensaje de WhatsApp:
"${message}"

Extraé el gasto o ingreso. Respondé SOLO con JSON válido (sin markdown):
{"amount": <número>, "description": "<desc corta>", "type": "expense"|"income", "categoryName": "<categoría exacta de la lista>", "accountHint": "<parte del nombre de cuenta o vacío>"}

Categorías de gastos disponibles: ${expenseCategories.join(", ")}
Categorías de ingresos disponibles: ${incomeCategories.join(", ")}

Si no es un movimiento de dinero, respondé: null`;

  try {
    const msg = await claude.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 150,
      messages: [{ role: "user", content: prompt }],
    });
    const text = (msg.content[0] as { text: string }).text.trim();
    if (text === "null" || text === "") return null;
    return JSON.parse(text) as { amount: number; description: string; type: "income" | "expense"; categoryName: string; accountHint: string };
  } catch {
    return null;
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    // Parse Twilio's URL-encoded body
    const text = await req.text();
    const params = new URLSearchParams(text);
    const from = params.get("From") ?? ""; // "whatsapp:+549..."
    const body = (params.get("Body") ?? "").trim();

    if (!body) return twiml("Mandame un mensaje como: *gasté 800 en nafta* o *cobré 50000 del sueldo*");

    // Normalize phone: strip "whatsapp:" prefix
    const phone = from.replace(/^whatsapp:/i, "");

    await connectDB();

    // Find user by phone number
    const user = await User.findOne({ phone }).lean();
    if (!user) {
      return twiml(`⚠️ Tu número (${phone}) no está vinculado. Ingresá a la app → Configuración → Cuenta y agregá tu número de WhatsApp.`);
    }

    const userId = String(user._id);
    const [accounts, categories] = await Promise.all([
      Account.find().lean<LeanAccount[]>(),
      Category.find().lean<LeanCategory[]>(),
    ]);

    const expenseCats = categories.filter((c) => c.kind === "expense").map((c) => c.name);
    const incomeCats = categories.filter((c) => c.kind === "income").map((c) => c.name);

    const parsed = await parseTransaction(body, expenseCats, incomeCats);
    if (!parsed) {
      return twiml("No entendí ese mensaje. Probá con: *gasté 1500 en súper* o *cobré 80000 de sueldo*");
    }

    // Find category
    const category = categories.find(
      (c) => c.kind === parsed.type && c.name.toLowerCase() === parsed.categoryName.toLowerCase(),
    ) ?? categories.find((c) => c.kind === parsed.type);
    if (!category) return twiml("No encontré una categoría adecuada. Revisá las categorías en la app.");

    // Find account (prefer accountHint match, fallback to first)
    const account = accounts.find((a) =>
      parsed.accountHint && a.name.toLowerCase().includes(parsed.accountHint.toLowerCase()),
    ) ?? accounts[0];
    if (!account) return twiml("No hay cuentas configuradas en la app.");

    // Create transaction with today's date
    await Transaction.create({
      date: new Date(),
      amount: parsed.amount,
      type: parsed.type,
      accountId: account._id,
      categoryId: category._id,
      description: parsed.description,
      notes: `WhatsApp: "${body}"`,
      externalRef: null,
      recurring: false,
      recurringMonth: null,
      installment: null,
      createdBy: new Types.ObjectId(userId),
    });

    const sign = parsed.type === "income" ? "+" : "-";
    const amountFmt = new Intl.NumberFormat("es-AR").format(parsed.amount);
    return twiml(`✅ Registrado: ${sign}$${amountFmt} en *${category.name}* (${account.name})\n_${parsed.description}_`);
  } catch (err) {
    console.error("[whatsapp/webhook]", err);
    return twiml("❌ Ocurrió un error. Intentá de nuevo.");
  }
}
