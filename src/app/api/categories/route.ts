import { connectDB } from "@/lib/db";
import { Category } from "@/lib/models/Category";
import { categorySchema } from "@/lib/validations";
import { handleAuthError, handleError, jsonOk, requireAuth } from "@/lib/api-utils";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  try {
    await requireAuth();
    await connectDB();
    const cats = await Category.find().sort({ kind: 1, name: 1 }).lean();
    return jsonOk(cats);
  } catch (err) {
    return handleAuthError(err) ?? handleError(err);
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    await requireAuth();
    const body = (await req.json()) as unknown;
    const data = categorySchema.parse(body);
    await connectDB();
    const created = await Category.create(data);
    return jsonOk(created, 201);
  } catch (err) {
    return handleAuthError(err) ?? handleError(err);
  }
}
