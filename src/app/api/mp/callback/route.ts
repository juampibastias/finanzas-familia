import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-utils";
import { connectDB } from "@/lib/db";
import { MPConnection } from "@/lib/models/MPConnection";
import { exchangeCode, mpGet, decodeState, type MPUserInfo } from "@/lib/mp-api";
import { syncMPConnection } from "@/lib/mp-sync";
import { Types } from "mongoose";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  try {
    const { userId } = await requireAuth();
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) {
      return NextResponse.redirect(`${base}/config?tab=mercadopago&mp_error=${encodeURIComponent(error)}`);
    }
    if (!code || !state) {
      return NextResponse.redirect(`${base}/config?tab=mercadopago&mp_error=missing_params`);
    }

    const stateData = decodeState(state);
    if (!stateData || stateData.userId !== userId) {
      return NextResponse.redirect(`${base}/config?tab=mercadopago&mp_error=invalid_state`);
    }

    // Token must be < 10 min old
    if (Date.now() - stateData.ts > 10 * 60 * 1000) {
      return NextResponse.redirect(`${base}/config?tab=mercadopago&mp_error=state_expired`);
    }

    const redirectUri = `${base}/api/mp/callback`;
    const tokens = await exchangeCode(code, redirectUri);

    // Fetch MP user info
    const mpUser = await mpGet<MPUserInfo>("/v1/users/me", tokens.access_token);

    await connectDB();

    // Upsert connection
    await MPConnection.findOneAndUpdate(
      { userId: new Types.ObjectId(userId), mpUserId: String(mpUser.id) },
      {
        userId: new Types.ObjectId(userId),
        mpUserId: String(mpUser.id),
        mpNickname: mpUser.nickname,
        mpEmail: mpUser.email,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        linkedAccountId: new Types.ObjectId(stateData.accountId),
        syncFromDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // last 30 days
        active: true,
      },
      { upsert: true, new: true },
    );

    // Trigger initial background sync (don't await, just start it)
    const conn = await MPConnection.findOne({ userId: new Types.ObjectId(userId), mpUserId: String(mpUser.id) });
    if (conn) {
      syncMPConnection(String(conn._id), userId).catch(console.error);
    }

    return NextResponse.redirect(`${base}/config?tab=mercadopago&mp_success=1`);
  } catch (err) {
    console.error("[mp/callback]", err);
    const msg = err instanceof Error ? err.message : "error";
    return NextResponse.redirect(`${base}/config?tab=mercadopago&mp_error=${encodeURIComponent(msg)}`);
  }
}
