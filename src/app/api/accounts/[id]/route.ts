import { connectDB } from "@/lib/db";
import { Account } from "@/lib/models/Account";
import { accountSchema } from "@/lib/validations";
import {
  handleAuthError,
  handleError,
  jsonError,
  jsonOk,
  requireAuth,
} from "@/lib/api-utils";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    await requireAuth();
    const { id } = await params;
    await connectDB();
    const acc = await Account.findById(id).lean();
    if (!acc) return jsonError("No encontrado", 404);
    return jsonOk(acc);
  } catch (err) {
    return handleAuthError(err) ?? handleError(err);
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    await requireAuth();
    const { id } = await params;
    const body = (await req.json()) as unknown;
    const data = accountSchema.partial().parse(body);
    await connectDB();
    const updated = await Account.findByIdAndUpdate(id, data, {
      new: true,
      runValidators: true,
    }).lean();
    if (!updated) return jsonError("No encontrado", 404);
    return jsonOk(updated);
  } catch (err) {
    return handleAuthError(err) ?? handleError(err);
  }
}

// Soft-delete (archivar)
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    await requireAuth();
    const { id } = await params;
    await connectDB();
    const updated = await Account.findByIdAndUpdate(
      id,
      { active: false },
      { new: true },
    ).lean();
    if (!updated) return jsonError("No encontrado", 404);
    return jsonOk(updated);
  } catch (err) {
    return handleAuthError(err) ?? handleError(err);
  }
}
