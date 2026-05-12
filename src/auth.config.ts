import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnLogin = nextUrl.pathname.startsWith("/login");
      if (isOnLogin) {
        if (isLoggedIn) return Response.redirect(new URL("/", nextUrl));
        return true;
      }
      return isLoggedIn;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.email = user.email ?? token.email;
        token.role = (user as { role?: "admin" | "member" }).role;
        token.mustChangePassword = (user as { mustChangePassword?: boolean })
          .mustChangePassword;
      }
      // Push de useSession().update(...) — propagar mustChangePassword
      if (trigger === "update" && session && typeof session === "object") {
        const upd = session as { mustChangePassword?: boolean };
        if (typeof upd.mustChangePassword === "boolean") {
          token.mustChangePassword = upd.mustChangePassword;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.email = (token.email as string) ?? session.user.email;
        session.user.role = token.role as "admin" | "member" | undefined;
        session.user.mustChangePassword =
          (token.mustChangePassword as boolean | undefined) ?? false;
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
