import { connectDB } from "@/lib/db";
import { MonthlyBudget } from "@/lib/models/MonthlyBudget";
import { budgetSchema } from "@/lib/validations";
import { handleAuthError, handleError, jsonError, jsonOk, requireAuth } from "@/lib/api-utils";

export const runtime = "nodejs";

export async function GET(req: Request): Promise<Response> {
  try {
    await requireAuth();
    await connectDB();
    const url = new URL(req.url);
    const month = url.searchParams.get("month");
    if (!month) return jsonError("Falta query param 'month' (YYYY-MM)", 400);
    const items = await MonthlyBudget.find({ month })
      .populate("categoryId", "name kind color icon")
      .lean();
    return jsonOk(items);
  } catch (err) {
    return handleAuthError(err) ?? handleError(err);
  }
}

// Upsert por (month, categoryId)
export async function PUT(req: Request): Promise<Response> {
  try {
    await requireAuth();
    const body = (await req.json()) as unknown;
    const data = budgetSchema.parse(body);
    await connectDB();
    const updated = await MonthlyBudget.findOneAndUpdate(
      { month: data.month, categoryId: data.categoryId },
      { $set: { estimated: data.estimated } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean();
    return jsonOk(updated);
  } catch (err) {
    return handleAuthError(err) ?? handleError(err);
  }
}
