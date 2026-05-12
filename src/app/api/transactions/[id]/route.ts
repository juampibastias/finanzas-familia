import { connectDB } from "@/lib/db";
import { Transaction } from "@/lib/models/Transaction";
import { transactionSchema } from "@/lib/validations";
import {
  handleAuthError,
  handleError,
  jsonError,
  jsonOk,
  requireAuth,
} from "@/lib/api-utils";

export const runtime = "nodejs";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    await requireAuth();
    const { id } = await params;
    const body = (await req.json()) as unknown;
    const data = transactionSchema.partial().parse(body);
    await connectDB();
    const updated = await Transaction.findByIdAndUpdate(id, data, {
      new: true,
      runValidators: true,
    }).lean();
    if (!updated) return jsonError("No encontrado", 404);
    return jsonOk(updated);
  } catch (err) {
    return handleAuthError(err) ?? handleError(err);
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    await requireAuth();
    const { id } = await params;
    const scope = new URL(req.url).searchParams.get("scope");
    await connectDB();

    if (scope === "recurring") {
      const tx = await Transaction.findById(id).lean();
      if (!tx) return jsonError("No encontrado", 404);
      const result = await Transaction.deleteMany({
        recurring: true,
        description: tx.description,
        accountId: tx.accountId,
        categoryId: tx.categoryId,
        amount: tx.amount,
      });
      return jsonOk({ ok: true, deleted: result.deletedCount });
    }

    const removed = await Transaction.findByIdAndDelete(id).lean();
    if (!removed) return jsonError("No encontrado", 404);
    return jsonOk({ ok: true });
  } catch (err) {
    return handleAuthError(err) ?? handleError(err);
  }
}
