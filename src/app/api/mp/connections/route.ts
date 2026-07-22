import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { requireAuth, handleAuthError, handleError } from "@/lib/api-utils";
import { connectDB } from "@/lib/db";
import { MPConnection } from "@/lib/models/MPConnection";
import "@/lib/models/Account"; // register model so populate() works

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    const { userId } = await requireAuth();
    await connectDB();
    const conns = await MPConnection.find({ userId: new Types.ObjectId(userId), active: true })
      .populate("linkedAccountId", "name type bank")
      .lean();
    return NextResponse.json(conns);
  } catch (err) {
    return handleAuthError(err) ?? handleError(err);
  }
}

export async function DELETE(req: Request): Promise<Response> {
  try {
    const { userId } = await requireAuth();
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

    await connectDB();
    await MPConnection.findOneAndUpdate(
      { _id: new Types.ObjectId(id), userId: new Types.ObjectId(userId) },
      { active: false },
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleAuthError(err) ?? handleError(err);
  }
}
