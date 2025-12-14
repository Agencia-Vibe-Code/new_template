# Roteiro Builder – Multi-tenant RBAC Form + PDF Overlay

Aplicação completa para construir, preencher e exportar o formulário “Roteiro de visita” com isolamento por tenant e permissões server-side. Todo o boilerplate anterior foi removido.

## Stack
- Next.js 16 (App Router) + TypeScript
- Better Auth (Google OAuth)
- Drizzle ORM + PostgreSQL
- shadcn/ui + Tailwind v4
- PDF overlay com `pdf-lib` e utilitário de diff (pdfjs-dist + pixelmatch + canvas)

## Fluxo rápido
1) **Env vars** (`.env.local`):
```
POSTGRES_URL=postgres://...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
NEXT_PUBLIC_APP_URL=http://localhost:3000
OPENAI_API_KEY=...            # opcional
OPENAI_MODEL=gpt-5-mini       # use sempre env, não hardcode
```
2) **Migrations**:
```bash
pnpm install         # ou npm install
pnpm run db:migrate
pnpm run db:seed:permissions
```
3) **PDF base**: coloque o arquivo original em `public/templates/Roteiro_de_Visita_44134649.pdf`.
4) **Suba**: `pnpm dev` e acesse `/dashboard`.

## Funcionalidades
- **Multi-tenant**: `organization` + `tenantId` em todas as tabelas novas. Tenant resolvido por `X-Tenant-Id`, `/o/:slug`, subdomínio ou `lastActiveOrgId`.
- **RBAC**: papéis OWNER/ADMIN/MANAGER/AGENT. Permissões: `form:create/edit/publish/map`, `submission:create/view/export`, `user:manage`, `tenant:manage`.
- **Template pronto**: seed automático do “Roteiro de visita” com schema em `schema_json` e mapping inicial em `pdf_field_map`.
- **Submissão**: formulário dinâmico no `/dashboard` salva em `submission` com `tenantId`.
- **Export**: `/api/submissions/:id/export` gera PDF usando o arquivo original como fundo (pdf-lib) e registra em `export_log`.
- **Diff**: `/api/pdf/diff` (usa canvas/pdfjs-dist/pixelmatch/pngjs).

## Endpoints principais
- `GET/POST /api/organizations` — criar tenant (OWNER) e listar memberships (marca ativo).
- `POST /api/organizations/switch` — define `lastActiveOrgId`.
- `GET/POST /api/templates` — lista/seed e cria template (permissão `form:create`).
- `PATCH /api/templates/:id` — editar/publicar (`form:edit`/`form:publish`).
- `POST /api/templates/:id/map` — salva mapping (`form:map`).
- `GET/POST /api/submissions` — lista/cria submissões (`submission:view`/`submission:create`).
- `GET /api/submissions/:id/export` — gera PDF (`submission:export`).
- `POST /api/pdf/diff` — diff visual (`MANAGER`+).

## Rotas de UI
- `/` — landing focada no fluxo de formulário/PDF.
- `/dashboard` — ativa/gera tenant, mostra template e permite criar submissão.
- `/profile` — contexto do usuário e tenants ativos.

## Desenvolvimento
- Scripts úteis:
  - `pnpm dev` — dev server
  - `pnpm run db:migrate` — aplicar migrations (inclui tabelas form/pdf/submission/export)
  - `pnpm run db:seed:permissions` — popula permissões usadas pelo RBAC
  - `pnpm test:rbac` — testes de permissão/hierarquia
- Dependências opcionais para diff: `pnpm add canvas pdfjs-dist pixelmatch pngjs`

## Observabilidade e segurança
- Permissões checadas server-side em todos os endpoints (via `requireOrgAccess` + `hasPermission`).
- Logs de export em `export_log` com `tenantId` e `exportedBy`.
- Input validado com `zod` em rotas críticas.

## Calibração e validação
1) Salve e gere submissão no `/dashboard`.
2) Baixe PDF em `/api/submissions/:id/export`.
3) Rode diff chamando `/api/pdf/diff` com o PDF exportado em base64 (opcional).

## Referências
- Tabelas e schema: `src/lib/schema.ts` + `drizzle/0005_form_builder_core.sql`
- RBAC: `src/lib/rbac.ts`, `src/lib/org-guard.ts`
- Template e seed: `src/lib/templates/roteiro-template.ts`, `src/lib/form-service.ts`
- Export/diff: `src/lib/pdf/export.ts`, `src/lib/pdf/diff.ts`
