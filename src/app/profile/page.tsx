"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Calendar, ShieldCheck, UserCircle2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSession } from "@/lib/auth-client";

type Org = {
  id: string;
  name: string;
  role: string;
  active?: boolean;
};

export default function ProfilePage() {
  const { data: session, isPending } = useSession();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [orgsError, setOrgsError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    (async () => {
      try {
        const res = await fetch("/api/organizations", { credentials: "include" });
        if (!res.ok) {
          setOrgsError("Falha ao carregar tenants associados.");
          return;
        }
        const data = await res.json();
        const list: Org[] = Array.isArray(data) ? data : [];
        setOrgs(list);
        setOrgsError(null);
      } catch {
        setOrgsError("Falha ao carregar tenants associados.");
      }
    })();
  }, [session]);

  if (isPending) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-muted-foreground">
        Carregando...
      </div>
    );
  }

  if (!session) {
    return (
      <div className="container mx-auto px-4 py-10 text-center">
        <p className="text-muted-foreground">
          Entre para ver detalhes do seu usuário e tenant.
        </p>
        <Button asChild className="mt-4">
          <Link href="/">Voltar</Link>
        </Button>
      </div>
    );
  }

  const user = session.user;
  const createdAt = (user as any)?.createdAt;
  const createdDate = createdAt
    ? new Date(createdAt as string).toLocaleDateString("pt-BR")
    : null;

  return (
    <div className="container mx-auto px-4 py-10 space-y-6">
      <div className="flex items-center gap-3">
        <UserCircle2 className="h-7 w-7 text-primary" />
        <div>
          <p className="text-xs uppercase tracking-wide text-primary font-semibold">
            Perfil e contexto
          </p>
          <h1 className="text-3xl font-semibold">Conta e tenant ativo</h1>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Identidade</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarImage
              src={user.image || ""}
              alt={user.name || "User"}
              referrerPolicy="no-referrer"
            />
            <AvatarFallback>
              {(user.name?.[0] || user.email?.[0] || "U").toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <p className="text-lg font-semibold">{user.name}</p>
            <p className="text-muted-foreground text-sm">{user.email}</p>
            {createdDate && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span>Membro desde {createdDate}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tenants e papéis</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {orgsError && (
            <p className="text-sm text-destructive">{orgsError}</p>
          )}
          {!orgsError && orgs.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Sem tenants. Crie um em /dashboard para habilitar o fluxo.
            </p>
          )}
          {(orgs || []).map((org) => (
            <div
              key={org.id}
              className="flex flex-wrap items-center justify-between rounded-lg border bg-muted/50 px-3 py-2"
            >
              <div>
                <p className="font-semibold">{org.name}</p>
                <p className="text-xs text-muted-foreground">{org.id}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{org.role}</Badge>
                {org.active && (
                  <Badge className="bg-primary text-primary-foreground">
                    Ativo
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Como o tenant é resolvido</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            1) Header <code>X-Tenant-Id</code> enviado pelo proxy; 2) slug na
            rota <code>/o/:slug</code>; 3) subdomínio; 4) fallback em{" "}
            <code>lastActiveOrgId</code>. Os endpoints exigem permissão de
            acordo com o papel salvo em <code>organization_membership.role</code>.
          </p>
          <p className="flex items-center gap-2 text-primary font-semibold">
            <ShieldCheck className="h-4 w-4" />
            RBAC é verificado no servidor para cada ação.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
