"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, Loader2, Radio } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSession } from "@/lib/auth-client";

type Org = {
  id: string;
  name: string;
  slug: string;
  role: string;
  active?: boolean;
};

export default function WorkspacePage() {
  const { data: session, isPending } = useSession();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);
  const [tenantMessage, setTenantMessage] = useState<string | null>(null);
  const [switching, setSwitching] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [tenantName, setTenantName] = useState("");
  const [tenantSlug, setTenantSlug] = useState("");

  const refreshOrgs = useCallback(async () => {
    try {
      const res = await fetch("/api/organizations", { credentials: "include" });
      if (!res.ok) {
        setTenantMessage("Não foi possível carregar workspaces.");
        return null;
      }
      const data = await res.json();
      const list: Org[] = Array.isArray(data) ? data : [];
      setOrgs(list);
      setTenantMessage(null);

      const activeFromServer = list.find((org) => org.active)?.id ?? null;
      const fallback = list[0]?.id ?? null;
      const nextActive =
        (activeOrgId && list.some((org) => org.id === activeOrgId)
          ? activeOrgId
          : null) ??
        activeFromServer ??
        fallback ??
        null;

      setActiveOrgId(nextActive);
      return nextActive;
    } catch {
      setTenantMessage("Não foi possível carregar workspaces.");
      return null;
    }
  }, [activeOrgId]);

  async function handleCreateTenant(e: React.FormEvent) {
    e.preventDefault();
    if (!tenantName.trim()) {
      setTenantMessage("Informe o nome do workspace.");
      return;
    }
    setCreating(true);
    setTenantMessage(null);
    try {
      const res = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: tenantName.trim(),
          slug: tenantSlug.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTenantMessage(data.error || "Falha ao criar workspace.");
        return;
      }
      setTenantName("");
      setTenantSlug("");
      await refreshOrgs();
      setTenantMessage(`Workspace ${data.name || tenantName} criado e ativado.`);
    } catch {
      setTenantMessage("Falha ao criar workspace.");
    } finally {
      setCreating(false);
    }
  }

  useEffect(() => {
    if (!session) return;
    (async () => {
      await fetch("/api/post-signin", { method: "POST" });
      await refreshOrgs();
    })();
  }, [session, refreshOrgs]);

  if (isPending) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-muted-foreground">
        Carregando sessão...
      </div>
    );
  }

  if (!session) {
    return (
      <div className="container mx-auto px-4 py-12">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="text-2xl">Acesse para continuar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-muted-foreground">
              Entre com Google para selecionar o workspace e acessar os formulários.
            </p>
            <Button asChild>
              <a href="/">Voltar</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-10 space-y-8">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-primary font-semibold">
            Workspaces
          </p>
          <h1 className="text-3xl font-semibold">Selecione o tenant</h1>
          <p className="text-muted-foreground">
            Veja todos os workspaces que você pode acessar e ative um para usar nos formulários.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Suas organizações
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {orgs.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhum workspace disponível. Crie um ou peça convite.
            </p>
          )}
          <div className="grid gap-3 md:grid-cols-2">
            {orgs.map((org) => {
              const isActive = org.id === activeOrgId;
              return (
                <div
                  key={org.id}
                  className="flex items-center justify-between rounded-lg border bg-muted/60 px-3 py-2"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">{org.name}</p>
                    <p className="text-xs text-muted-foreground">
                      slug: {org.slug} · papel: {org.role}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
                    <Button
                      size="sm"
                      variant={isActive ? "default" : "outline"}
                      disabled={switching === org.id}
                      onClick={async () => {
                        if (isActive) return;
                        setSwitching(org.id);
                        setTenantMessage(null);
                        try {
                          const res = await fetch("/api/organizations/switch", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            credentials: "include",
                            body: JSON.stringify({ orgId: org.id }),
                          });
                          const data = await res.json();
                          if (!res.ok) {
                            setTenantMessage(data.error || "Falha ao trocar tenant.");
                          } else {
                            await refreshOrgs();
                            setTenantMessage(`Workspace ${org.name} ativado.`);
                          }
                        } catch {
                          setTenantMessage("Falha ao trocar tenant.");
                        } finally {
                          setSwitching(null);
                        }
                      }}
                    >
                      {switching === org.id ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Trocando
                        </>
                      ) : isActive ? (
                        <>
                          <Radio className="mr-2 h-4 w-4" /> Ativo
                        </>
                      ) : (
                        "Ativar"
                      )}
                    </Button>
                    <Button asChild size="sm" variant="secondary">
                      <Link href={`/workspace/${org.slug || org.id}/formulario`}>
                        Formulários
                      </Link>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          {tenantMessage && (
            <p className="text-sm text-primary" role="status">
              {tenantMessage}
            </p>
          )}
          {activeOrgId && (
            <p className="text-sm text-muted-foreground">
              Workspace ativo: {orgs.find((o) => o.id === activeOrgId)?.name || activeOrgId}. Acesse os formulários em /formulario.
            </p>
          )}
          <div className="mt-6 rounded-lg border bg-muted/40 p-4 space-y-3">
            <p className="text-sm font-semibold text-foreground">Criar novo workspace</p>
            <form onSubmit={handleCreateTenant} className="grid gap-3 md:grid-cols-2">
              <div className="grid gap-1">
                <label className="text-sm font-medium" htmlFor="tenantName">
                  Nome
                </label>
                <input
                  id="tenantName"
                  className="rounded-md border bg-background px-3 py-2 text-sm"
                  value={tenantName}
                  onChange={(e) => setTenantName(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-1">
                <label className="text-sm font-medium" htmlFor="tenantSlug">
                  Slug (opcional)
                </label>
                <input
                  id="tenantSlug"
                  className="rounded-md border bg-background px-3 py-2 text-sm"
                  value={tenantSlug}
                  onChange={(e) => setTenantSlug(e.target.value)}
                  placeholder="ex: meu-workspace"
                />
              </div>
              <div className="md:col-span-2 flex items-center gap-3">
                <Button type="submit" disabled={creating}>
                  {creating ? "Criando..." : "Criar e ativar"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Cria e ativa imediatamente para uso em /formulario.
                </p>
              </div>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
