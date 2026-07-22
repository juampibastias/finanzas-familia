import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { requireAuth, handleAuthError, handleError } from "@/lib/api-utils";
import { connectDB } from "@/lib/db";
import { MPConnection } from "@/lib/models/MPConnection";
import { Transaction } from "@/lib/models/Transaction";
import { mpGet } from "@/lib/mp-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    const { userId } = await requireAuth();
    await connectDB();

    const conn = await MPConnection.findOne({ userId: new Types.ObjectId(userId), active: true });
    if (!conn) return NextResponse.json({ error: "Sin conexión MP" });

    const imported = await Transaction.countDocuments({ externalRef: /^mp:/ });

    // Try to fetch a page of payments to see what MP returns
    let mpData: unknown = null;
    let mpError: string | null = null;
    try {
      mpData = await mpGet("/v1/payments/search", conn.accessToken, {
        sort: "date_created",
        criteria: "desc",
        limit: "5",
        offset: "0",
      });
    } catch (e) {
      mpError = e instanceof Error ? e.message : String(e);
    }

    // Reset lastSyncAt so next sync re-imports from syncFromDate
    conn.lastSyncAt = null;
    await conn.save();

    return NextResponse.json({
      connection: {
        mpUserId: conn.mpUserId,
        mpNickname: conn.mpNickname,
        lastSyncAt: null,
        syncFromDate: conn.syncFromDate,
        linkedAccountId: conn.linkedAccountId,
      },
      transactionsImported: imported,
      mpApiSample: mpData,
      mpApiError: mpError,
      note: "lastSyncAt reset to null — next sync will re-import from syncFromDate",
    });
  } catch (err) {
    return handleAuthError(err) ?? handleError(err);
  }
}
