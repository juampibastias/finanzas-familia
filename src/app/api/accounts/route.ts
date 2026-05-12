import { connectDB } from "@/lib/db";
import { Account } from "@/lib/models/Account";
import { accountSchema } from "@/lib/validations";
import { handleAuthError, handleError, jsonOk, requireAuth } from "@/lib/api-utils";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  try {
    await requireAuth();
    await connectDB();
    const accounts = await Account.find().sort({ order: 1, name: 1 }).lean();
    return jsonOk(accounts);
  } catch (err) {
    return handleAuthError(err) ?? handleError(err);
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    await requireAuth();
    const body = (await req.json()) as unknown;
    const data = accountSchema.parse(body);
    await connectDB();
    const created = await Account.create(data);
    return jsonOk(created, 201);
  } catch (err) {
    return handleAuthError(err) ?? handleError(err);
  }
}
