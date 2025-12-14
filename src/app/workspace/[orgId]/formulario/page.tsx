"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Template = {
  id: string;
  name: string;
  status: string;
};

type Org = {
  id: string;
  name: string;
  slug?: string;
};

export default function OrgFormsPage({
  params,
}: {
  params: { orgId: string };
}) {
  const { orgId } = params; // pode ser id ou slug
  const [org, setOrg] = useState<Org | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        // Força ativar org e obtém lista de orgs para nome
        const orgsRes = await fetch("/api/organizations", { credentials: "include" });
        const orgsData: Org[] = orgsRes.ok ? await orgsRes.json() : [];
        const foundOrg =
          orgsData.find((o) => o.id === orgId) ||
          orgsData.find((o) => o.slug === orgId) ||
          null;
        setOrg(foundOrg);

        if (!foundOrg) {
          setError("Workspace não encontrado ou sem acesso.");
          setTemplates([]);
          return;
        }

        const switchRes = await fetch("/api/organizations/switch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ orgId: foundOrg.id }),
        });
        const switchJson = switchRes.ok ? await switchRes.json() : {};
        if (!switchRes.ok) {
          setError(switchJson.error || "Não foi possível ativar o workspace.");
          setTemplates([]);
          return;
        }

        const tmplRes = await fetch("/api/templates", { credentials: "include" });
        const tmplJson = await tmplRes.json();
        if (!tmplRes.ok) {
          setError(tmplJson.error || "Não foi possível carregar formulários.");
          setTemplates([]);
          return;
        }
        setTemplates(tmplJson.templates || []);
      } catch {
        setError("Erro ao carregar formulários.");
        setTemplates([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [orgId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/workspace">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Link>
          </Button>
          <p className="text-xs uppercase tracking-wide text-primary font-semibold">
            Formulários do workspace
          </p>
        </div>
        <p className="text-xs text-muted-foreground">ID: {orgId}</p>
      </div>

      <Card className="mx-auto max-w-5xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-4 w-4" />
            {org ? org.name : "Carregando..."}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando formulários...
            </p>
          )}
          {!loading && error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          {!loading && !error && templates.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhum formulário publicado neste workspace.
            </p>
          )}
          <div className="grid gap-3 md:grid-cols-2">
            {templates.map((template) => (
              <div
                key={template.id}
                className="flex items-center justify-between rounded-lg border bg-muted/50 px-3 py-2"
              >
                <div className="space-y-1">
                  <p className="text-sm font-semibold">{template.name}</p>
                  <p className="text-xs text-muted-foreground">ID: {template.id}</p>
                  <p className="text-xs text-muted-foreground">Status: {template.status}</p>
                </div>
                <Button asChild size="sm">
                  <Link href={`/workspace/${orgId}/formulario/${template.id}`}>Abrir</Link>
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
