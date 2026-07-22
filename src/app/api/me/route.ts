import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { requireAuth, handleAuthError, handleError } from "@/lib/api-utils";
import { connectDB } from "@/lib/db";
import { User } from "@/lib/models/User";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    const { userId } = await requireAuth();
    await connectDB();
    const user = await User.findById(new Types.ObjectId(userId)).select("name email phone").lean();
    return NextResponse.json(user);
  } catch (err) {
    return handleAuthError(err) ?? handleError(err);
  }
}

export async function PATCH(req: Request): Promise<Response> {
  try {
    const { userId } = await requireAuth();
    const { phone } = (await req.json()) as { phone?: string | null };
    await connectDB();
    await User.findByIdAndUpdate(new Types.ObjectId(userId), { phone: phone ?? null });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleAuthError(err) ?? handleError(err);
  }
}
