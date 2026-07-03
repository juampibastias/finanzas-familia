import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { requireAuth, handleAuthError, handleError } from "@/lib/api-utils";
import { connectDB } from "@/lib/db";
import { MPConnection } from "@/lib/models/MPConnection";
import { syncMPConnection } from "@/lib/mp-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request): Promise<Response> {
  try {
    const { userId } = await requireAuth();
    const { connectionId } = (await req.json()) as { connectionId?: string };
    if (!connectionId) return NextResponse.json({ error: "connectionId requerido" }, { status: 400 });

    await connectDB();
    const conn = await MPConnection.findOne({
      _id: new Types.ObjectId(connectionId),
      userId: new Types.ObjectId(userId),
      active: true,
    });
    if (!conn) return NextResponse.json({ error: "Conexión no encontrada" }, { status: 404 });

    const result = await syncMPConnection(connectionId, userId);
    return NextResponse.json(result);
  } catch (err) {
    return handleAuthError(err) ?? handleError(err);
  }
}
