import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { requireAuth, handleAuthError, handleError } from "@/lib/api-utils";
import { connectDB } from "@/lib/db";
import { RecurringTransaction } from "@/lib/models/RecurringTransaction";
import "@/lib/models/Account";
import "@/lib/models/Category";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    await requireAuth();
    await connectDB();
    const items = await RecurringTransaction.find({ active: true })
      .populate("accountId", "name")
      .populate("categoryId", "name color")
      .sort({ dayOfMonth: 1 })
      .lean();
    return NextResponse.json(items);
  } catch (err) {
    return handleAuthError(err) ?? handleError(err);
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    const { userId } = await requireAuth();
    const body = (await req.json()) as {
      description: string;
      amount: number;
      type: "income" | "expense";
      accountId: string;
      categoryId: string;
      dayOfMonth: number;
    };

    if (!body.description || !body.amount || !body.accountId || !body.categoryId || !body.dayOfMonth) {
      return NextResponse.json({ error: "Campos requeridos faltantes" }, { status: 400 });
    }

    await connectDB();
    const rec = await RecurringTransaction.create({
      description: body.description,
      amount: body.amount,
      type: body.type,
      accountId: new Types.ObjectId(body.accountId),
      categoryId: new Types.ObjectId(body.categoryId),
      dayOfMonth: body.dayOfMonth,
      createdBy: new Types.ObjectId(userId),
    });

    return NextResponse.json(rec, { status: 201 });
  } catch (err) {
    return handleAuthError(err) ?? handleError(err);
  }
}
