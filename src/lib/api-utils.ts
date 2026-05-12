import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { auth } from "@/auth";

export function jsonOk<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function jsonError(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export function handleError(err: unknown): NextResponse {
  if (err instanceof ZodError) {
    return NextResponse.json(
      { error: "Datos inválidos", details: err.flatten() },
      { status: 400 },
    );
  }
  if (err instanceof Error) {
    console.error("[api]", err);
    return jsonError(err.message, 500);
  }
  console.error("[api] error desconocido", err);
  return jsonError("Error desconocido", 500);
}

export async function requireAuth(): Promise<{ userId: string; email: string }> {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    throw new AuthRequiredError();
  }
  return { userId: session.user.id, email: session.user.email };
}

export class AuthRequiredError extends Error {
  constructor() {
    super("No autenticado");
    this.name = "AuthRequiredError";
  }
}

export function handleAuthError(err: unknown): NextResponse | null {
  if (err instanceof AuthRequiredError) {
    return jsonError("No autenticado", 401);
  }
  return null;
}
