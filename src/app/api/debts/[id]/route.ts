import { connectDB } from "@/lib/db";
import { Debt } from "@/lib/models/Debt";
import { debtSchema } from "@/lib/validations";
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
    const data = debtSchema.partial().parse(body);
    await connectDB();
    const updated = await Debt.findByIdAndUpdate(id, data, {
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
    const removed = await Debt.findByIdAndDelete(id).lean();
    if (!removed) return jsonError("No encontrado", 404);
    return jsonOk({ ok: true });
  } catch (err) {
    return handleAuthError(err) ?? handleError(err);
  }
}
