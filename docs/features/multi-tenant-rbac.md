# Multi-tenant & RBAC

## O que faz
- Isola todos os dados por tenant (organization) usando `tenantId` nas tabelas de formulário, submissão e export.
- Resolve o tenant por header `X-Tenant-Id` (via middleware/proxy), slug (`/o/:slug`), subdomínio ou `lastActiveOrgId`.
- Enforce RBAC server-side com papéis OWNER, ADMIN, MANAGER, AGENT e permissões específicas para criar/publicar templates, mapear PDF e exportar submissões.

## Como funciona
- Tabelas principais: `organization`, `organization_membership`, `role`, `permission`, `role_permission`, `user_role`, `form_template`, `pdf_field_map`, `submission`, `export_log`.
- `src/lib/rbac.ts` define a hierarquia de papéis e mapa de permissões (`form:create/edit/publish/map`, `submission:create/view/export`, `user:manage`, `tenant:manage`).
- Guardas:
  - `requireOrgAccess` valida sessão, resolve tenant e checa papel mínimo.
  - `hasPermission` consulta `organization_membership` + papéis customizados em `role_permission`.
- Endpoints sensíveis usam `requireOrgAccess` + `hasPermission` (ex: templates, map, submissions, diff).
- Criação de tenant (`POST /api/organizations`) atribui papel OWNER e já define `lastActiveOrgId`.
- Troca de tenant (`POST /api/organizations/switch`) persiste o tenant ativo para o usuário.

## Componentes e arquivos
- `src/lib/rbac.ts` — regras de permissão e hierarquia de papéis.
- `src/lib/org-guard.ts` — valida sessão e papel mínimo por rota.
- `src/lib/tenant-resolver.ts` — resolve tenant a partir de header, slug, subdomínio ou fallback.
- API: `src/app/api/organizations/*`, `src/app/api/templates/*`, `src/app/api/submissions/*`, `src/app/api/pdf/diff/route.ts`.
- UI: seleção/ativação de tenant em `src/app/dashboard/page.tsx` e resumo em `src/app/profile/page.tsx`.

## Uso
1) Autentique-se (Better Auth) e chame `POST /api/post-signin` para garantir `lastActiveOrgId`.
2) Crie um tenant via `/api/organizations` (ou pelo formulário no dashboard).
3) Para trocar de tenant, chame `POST /api/organizations/switch` com `orgId` ou envie `X-Tenant-Id` no header das requisições.
4) Cada rota protegida verificará papel + permissão correspondente.

## Configuração
- Garanta `NEXT_PUBLIC_APP_URL` para validação de host/subdomínio em `tenant-resolver`.
- Rode `pnpm run db:migrate` para aplicar as tabelas novas.
- Rode `pnpm run db:seed:permissions` para popular as permissões com os nomes esperados pelo RBAC.

## Decisões de design
- Papéis do domínio ficam em `organization_membership.role` (OWNER/ADMIN/MANAGER/AGENT) para consultas rápidas; papéis customizados seguem em `role`/`user_role`.
- Verificações são sempre server-side; componentes client apenas chamam os endpoints.
- Fallback para `lastActiveOrgId` evita dependência obrigatória de subdomínio e facilita desenvolvimento local.
