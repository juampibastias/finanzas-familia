import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { MPConnection } from "@/lib/models/MPConnection";
import { syncMPConnection } from "@/lib/mp-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request): Promise<Response> {
  // Vercel cron includes Authorization: Bearer {CRON_SECRET}
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  const connections = await MPConnection.find({ active: true }).lean();
  const results: Record<string, unknown> = {};

  for (const conn of connections) {
    try {
      const result = await syncMPConnection(String(conn._id), String(conn.userId));
      results[String(conn._id)] = result;
    } catch (err) {
      results[String(conn._id)] = { error: err instanceof Error ? err.message : "error" };
    }
  }

  return NextResponse.json({ ok: true, synced: connections.length, results });
}
