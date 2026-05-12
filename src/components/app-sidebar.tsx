"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  CalendarClock,
  Target,
  Settings,
  Menu,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/cuentas", label: "Cuentas", icon: Wallet },
  { href: "/movimientos", label: "Movimientos", icon: ArrowLeftRight },
  { href: "/pagos", label: "Pagos", icon: CalendarClock },
  { href: "/presupuesto", label: "Presupuesto", icon: Target },
  { href: "/config", label: "Config", icon: Settings },
];

function NavLinks({ onSelect }: { onSelect?: () => void }): React.ReactElement {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {navItems.map((item) => {
        const active =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onSelect}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors min-h-[44px]",
              active
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            <Icon className="size-4" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function UserMenu(): React.ReactElement {
  const { data: session } = useSession();
  const name = session?.user?.name ?? "Usuario";
  const initials = name
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full">
          <Avatar>
            <AvatarFallback>{initials || "U"}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="font-medium">{name}</div>
          <div className="text-xs text-muted-foreground">
            {session?.user?.email}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/cambiar-password">Cambiar contraseña</Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="text-destructive"
        >
          <LogOut className="mr-2 size-4" />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppShell({ children }: { children: React.ReactNode }): React.ReactElement {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-dvh flex">
      {/* Sidebar desktop */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r bg-background p-4 gap-4">
        <div className="flex items-center gap-2 px-2 py-1">
          <Wallet className="size-5" />
          <span className="font-semibold">Finanzas Familia</span>
        </div>
        <NavLinks />
        <div className="mt-auto px-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            <LogOut className="mr-2 size-4" />
            Cerrar sesión
          </Button>
        </div>
      </aside>

      {/* Right column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar mobile */}
        <header className="lg:hidden sticky top-0 z-40 flex items-center justify-between gap-2 border-b bg-background/95 backdrop-blur px-4 h-14 supports-[backdrop-filter]:bg-background/60">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Abrir menú">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-4">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Wallet className="size-5" />
                  Finanzas Familia
                </SheetTitle>
              </SheetHeader>
              <div className="mt-6">
                <NavLinks onSelect={() => setOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>
          <div className="font-semibold">Finanzas Familia</div>
          <UserMenu />
        </header>

        {/* Top bar desktop */}
        <div className="hidden lg:flex sticky top-0 z-40 h-14 items-center justify-end border-b bg-background/95 backdrop-blur px-6 supports-[backdrop-filter]:bg-background/60">
          <UserMenu />
        </div>

        <main className="flex-1 px-4 py-4 sm:px-6 sm:py-6 lg:px-8 max-w-full overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
