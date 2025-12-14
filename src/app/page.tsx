import Link from "next/link";
import { BadgeCheck, FileDown, LockKeyhole, Radar } from "lucide-react";
import { Button } from "@/components/ui/button";

const pillars = [
  {
    title: "Multi-tenant de verdade",
    description:
      "Tenant resolvido por subdomínio ou header, com consultas filtradas e índices únicos por inquilino.",
    icon: Radar,
  },
  {
    title: "RBAC pragmático",
    description:
      "Papéis OWNER/ADMIN/MANAGER/AGENT com checagem server-side e permissões para formulário, submissão e export.",
    icon: LockKeyhole,
  },
  {
    title: "PDF overlay pixel-perfect",
    description:
      "Usa o PDF original como camada de fundo e aplica valores nas coordenadas do mapeamento calibrado.",
    icon: FileDown,
  },
  {
    title: "Pronto para produção",
    description:
      "Autenticação Better Auth + Drizzle + testes de RBAC e utilitário de diff de PDF.",
    icon: BadgeCheck,
  },
];

export default function Home() {
  return (
    <main className="container mx-auto px-4 py-14">
      <section className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] items-center">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            Roteiro de visita • Form builder multi-tenant
          </div>
          <h1 className="text-4xl md:text-5xl font-semibold leading-tight">
            Formulário, RBAC e PDF{" "}
            <span className="bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent">
              sem vestígios de boilerplate
            </span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            Suba um tenant, publique o template do roteiro, calibre as
            coordenadas e exporte um PDF idêntico ao original. Tudo isolado por
            subdomínio ou header `X-Tenant-Id`.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/workspace">Abrir workspace</Link>
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {pillars.map((pillar) => (
              <div
                key={pillar.title}
                className="rounded-xl border bg-card/60 p-4 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <pillar.icon className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="font-semibold">{pillar.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {pillar.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border bg-card/60 p-6 shadow-lg">
          <p className="text-sm font-semibold text-primary mb-2">
            Blueprint de implantação
          </p>
          <ol className="space-y-4 text-sm text-muted-foreground">
            <li>
              <span className="font-semibold text-foreground">1. Tenant</span>{" "}
              Crie um tenant (slug) no dashboard ou envie `X-Tenant-Id` no
              header. Todas as queries são filtradas por `tenantId`.
            </li>
            <li>
              <span className="font-semibold text-foreground">2. RBAC</span>{" "}
              OWNER/ADMIN/MANAGER/AGENT, com permissões: form:create/edit/publish/map,
              submission:create/view/export, user:manage, tenant:manage.
            </li>
            <li>
              <span className="font-semibold text-foreground">3. Template</span>{" "}
              O modelo “Roteiro de visita” já vem cadastrado; basta subir o PDF
              em `public/templates/` (mapeamento padrão aplicado).
            </li>
            <li>
              <span className="font-semibold text-foreground">4. Export</span>{" "}
              Gere o PDF via overlay no endpoint `/api/submissions/:id/export`
              e valide com `/api/pdf/diff`.
            </li>
          </ol>
          <div className="mt-6 rounded-lg bg-muted/70 p-4 text-sm">
            <p className="font-semibold text-foreground mb-1">
              Environment crítico
            </p>
            <ul className="space-y-1">
              <li>
                <code>POSTGRES_URL</code>
              </li>
              <li>
                <code>GOOGLE_CLIENT_ID</code> / <code>GOOGLE_CLIENT_SECRET</code>
              </li>
              <li>
                <code>OPENAI_MODEL</code> e <code>OPENAI_API_KEY</code> (para
                features de AI opcionais)
              </li>
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}
