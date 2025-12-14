"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Factory, FileDown, Shield, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/lib/auth-client";
import { ROTEIRO_TEMPLATE_NAME } from "@/lib/templates/roteiro-template";

type Org = {
  id: string;
  name: string;
  slug: string;
  role: string;
  active?: boolean;
};

type Template = {
  id: string;
  name: string;
  status: string;
  pdfTemplateFileRef: string;
  schemaJson: any;
};

type Submission = {
  id: string;
  templateId: string;
  createdAt: string;
};

export default function DashboardPage() {
  const { data: session, isPending } = useSession();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [tenantName, setTenantName] = useState("");
  const [tenantSlug, setTenantSlug] = useState("");
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refreshOrgs = useCallback(async () => {
    const res = await fetch("/api/organizations", { credentials: "include" });
    const data = await res.json();
    setOrgs(data || []);
    const active = data.find((org: Org) => org.active) ?? data[0];
    setActiveOrgId(active?.id ?? null);
  }, []);

  const refreshTemplates = useCallback(async () => {
    const res = await fetch("/api/templates", { credentials: "include" });
    if (!res.ok) return;
    const data = await res.json();
    setTemplates(data.templates || []);
  }, []);

  const refreshSubmissions = useCallback(async () => {
    const res = await fetch("/api/submissions", { credentials: "include" });
    if (!res.ok) return;
    const data = await res.json();
    setSubmissions(data.submissions || []);
  }, []);

  useEffect(() => {
    if (!session) return;
    (async () => {
      await fetch("/api/post-signin", { method: "POST" });
      await refreshOrgs();
    })();
  }, [session, refreshOrgs]);

  useEffect(() => {
    if (!activeOrgId) return;
    const timer = setTimeout(() => {
      refreshTemplates();
      refreshSubmissions();
    }, 0);
    return () => clearTimeout(timer);
  }, [activeOrgId, refreshSubmissions, refreshTemplates]);

  const activeTemplate = useMemo(() => {
    return templates[0];
  }, [templates]);

  const templateSections = useMemo(() => {
    return (activeTemplate?.schemaJson?.sections as any[]) || [];
  }, [activeTemplate]);

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
            <CardTitle className="text-2xl">Precisa entrar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-muted-foreground">
              Faça login com o Google para acessar o workspace multi-tenant.
            </p>
            <Button asChild>
              <Link href="/">Voltar</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  async function createTenant(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    const res = await fetch("/api/organizations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: tenantName, slug: tenantSlug || undefined }),
    });
    const data = await res.json();
    if (res.ok) {
      setMessage("Tenant criado e ativado.");
      setTenantName("");
      setTenantSlug("");
      await refreshOrgs();
      await refreshTemplates();
    } else {
      setMessage(data.error || "Falha ao criar tenant");
    }
    setLoading(false);
  }

  async function switchTenant(orgId: string) {
    setLoading(true);
    await fetch("/api/organizations/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId }),
    });
    setActiveOrgId(orgId);
    await refreshTemplates();
    await refreshSubmissions();
    setLoading(false);
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    if (!activeTemplate) return;
    setLoading(true);
    setMessage(null);
    const res = await fetch("/api/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        templateId: activeTemplate.id,
        data: formData,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setMessage("Submissão salva. Exporte pelo endpoint /export.");
      setFormData({});
      await refreshSubmissions();
    } else {
      setMessage(data.error || "Erro ao salvar submissão");
    }
    setLoading(false);
  }

  return (
    <div className="container mx-auto px-4 py-10 space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-primary font-semibold">
            Workspace
          </p>
          <h1 className="text-3xl font-semibold">Roteiro de visita</h1>
          <p className="text-muted-foreground">
            Tenant isolado, RBAC no servidor e overlay no PDF original.
          </p>
        </div>
        <div className="flex gap-2" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Tenants e papéis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Selecionar tenant</Label>
              <div className="flex flex-wrap gap-2">
                {orgs.map((org) => (
                  <Button
                    key={org.id}
                    variant={org.active ? "default" : "outline"}
                    size="sm"
                    onClick={() => switchTenant(org.id)}
                  >
                    {org.name} ({org.role})
                  </Button>
                ))}
                {orgs.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Nenhum tenant ainda. Crie abaixo.
                  </p>
                )}
              </div>
            </div>
            <form onSubmit={createTenant} className="grid gap-3">
              <div className="grid gap-1">
                <Label htmlFor="tenantName">Nome</Label>
                <Input
                  id="tenantName"
                  value={tenantName}
                  onChange={(e) => setTenantName(e.target.value)}
                  placeholder="Ex: Acme Seguros"
                  required
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="tenantSlug">Slug (opcional)</Label>
                <Input
                  id="tenantSlug"
                  value={tenantSlug}
                  onChange={(e) => setTenantSlug(e.target.value)}
                  placeholder="acme"
                />
              </div>
              <Button type="submit" disabled={loading}>
                Criar e ativar tenant
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Permissões críticas
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm text-muted-foreground">
            <p>
              OWNER: tudo. ADMIN: gerencia tenant, usuários e templates. MANAGER:
              cria/edita/publica e mapeia; exporta submissões. AGENT: cria e
              visualiza submissões.
            </p>
            <div className="rounded-lg border bg-muted/60 p-3">
              <p className="font-semibold text-foreground">Endpoints chave</p>
              <ul className="list-disc list-inside">
                <li>/api/templates — CRUD + publish</li>
                <li>/api/templates/[id]/map — salvar coordenadas</li>
                <li>/api/submissions — criar/listar</li>
                <li>/api/submissions/[id]/export — PDF idêntico</li>
                <li>/api/pdf/diff — checar pixel diff</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Factory className="h-4 w-4" />
            Template publicado
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {activeTemplate ? (
            <>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="rounded-full bg-primary/10 px-3 py-1 font-semibold text-primary">
                  {activeTemplate.name || ROTEIRO_TEMPLATE_NAME}
                </span>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">
                  {activeTemplate.status}
                </span>
                <span className="text-muted-foreground">
                  PDF: {activeTemplate.pdfTemplateFileRef}
                </span>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border bg-muted/60 p-4">
                  <p className="text-sm font-semibold text-foreground">
                    Campos e sessões
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {templateSections.length} blocos prontos, alinhados ao PDF
                    “Roteiro de visita”.
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/60 p-4">
                  <p className="text-sm font-semibold text-foreground">
                    PDF base
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Coloque o arquivo original em{" "}
                    <code>public/templates/Roteiro_de_Visita_44134649.pdf</code>{" "}
                    para overlay funcionar.
                  </p>
                </div>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">
              Nenhum template carregado para este tenant. Verifique permissões.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Preencha e salve uma submissão
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeTemplate ? (
            <form onSubmit={submitForm} className="space-y-6">
              {templateSections.map((section) => (
                <div key={section.id} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{section.title}</p>
                    {section.description && (
                      <span className="text-xs text-muted-foreground">
                        {section.description}
                      </span>
                    )}
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    {section.fields?.map((field: any) => {
                      const value = formData[field.key] || "";
                      const fullWidth = field.width === "full";
                      const FieldComponent =
                        field.type === "textarea" ? Textarea : Input;

                      const input = (
                        <FieldComponent
                          id={field.key}
                          value={value}
                          onChange={(e: any) =>
                            setFormData((prev) => ({
                              ...prev,
                              [field.key]: e.target.value,
                            }))
                          }
                          required={field.required}
                          placeholder={field.label}
                        />
                      );

                      if (field.type === "select") {
                        return (
                          <div
                            key={field.key}
                            className={fullWidth ? "md:col-span-2 grid gap-1" : "grid gap-1"}
                          >
                            <Label htmlFor={field.key}>{field.label}</Label>
                            <select
                              id={field.key}
                              className="rounded-md border bg-background px-3 py-2 text-sm"
                              value={value}
                              onChange={(e) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  [field.key]: e.target.value,
                                }))
                              }
                            >
                              <option value="">Selecione</option>
                              {field.options?.map((opt: string) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={field.key}
                          className={fullWidth ? "md:col-span-2 grid gap-1" : "grid gap-1"}
                        >
                          <Label htmlFor={field.key}>{field.label}</Label>
                          {input}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-3">
                <Button type="submit" disabled={loading}>
                  Salvar submissão
                </Button>
                <p className="text-sm text-muted-foreground">
                  Exporte via GET /api/submissions/[id]/export após salvar.
                </p>
              </div>
              {message && (
                <p className="text-sm text-primary" role="status">
                  {message}
                </p>
              )}
            </form>
          ) : (
            <p className="text-muted-foreground text-sm">
              Nenhum template ativo para este tenant.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileDown className="h-4 w-4" />
            Últimas submissões
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {submissions.length === 0 && (
            <p className="text-sm text-muted-foreground">Nada por aqui ainda.</p>
          )}
          {submissions.map((sub) => (
            <div
              key={sub.id}
              className="flex flex-wrap items-center justify-between rounded-lg border bg-muted/50 px-3 py-2 text-sm"
            >
              <div className="flex flex-col">
                <span className="font-semibold">#{sub.id.slice(0, 8)}</span>
                <span className="text-muted-foreground">
                  {new Date(sub.createdAt).toLocaleString("pt-BR")}
                </span>
              </div>
              <div className="flex gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link href={`/api/submissions/${sub.id}/export`}>
                    Baixar PDF
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
