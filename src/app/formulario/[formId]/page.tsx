"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RoteiroForm } from "@/components/roteiro-form";

type Template = {
  id: string;
  name: string;
  status: string;
};

export default function FormDetailPage({
  params,
}: {
  params: { formId: string };
}) {
  const { formId } = params;
  const [template, setTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/templates", { credentials: "include" });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Não foi possível carregar o formulário.");
          setTemplate(null);
        } else {
          const found = (data.templates || []).find((t: Template) => t.id === formId);
          if (!found) {
            setError("Formulário não encontrado neste workspace.");
            setTemplate(null);
          } else {
            setTemplate(found);
          }
        }
      } catch {
        setError("Não foi possível carregar o formulário.");
        setTemplate(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [formId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/formulario">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Link>
          </Button>
          <p className="text-xs uppercase tracking-wide text-primary font-semibold">
            Formulário
          </p>
        </div>
        <p className="text-xs text-muted-foreground">ID: {formId}</p>
      </div>

      <Card className="mx-auto max-w-4xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-4 w-4" />
            {template ? template.name : "Carregando..."}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando formulário...
            </p>
          )}
          {!loading && error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          {!loading && !error && template && (
            <RoteiroForm forceTemplateId={template.id} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
