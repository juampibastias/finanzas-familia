import { connectDB } from "@/lib/db";
import { Category } from "@/lib/models/Category";
import { Transaction } from "@/lib/models/Transaction";
import { categorySchema } from "@/lib/validations";
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
    const data = categorySchema.partial().parse(body);
    await connectDB();
    const updated = await Category.findByIdAndUpdate(id, data, {
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
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    await requireAuth();
    const { id } = await params;
    await connectDB();
    const inUse = await Transaction.countDocuments({ categoryId: id });
    if (inUse > 0) {
      return jsonError(
        `La categoría tiene ${inUse} transacciones, no se puede eliminar`,
        409,
      );
    }
    const removed = await Category.findByIdAndDelete(id).lean();
    if (!removed) return jsonError("No encontrado", 404);
    return jsonOk({ ok: true });
  } catch (err) {
    return handleAuthError(err) ?? handleError(err);
  }
}
