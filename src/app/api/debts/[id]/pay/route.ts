import { Types } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { Debt } from "@/lib/models/Debt";
import { Transaction } from "@/lib/models/Transaction";
import { Category } from "@/lib/models/Category";
import {
  handleAuthError,
  handleError,
  jsonError,
  jsonOk,
  requireAuth,
} from "@/lib/api-utils";

export const runtime = "nodejs";

const paySchema = z.object({
  accountId: z.string().regex(/^[0-9a-fA-F]{24}$/),
  categoryId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  paidDate: z.coerce.date().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { userId } = await requireAuth();
    const { id } = await params;
    const body = (await req.json()) as unknown;
    const data = paySchema.parse(body);

    await connectDB();
    const debt = await Debt.findById(id);
    if (!debt) return jsonError("No encontrado", 404);
    if (debt.paid) return jsonError("La deuda ya estaba pagada", 400);

    let categoryId = data.categoryId;
    if (!categoryId) {
      // Buscar categoría "Deuda Tarjetas" como fallback
      const fallback = await Category.findOne({
        kind: "expense",
        name: { $regex: /deuda/i },
      }).lean();
      categoryId = fallback?._id?.toString();
    }
    if (!categoryId) {
      return jsonError(
        "Falta categoryId; pasalo o creá una categoría de expense para deudas",
        400,
      );
    }

    const paidDate = data.paidDate ?? new Date();

    const [tx] = await Promise.all([
      Transaction.create({
        date: paidDate,
        amount: debt.amount,
        type: "expense",
        accountId: new Types.ObjectId(data.accountId),
        categoryId: new Types.ObjectId(categoryId),
        description: `Pago: ${debt.name}`,
        createdBy: new Types.ObjectId(userId),
      }),
      Debt.findByIdAndUpdate(id, { paid: true, paidDate }),
    ]);

    return jsonOk({ ok: true, transactionId: tx._id });
  } catch (err) {
    return handleAuthError(err) ?? handleError(err);
  }
}
