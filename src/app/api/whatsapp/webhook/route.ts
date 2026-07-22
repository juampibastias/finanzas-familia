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

// Meta sends a GET to verify the webhook on first setup
export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

// Send a WhatsApp message via Meta Cloud API
async function sendWhatsApp(to: string, message: string): Promise<void> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_TOKEN;
  if (!phoneNumberId || !token) return;

  await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: message },
    }),
  });
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

// Meta sends a POST for each incoming message
export async function POST(req: Request): Promise<Response> {
  try {
    const body = await req.json() as {
      object: string;
      entry: Array<{
        changes: Array<{
          value: {
            messages?: Array<{
              from: string;
              type: string;
              text?: { body: string };
            }>;
          };
        }>;
      }>;
    };

    // Meta expects 200 immediately — process async
    if (body.object !== "whatsapp_business_account") {
      return NextResponse.json({ ok: true });
    }

    const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!message || message.type !== "text" || !message.text?.body) {
      return NextResponse.json({ ok: true });
    }

    const from = message.from; // e.g. "5492614001122" (no +)
    const text = message.text.body.trim();

    // Process in background — return 200 to Meta immediately
    void (async () => {
      try {
        await connectDB();

        // Look up user by phone — strip leading + for comparison
        const phoneVariants = [from, `+${from}`];
        const user = await User.findOne({ phone: { $in: phoneVariants } }).lean();
        if (!user) {
          await sendWhatsApp(from, `⚠️ Tu número no está vinculado. Ingresá a la app → Configuración → Cuenta y agregá tu número de WhatsApp.`);
          return;
        }

        const [accounts, categories] = await Promise.all([
          Account.find().lean<LeanAccount[]>(),
          Category.find().lean<LeanCategory[]>(),
        ]);

        const expenseCats = categories.filter((c) => c.kind === "expense").map((c) => c.name);
        const incomeCats = categories.filter((c) => c.kind === "income").map((c) => c.name);

        const parsed = await parseTransaction(text, expenseCats, incomeCats);
        if (!parsed) {
          await sendWhatsApp(from, "No entendí ese mensaje 🤔\nProbá con: *gasté 1500 en súper* o *cobré 80000 de sueldo*");
          return;
        }

        const category = categories.find(
          (c) => c.kind === parsed.type && c.name.toLowerCase() === parsed.categoryName.toLowerCase(),
        ) ?? categories.find((c) => c.kind === parsed.type);

        const account = accounts.find((a) =>
          parsed.accountHint && a.name.toLowerCase().includes(parsed.accountHint.toLowerCase()),
        ) ?? accounts[0];

        if (!category || !account) {
          await sendWhatsApp(from, "❌ No encontré cuenta o categoría. Revisá la configuración en la app.");
          return;
        }

        await Transaction.create({
          date: new Date(),
          amount: parsed.amount,
          type: parsed.type,
          accountId: account._id,
          categoryId: category._id,
          description: parsed.description,
          notes: `WhatsApp: "${text}"`,
          externalRef: null,
          recurring: false,
          recurringMonth: null,
          installment: null,
          createdBy: new Types.ObjectId(String(user._id)),
        });

        const sign = parsed.type === "income" ? "+" : "-";
        const amountFmt = new Intl.NumberFormat("es-AR").format(parsed.amount);
        await sendWhatsApp(from, `✅ ${sign}$${amountFmt} registrado\n📂 ${category.name} · 🏦 ${account.name}\n📝 ${parsed.description}`);
      } catch (err) {
        console.error("[whatsapp/webhook]", err);
      }
    })();

    // Always return 200 immediately so Meta doesn't retry
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
