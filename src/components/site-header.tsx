"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Layers } from "lucide-react";
import { UserProfile } from "@/components/auth/user-profile";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { ModeToggle } from "./ui/mode-toggle";

const nav = [
  { href: "/", label: "Início" },
  { href: "/dashboard", label: "Workspace" },
  { href: "/formulario", label: "Formulário" },
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-background focus:text-foreground focus:border focus:rounded-md"
      >
        Ir para o conteúdo
      </a>
      <header className="border-b backdrop-blur bg-background/90 sticky top-0 z-40">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <Link
            href="/"
            className="flex items-center gap-3 text-foreground"
            aria-label="Voltar para a home"
          >
            <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/80 to-primary text-background shadow-sm">
              <Layers className="h-5 w-5" />
            </span>
            <div className="flex flex-col leading-tight">
              <span className="text-base font-semibold">Roteiro Builder</span>
              <span className="text-xs text-muted-foreground">
                Formulário + PDF overlay
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "transition-colors hover:text-primary",
                  pathname === item.href
                    ? "text-primary"
                    : "text-muted-foreground"
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <UserProfile />
            <ModeToggle />
          </div>
        </div>
      </header>
    </>
  );
}
