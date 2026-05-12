import { connectDB } from "@/lib/db";
import { Debt } from "@/lib/models/Debt";
import { debtSchema } from "@/lib/validations";
import { handleAuthError, handleError, jsonOk, requireAuth } from "@/lib/api-utils";

export const runtime = "nodejs";

export async function GET(req: Request): Promise<Response> {
  try {
    await requireAuth();
    await connectDB();
    const url = new URL(req.url);
    const paid = url.searchParams.get("paid");
    const filter: Record<string, unknown> = {};
    if (paid === "true") filter.paid = true;
    if (paid === "false") filter.paid = false;
    const debts = await Debt.find(filter).sort({ dueDate: 1 }).lean();
    return jsonOk(debts);
  } catch (err) {
    return handleAuthError(err) ?? handleError(err);
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    await requireAuth();
    const body = (await req.json()) as unknown;
    const data = debtSchema.parse(body);
    await connectDB();
    const created = await Debt.create(data);
    return jsonOk(created, 201);
  } catch (err) {
    return handleAuthError(err) ?? handleError(err);
  }
}
