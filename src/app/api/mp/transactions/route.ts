import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { requireAuth, handleAuthError, handleError } from "@/lib/api-utils";
import { connectDB } from "@/lib/db";
import { MPConnection } from "@/lib/models/MPConnection";
import { Transaction } from "@/lib/models/Transaction";
import "@/lib/models/Category";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  try {
    const { userId } = await requireAuth();
    const url = new URL(req.url);
    const connectionId = url.searchParams.get("connectionId");
    const limit = Math.min(Number(url.searchParams.get("limit") ?? "100"), 200);

    await connectDB();

    let accountId: Types.ObjectId | undefined;
    if (connectionId) {
      const conn = await MPConnection.findOne({
        _id: new Types.ObjectId(connectionId),
        userId: new Types.ObjectId(userId),
        active: true,
      }).lean();
      if (!conn) return NextResponse.json({ error: "Conexión no encontrada" }, { status: 404 });
      accountId = conn.linkedAccountId as Types.ObjectId;
    }

    const query: Record<string, unknown> = { externalRef: { $regex: /^mp:/ } };
    if (accountId) query.accountId = accountId;

    const txs = await Transaction.find(query)
      .sort({ date: -1 })
      .limit(limit)
      .populate("categoryId", "name")
      .lean();

    return NextResponse.json(txs);
  } catch (err) {
    return handleAuthError(err) ?? handleError(err);
  }
}
