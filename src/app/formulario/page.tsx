"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FileText, Loader2 } from "lucide-react";
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
  active?: boolean;
};

export default function FormularioPage() {
  const [activeOrgName, setActiveOrgName] = useState<string | null>(null);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);
  const [loadingOrg, setLoadingOrg] = useState(true);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/organizations", { credentials: "include" });
        if (!res.ok) {
          setActiveOrgName(null);
          setActiveOrgId(null);
          return;
        }
        const data: Org[] = await res.json();
        const active = data.find((org) => org.active) ?? data[0];
        setActiveOrgName(active?.name ?? null);
        setActiveOrgId(active?.id ?? null);
      } finally {
        setLoadingOrg(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!activeOrgId) {
      setTemplates([]);
      return;
    }
    (async () => {
      setLoadingTemplates(true);
      setError(null);
      try {
        const res = await fetch("/api/templates", { credentials: "include" });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Não foi possível carregar formulários.");
          setTemplates([]);
        } else {
          setTemplates(data.templates || []);
        }
      } catch {
        setError("Não foi possível carregar formulários.");
        setTemplates([]);
      } finally {
        setLoadingTemplates(false);
      }
    })();
  }, [activeOrgId]);

  return (
    <div className="space-y-4">
      <Card className="mx-auto max-w-4xl border-primary/30 bg-primary/5">
        <CardContent className="flex flex-col gap-2 px-4 py-4">
          <p className="text-xs uppercase tracking-wide text-primary font-semibold">
            Workspace ativo
          </p>
          {loadingOrg ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : activeOrgName ? (
            <p className="text-sm text-foreground">
              Você está usando o workspace <span className="font-semibold">{activeOrgName}</span>.
            </p>
          ) : (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span>Nenhum workspace ativo. Selecione em /workspace.</span>
              <Button asChild size="sm" variant="outline">
                <a href="/workspace">Ir para Workspace</a>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mx-auto max-w-5xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-4 w-4" />
            Formulários disponíveis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loadingTemplates && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando formulários...
            </p>
          )}
          {!loadingTemplates && error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          {!loadingTemplates && !error && templates.length === 0 && (
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
                  <Link href={`/formulario/${template.id}`}>Abrir</Link>
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
