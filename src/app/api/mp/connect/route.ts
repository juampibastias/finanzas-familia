import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-utils";
import { buildOAuthUrl, encodeState } from "@/lib/mp-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  try {
    const { userId } = await requireAuth();
    const url = new URL(req.url);
    const accountId = url.searchParams.get("accountId");
    if (!accountId) return NextResponse.json({ error: "accountId requerido" }, { status: 400 });

    const clientId = process.env.MP_CLIENT_ID;
    if (!clientId) return NextResponse.json({ error: "MP no configurado" }, { status: 503 });

    const redirectUri = `${process.env.NEXTAUTH_URL}/api/mp/callback`;
    const state = encodeState(userId, accountId);
    const oauthUrl = buildOAuthUrl(clientId, redirectUri, state);

    return NextResponse.redirect(oauthUrl);
  } catch {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
}
