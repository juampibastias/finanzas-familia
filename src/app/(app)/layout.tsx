import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-sidebar";

export default async function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.ReactElement> {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  if (session.user.mustChangePassword) {
    redirect("/cambiar-password");
  }
  return <AppShell>{children}</AppShell>;
}
