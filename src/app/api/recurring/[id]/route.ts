import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { requireAuth, handleAuthError, handleError } from "@/lib/api-utils";
import { connectDB } from "@/lib/db";
import { RecurringTransaction } from "@/lib/models/RecurringTransaction";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    await requireAuth();
    const { id } = await params;
    await connectDB();
    await RecurringTransaction.findByIdAndUpdate(new Types.ObjectId(id), { active: false });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleAuthError(err) ?? handleError(err);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    await requireAuth();
    const { id } = await params;
    const body = await req.json() as Record<string, unknown>;
    await connectDB();
    const updated = await RecurringTransaction.findByIdAndUpdate(
      new Types.ObjectId(id),
      body,
      { new: true },
    );
    return NextResponse.json(updated);
  } catch (err) {
    return handleAuthError(err) ?? handleError(err);
  }
}
