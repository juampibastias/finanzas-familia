import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  /**
   * Excluimos /api de la protección por middleware (cada route handler
   * usa requireAuth() y responde 401 JSON si falta sesión).
   * Las páginas /login y /cambiar-password tienen su propia lógica en
   * authConfig.callbacks.authorized.
   */
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$|.*\\.jpg$|.*\\.webp$).*)",
  ],
};
