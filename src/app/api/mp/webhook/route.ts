import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { MPConnection } from "@/lib/models/MPConnection";
import { syncMPConnection } from "@/lib/mp-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface MPWebhookBody {
  type: string;
  data?: { id?: string | number };
  user_id?: number;
}

export async function POST(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as MPWebhookBody;
    if (body.type !== "payment" || !body.user_id) {
      return NextResponse.json({ ok: true });
    }

    await connectDB();
    const mpUserId = String(body.user_id);
    const conn = await MPConnection.findOne({ mpUserId, active: true });
    if (!conn) return NextResponse.json({ ok: true });

    // Trigger sync in background
    syncMPConnection(String(conn._id), String(conn.userId)).catch(console.error);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[mp/webhook]", err);
    return NextResponse.json({ ok: true }); // always 200 to MP
  }
}
