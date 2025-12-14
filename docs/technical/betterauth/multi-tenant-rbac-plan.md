# Plano de Implementação: Multi-Tenant RBAC com Better Auth

**Data:** 2025-01-27  
**Stack:** Next.js 16, Better Auth, Drizzle ORM, PostgreSQL  
**Baseado em:** Recomendações oficiais do Better Auth MCP

---

## 📋 Visão Geral

Este documento detalha o plano de implementação de um sistema multi-tenant com Role-Based Access Control (RBAC) usando Better Auth, seguindo as melhores práticas recomendadas.

### Objetivos
- ✅ Isolamento completo de dados entre tenants (organizações)
- ✅ Sistema de roles e permissões flexível
- ✅ Integração nativa com Better Auth
- ✅ Escalável e seguro

---

## 🏗️ Arquitetura

### Modelo de Tenancy Escolhido

**Shared Database, Shared Schema com Row-Level Security (RLS)**

- ✅ Mais rápido de implementar
- ✅ Menor overhead operacional
- ✅ PostgreSQL RLS garante isolamento no nível do banco
- ✅ Fácil de escalar horizontalmente

### Componentes Principais

1. **Organizations (Tenants)**
   - Cada organização é um tenant isolado
   - Suporte a subdomínios ou path-based routing
   - Domínios verificados para SSO

2. **Memberships**
   - Relacionamento usuário-organização
   - Roles por organização
   - Status de membro (active, pending, suspended)

3. **RBAC System**
   - Roles: Owner, Admin, Member, Custom
   - Permissions granulares
   - Permissões por tenant

4. **Session Context**
   - Active organization no JWT/session
   - Role no contexto ativo
   - Validação em cada request

---

## 📊 Schema do Banco de Dados

### Novas Tabelas Necessárias

```typescript
// src/lib/schema.ts - Adições necessárias

// 1. Organizations (Tenants)
export const organization = pgTable("organization", {
  id: text("id").primaryKey(), // UUID
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(), // Para subdomínios
  domain: text("domain"), // Domínio verificado para SSO
  domainVerifiedAt: timestamp("domain_verified_at"),
  createdBy: text("created_by")
    .notNull()
    .references(() => user.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  // Campo opcional para extensibilidade futura
  metadata: jsonb("metadata"), // Para dados customizados por organização
}, (table) => [
  index("org_slug_idx").on(table.slug),
  index("org_domain_idx").on(table.domain),
]);

// 2. Organization Memberships
export const organizationMembership = pgTable("organization_membership", {
  id: text("id").primaryKey(), // UUID
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("member"), // owner | admin | member | custom
  status: text("status").notNull().default("active"), // active | pending | suspended
  invitedBy: text("invited_by").references(() => user.id),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}, (table) => [
  index("org_membership_org_user_idx").on(table.organizationId, table.userId),
  index("org_membership_user_idx").on(table.userId),
  // Índices compostos para consultas frequentes
  index("org_membership_org_user_status_idx").on(
    table.organizationId, 
    table.userId, 
    table.status
  ),
  index("org_membership_org_status_idx").on(
    table.organizationId, 
    table.status
  ),
  // Unique constraint: user can only have one membership per org
  unique("org_membership_unique").on(table.organizationId, table.userId),
]);

// 3. Organization Invitations
export const organizationInvitation = pgTable("organization_invitation", {
  id: text("id").primaryKey(), // UUID
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: text("role").notNull().default("member"),
  token: text("token").notNull().unique(),
  invitedBy: text("invited_by")
    .notNull()
    .references(() => user.id),
  expiresAt: timestamp("expires_at").notNull(),
  acceptedAt: timestamp("accepted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("org_invitation_token_idx").on(table.token),
  index("org_invitation_org_idx").on(table.organizationId),
  index("org_invitation_email_idx").on(table.email),
]);

// 4. Roles (para RBAC customizado)
export const role = pgTable("role", {
  id: text("id").primaryKey(), // UUID
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // Ex: "project_manager", "viewer"
  description: text("description"),
  isSystem: boolean("is_system").default(false).notNull(), // owner, admin, member são system
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}, (table) => [
  index("role_org_idx").on(table.organizationId),
  // Unique: role name per organization
  unique("role_org_name_unique").on(table.organizationId, table.name),
]);

// 5. Permissions
export const permission = pgTable("permission", {
  id: text("id").primaryKey(), // UUID
  name: text("name").notNull().unique(), // Ex: "project:create", "user:delete"
  description: text("description"),
  resource: text("resource").notNull(), // Ex: "project", "user", "organization"
  action: text("action").notNull(), // Ex: "create", "read", "update", "delete"
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("permission_resource_action_idx").on(table.resource, table.action),
  // Unique: permission name must be unique globally
  unique("permission_name_unique").on(table.name),
]);

// 6. Role Permissions (Many-to-Many)
export const rolePermission = pgTable("role_permission", {
  id: text("id").primaryKey(), // UUID
  roleId: text("role_id")
    .notNull()
    .references(() => role.id, { onDelete: "cascade" }),
  permissionId: text("permission_id")
    .notNull()
    .references(() => permission.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("role_permission_role_idx").on(table.roleId),
  index("role_permission_permission_idx").on(table.permissionId),
  // Unique: role can't have duplicate permissions
  unique("role_permission_unique").on(table.roleId, table.permissionId),
]);

// 7. User Roles (para roles customizados por usuário)
export const userRole = pgTable("user_role", {
  id: text("id").primaryKey(), // UUID
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  roleId: text("role_id")
    .notNull()
    .references(() => role.id, { onDelete: "cascade" }),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  assignedBy: text("assigned_by").references(() => user.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("user_role_user_org_idx").on(table.userId, table.organizationId),
  index("user_role_role_idx").on(table.roleId),
  // Unique: user can't have duplicate role assignments in same org
  unique("user_role_unique").on(table.userId, table.roleId, table.organizationId),
]);
```

### Modificações em Tabelas Existentes

**Adicionar `lastActiveOrgId` na tabela User:**

```typescript
// src/lib/schema.ts - Modificação na tabela user
export const user = pgTable("user", {
  // ... campos existentes
  lastActiveOrgId: text("last_active_org_id")
    .references(() => organization.id, { onDelete: "set null" }),
});
```

Todas as tabelas de negócio precisarão adicionar `organizationId`:

```typescript
// Exemplo: se houver tabela de projetos
export const project = pgTable("project", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  // ... outros campos
}, (table) => [
  index("project_org_idx").on(table.organizationId),
]);
```

**Nota sobre Soft Delete (Opcional):**

Para auditoria e recuperação, considere adicionar `deletedAt` em tabelas críticas:

```typescript
// Exemplo: organization com soft delete
deletedAt: timestamp("deleted_at"), // null = ativo, timestamp = deletado
```

---

## 🔐 Row-Level Security (RLS) - PostgreSQL

### Habilitar RLS

```sql
-- Habilitar RLS em todas as tabelas tenant-scoped
ALTER TABLE organization ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_membership ENABLE ROW LEVEL SECURITY;
ALTER TABLE project ENABLE ROW LEVEL SECURITY;
-- ... todas as outras tabelas com organizationId
```

### Políticas RLS

```sql
-- Função helper para obter org atual do contexto
CREATE OR REPLACE FUNCTION app.current_org_id() 
RETURNS TEXT AS $$
  SELECT current_setting('app.current_org_id', true);
$$ LANGUAGE sql STABLE;

-- Política para organization_membership
CREATE POLICY org_membership_isolation ON organization_membership
  FOR ALL
  USING (
    organization_id::text = app.current_org_id() OR
    user_id::text = current_setting('app.user_id', true)
  );

-- Política para projects (exemplo)
CREATE POLICY project_isolation ON project
  FOR ALL
  USING (organization_id::text = app.current_org_id());

-- Política para organization (usuários só veem orgs que são membros)
CREATE POLICY org_isolation ON organization
  FOR SELECT
  USING (
    id::text IN (
      SELECT organization_id FROM organization_membership 
      WHERE user_id::text = current_setting('app.user_id', true)
    )
  );
```

### Configurar Contexto por Request

**⚠️ IMPORTANTE:** Em aplicações com connection pooling, `SET` é por conexão, não por transação. Isso pode causar vazamento de contexto entre requests. Use uma das abordagens abaixo:

**Opção 1: Usar `SET LOCAL` em Transações (Recomendado)**

```typescript
// src/lib/db-context.ts
import { db } from "./db";
import { sql } from "drizzle-orm";

export async function withOrgContext<T>(
  orgId: string,
  userId: string,
  fn: () => Promise<T>
): Promise<T> {
  return await db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL app.current_org_id = ${orgId}`);
    await tx.execute(sql`SET LOCAL app.user_id = ${userId}`);
    return await fn();
  });
}

// Função helper para queries simples
export async function setOrgContext(orgId: string, userId: string) {
  // DEPRECATED: Use withOrgContext para operações em transação
  // Mantido apenas para compatibilidade, mas não recomendado
  await db.execute(sql`SET LOCAL app.current_org_id = ${orgId}`);
  await db.execute(sql`SET LOCAL app.user_id = ${userId}`);
}
```

**Opção 2: Filtros Explícitos (Mais Seguro)**

Não confiar apenas em RLS; sempre adicionar filtros explícitos:

```typescript
// Sempre filtrar explicitamente por organizationId
const projects = await db
  .select()
  .from(project)
  .where(
    and(
      eq(project.organizationId, orgId), // Filtro explícito obrigatório
      // RLS como camada adicional de segurança
    )
  );
```

---

## 🔑 Better Auth Integration

### 1. Extender Session com Active Organization

```typescript
// src/lib/auth.ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";
import { getServerEnv } from "@/lib/env";

const env = getServerEnv();

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
  },
  // Hooks para enriquecer sessão
  hooks: {
    after: [
      {
        matcher: (ctx) => ctx.path === "/sign-in",
        handler: async (ctx) => {
          // Após login, definir org padrão do usuário
          // ou manter última org ativa usando lastActiveOrgId
        },
      },
    ],
  },
  // Session claims customizados
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 dias
    updateAge: 60 * 60 * 24, // Atualizar a cada 24h
    // Nota: activeOrgId não deve ser armazenado apenas na sessão
    // Usar contexto por request (subdomain/URL/header) como fonte primária
    // lastActiveOrgId no user record como fallback
  },
});
```

**Nota sobre Session Extension:**

Seguindo recomendações do Better Auth MCP:
1. Usar contexto por request (subdomain/URL/header) como fonte primária de organização
2. Manter `lastActiveOrgId` no user record como fallback
3. Não depender apenas de sessão para contexto de organização (evita problemas de concorrência com múltiplas abas)
4. Implementar endpoint de switch que atualiza `lastActiveOrgId` e retorna contexto atualizado

### 1.1. Validação de Domínio para SSO

Quando uma organização configura um domínio customizado para SSO, é necessário validar o ownership:

```typescript
// src/lib/domain-verification.ts
import { z } from "zod";
import { randomBytes } from "crypto";

const domainSchema = z.string()
  .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i, "Invalid domain format")
  .toLowerCase()
  .trim();

export async function verifyDomainOwnership(domain: string): Promise<boolean> {
  // Validar formato
  const parsed = domainSchema.safeParse(domain);
  if (!parsed.success) {
    return false;
  }
  
  // Opção 1: Verificar via DNS TXT record
  // Criar token único e verificar se está no TXT record do domínio
  const verificationToken = randomBytes(16).toString("hex");
  
  // Salvar token temporário no banco (expira em 24h)
  // await saveVerificationToken(orgId, domain, verificationToken);
  
  // Instruir usuário a adicionar TXT record: _verification.{domain} = {token}
  // Verificar via DNS lookup
  
  // Opção 2: Verificar via arquivo HTML
  // Criar arquivo de verificação e instruir usuário a hospedar em {domain}/.well-known/verification.html
  
  return true; // Implementar lógica real
}

// Endpoint para iniciar verificação
// POST /api/organizations/[orgId]/domain/verify
// {
//   "domain": "example.com"
// }
// Retorna: { token: "...", instructions: "..." }
```

### 2. Middleware para Resolução de Tenant

```typescript
// src/lib/tenant-resolver.ts
import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getServerEnv } from "@/lib/env";
import { db } from "@/lib/db";
import { organization } from "@/lib/schema";
import { eq } from "drizzle-orm";

const env = getServerEnv();

export async function resolveTenant(req: NextRequest): Promise<string | null> {
  // Estratégia 1: Header (mais seguro, usado por middleware)
  const orgIdFromHeader = req.headers.get("x-org-id");
  if (orgIdFromHeader) {
    return orgIdFromHeader;
  }
  
  // Estratégia 2: Path segment (/o/:orgId ou /o/:slug)
  const pathname = req.nextUrl.pathname;
  const orgIdentifierFromPath = pathname.match(/^\/o\/([^\/]+)/)?.[1];
  
  if (orgIdentifierFromPath) {
    // Pode ser orgId (UUID) ou slug - verificar no banco
    const org = await db
      .select()
      .from(organization)
      .where(
        eq(organization.id, orgIdentifierFromPath) || 
        eq(organization.slug, orgIdentifierFromPath)
      )
      .limit(1);
    
    if (org[0]) {
      return org[0].id;
    }
  }
  
  // Estratégia 3: Subdomain (com validação de segurança)
  const hostname = req.headers.get("host") || "";
  
  // Validar hostname contra lista de domínios permitidos
  const allowedDomains = [
    env.NEXT_PUBLIC_APP_URL?.replace(/^https?:\/\//, ""),
    // Adicionar outros domínios permitidos se necessário
  ].filter(Boolean) as string[];
  
  const isValidHost = allowedDomains.some(domain => 
    hostname === domain || hostname.endsWith(`.${domain}`)
  );
  
  if (isValidHost) {
    const subdomain = hostname.split(".")[0];
    if (subdomain && subdomain !== "www" && subdomain !== "app") {
      // Verificar se subdomain corresponde a um slug válido
      const org = await db
        .select()
        .from(organization)
        .where(eq(organization.slug, subdomain))
        .limit(1);
      
      if (org[0]) {
        return org[0].id;
      }
    }
  }
  
  // Estratégia 4: Fallback - lastActiveOrgId do usuário
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user) {
    // Buscar lastActiveOrgId do user record
    // (implementar query para buscar do banco)
    // return user.lastActiveOrgId;
  }
  
  return null;
}
```

**Next.js Proxy para Resolução Automática (Next.js 16):**

```typescript
// src/proxy.ts
// Nota: org context NÃO é obrigatório para todas as rotas /api/*.
// Rotas globais (ex: /api/auth, /api/diagnostics, webhooks/health) devem ser isentas.
import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { resolveTenant } from "./lib/tenant-resolver";

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

const ORG_ID_HEADER = "x-org-id";
const ORG_ID_PROXY_MARKER_HEADER = "x-org-id-proxy";

const GLOBAL_API_PREFIXES = [
  "/api/auth",
  "/api/diagnostics",
  "/api/health",
  "/api/webhook",
  "/api/webhooks",
  "/api/post-signin",
] as const;

function isGlobalApiRoute(pathname: string): boolean {
  return GLOBAL_API_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
}

function requiresSession(pathname: string): boolean {
  return (
    matchesPrefix(pathname, "/dashboard") ||
    matchesPrefix(pathname, "/chat") ||
    matchesPrefix(pathname, "/profile")
  );
}

function requiresOrgContext(pathname: string): boolean {
  return (
    matchesPrefix(pathname, "/dashboard") ||
    matchesPrefix(pathname, "/chat") ||
    (matchesPrefix(pathname, "/api") && !isGlobalApiRoute(pathname))
  );
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Nunca confiar em headers de contexto enviados pelo cliente.
  const sanitizedHeaders = new Headers(request.headers);
  sanitizedHeaders.delete(ORG_ID_HEADER);
  sanitizedHeaders.delete(ORG_ID_PROXY_MARKER_HEADER);

  if (requiresSession(pathname) && !getSessionCookie(request)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (!requiresOrgContext(pathname)) {
    return NextResponse.next({
      request: { headers: sanitizedHeaders },
    });
  }

  const orgId = await resolveTenant(request, sanitizedHeaders);
  if (!orgId && matchesPrefix(pathname, "/api")) {
    return NextResponse.json(
      { error: "Organization context required" },
      { status: 400 }
    );
  }

  if (orgId) {
    sanitizedHeaders.set(ORG_ID_HEADER, orgId);
    sanitizedHeaders.set(ORG_ID_PROXY_MARKER_HEADER, "1");
  }

  return NextResponse.next({
    request: { headers: sanitizedHeaders },
  });
}

export const config = {
  matcher: ["/api/:path*", "/dashboard/:path*", "/chat/:path*", "/profile/:path*"],
};
```

### 3. Guard de Autorização

```typescript
// src/lib/org-guard.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { organizationMembership } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { resolveTenant } from "./tenant-resolver";
import { setOrgContext } from "@/lib/db-context";

export async function requireOrgAccess(
  req: NextRequest,
  requiredRole?: "owner" | "admin" | "member"
) {
  const session = await auth.api.getSession({ headers: await headers() });
  
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  const orgId = await resolveTenant(req);
  
  if (!orgId) {
    return NextResponse.json(
      { error: "Organization context required" },
      { status: 400 }
    );
  }
  
  // Verificar membership
  const membership = await db
    .select()
    .from(organizationMembership)
    .where(
      and(
        eq(organizationMembership.organizationId, orgId),
        eq(organizationMembership.userId, session.user.id),
        eq(organizationMembership.status, "active")
      )
    )
    .limit(1);
  
  if (!membership[0]) {
    return NextResponse.json(
      { error: "Not a member of this organization" },
      { status: 403 }
    );
  }
  
  // Verificar role se necessário
  if (requiredRole) {
    const roleHierarchy = { owner: 3, admin: 2, member: 1 };
    const userRoleLevel = roleHierarchy[membership[0].role as keyof typeof roleHierarchy] || 0;
    const requiredLevel = roleHierarchy[requiredRole];
    
    if (userRoleLevel < requiredLevel) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }
  }
  
  // NOTA: Não usar setOrgContext aqui - usar filtros explícitos
  // setOrgContext deve ser usado apenas dentro de transações com SET LOCAL
  
  return {
    orgId,
    membership: membership[0],
    session,
  };
}
```

---

## 🛠️ API Routes (Fase 4 implementada)

Contexto comum das rotas:
- O proxy `src/proxy.ts` remove headers de contexto enviados pelo cliente e reinjeta `x-org-id` + `x-org-id-proxy=1` somente após `resolveTenant` validar header, path, subdomínio (lista segura de domínios) ou `lastActiveOrgId`.
- `requireOrgAccess` valida sessão, membership `active` e hierarquia mínima antes de entrar em cada handler.
- Rate limiting usa `src/lib/rate-limit.ts` com Redis (`REDIS_URL`) em janela fixa; falha se `REDIS_URL` não estiver configurado.
- IDs são `randomUUID()` e tokens de convite usam `randomBytes(32).toString("base64url")`.

### /api/organizations (`src/app/api/organizations/route.ts`)
- `GET`: exige sessão; retorna organizações onde o usuário é membro com `id`, `name`, `slug`, `role`, `joinedAt`.
- `POST`: valida `name`/`slug` com Zod + `slugifyName`, verifica unicidade de slug, rate limit `org:create:<userId>` (5/h), cria `organization` + membership `owner` em transação e retorna `id`, `name`, `slug`, `remaining` (status 201).

### /api/organizations/[orgId]/switch (`src/app/api/organizations/[orgId]/switch/route.ts`)
- `POST`: requer sessão; confirma membership `active` no org alvo; atualiza `user.lastActiveOrgId`; retorna `{ success, organizationId }`.

### /api/organizations/[orgId]/members (`src/app/api/organizations/[orgId]/members/route.ts`)
- `GET`: usa `requireOrgAccess`; valida query `status` (default `active`) e `limit` (default 50, máx 100); exige permissão `member:read` (presente por padrão em members); ordena por `joinedAt ASC` e retorna membros com `role`, `status`, `invitedBy`, `name`, `email`.

### /api/organizations/[orgId]/members/[userId] (`src/app/api/organizations/[orgId]/members/[userId]/route.ts`)
- `PUT`: requer `admin+`; body `role` ∈ {owner, admin, member}; apenas owners podem promover para owner; rate limit `member:update:<actorUserId>:<orgId>` (50/h).
- Transação protege último owner (`COUNT` de owners ativos antes de rebaixar) e retorna membership atualizado + `remaining`.

### /api/organizations/[orgId]/invitations (`src/app/api/organizations/[orgId]/invitations/route.ts`)
- `POST`: requer `admin+`; apenas owners podem convidar owners; body Zod `email`/`role`; rate limit `invite:create:<actorUserId>:<orgId>` (20/h).
- Gera token base64url 256 bits, expira em 7 dias, cria convite em transação e retorna `id`, `email`, `role`, `expiresAt`, `remaining` (status 201).

### /api/invitations/[token]/accept (`src/app/api/invitations/[token]/accept/route.ts`)
- `POST`: exige sessão; valida token, expiração e aceita convites não processados.
- Email da sessão deve bater com o email do convite; transação cria membership (se não existir) com `role` do convite, marca `acceptedAt` e atualiza `user.lastActiveOrgId`; retorna `{ organizationId, role }`.

### Tabela rápida de contratos (fase 4)

| Método/Path | Auth/Context | Request | Respostas principais |
| --- | --- | --- | --- |
| GET `/api/organizations` | Sessão | — | 200 `{ id, name, slug, role, joinedAt }[]` ; 401 |
| POST `/api/organizations` | Sessão | JSON `{ name, slug? }` | 201 `{ id, name, slug, remaining }` ; 400 validação ; 409 slug ; 429 rate |
| POST `/api/organizations/[orgId]/switch` | Sessão + membership ativa | — | 200 `{ success, organizationId }` ; 401/403 |
| GET `/api/organizations/[orgId]/members` | Sessão + membership ativa | Query `status?`, `limit?` | 200 `{ organizationId, members[] }` ; 400 validação ; 403 permissão |
| PUT `/api/organizations/[orgId]/members/[userId]` | Sessão + `admin+` | JSON `{ role }` | 200 `{ membership, remaining }` ; 400 validação/último owner ; 403 permissão ; 404 |
| POST `/api/organizations/[orgId]/invitations` | Sessão + `admin+` | JSON `{ email, role? }` | 201 `{ id, email, role, expiresAt, remaining }` ; 400 ; 403 owner-only ; 429 |
| POST `/api/invitations/[token]/accept` | Sessão | — | 200 `{ organizationId, role }` ; 400 já aceita ; 401 ; 403 email mismatch ; 404 ; 410 expirada |

### Rate limiting (Redis) — env vars e estratégia
- Obrigatório: `REDIS_URL` (ex.: `redis://default:<password>@host:port/0`)
- Estratégia: janela fixa (fixed window) por rota/chave; TTL = `windowMs` do handler
- Prefixo usado: `ratelimit` (`ratelimit:<key>:<windowId>`)
- Erro de configuração lança exception clara no helper `src/lib/rate-limit.ts`
- `REDIS_URL` já está listado em `env.example`

---

## 📝 Checklist de Implementação

### Fase 1: Fundação (Sprint 1) ✅ CONCLUÍDA
- [x] Criar migrations para novas tabelas
  - ✅ Migration `0002_light_mentor.sql` criada com todas as tabelas
  - ✅ Foreign key para `lastActiveOrgId` adicionada na migration
- [x] Implementar schema Drizzle para organizations
  - ✅ Tabela `organization` criada com todos os campos necessários
  - ✅ Índices para `slug` e `domain` criados
- [x] Implementar schema para memberships
  - ✅ Tabela `organizationMembership` criada
  - ✅ Índices compostos implementados
- [x] Implementar schema para invitations
  - ✅ Tabela `organizationInvitation` criada
- [x] Adicionar `lastActiveOrgId` na tabela user
  - ✅ Campo adicionado no schema
  - ✅ Foreign key constraint adicionada na migration
- [x] Adicionar índices compostos para consultas frequentes
  - ✅ Índices compostos criados para `organization_membership`
  - ✅ Índices criados para todas as tabelas relacionadas
- [x] Configurar RLS no PostgreSQL (usar SET LOCAL ou filtros explícitos)
  - ✅ Script `drizzle/rls-setup.sql` criado com todas as políticas RLS
  - ✅ Funções helper `app.current_org_id()` e `app.current_user_id()` criadas
- [x] Implementar `withOrgContext` para transações seguras
  - ✅ Arquivo `src/lib/db-context.ts` criado
  - ✅ Função `withOrgContext` implementada usando `SET LOCAL` em transações
- [x] Implementar rate limiting básico
  - ✅ Arquivo `src/lib/rate-limit.ts` agora usa Redis (fixed window) com `REDIS_URL`
- [x] Testar isolamento básico
  - ✅ Script `scripts/test-isolation.ts` criado para testes básicos

### Fase 2: Better Auth Integration (Sprint 2) ✅ CONCLUÍDA (com ajustes)
- [x] Estender configuração do Better Auth (usar `getServerEnv()`)
  - ✅ Implementado em `src/lib/auth.ts`
- [ ] Implementar hooks para enriquecer sessão
  - ⚠️ Hooks nativos não estão disponíveis na versão atual; substituído por `POST /api/post-signin` + `resolveOrCreateDefaultOrg()`
- [x] Implementar `lastActiveOrgId` no user record
  - ✅ `src/app/api/post-signin/route.ts` atualiza `lastActiveOrgId`
  - ✅ `resolveOrCreateDefaultOrg()` faz fallback e persiste quando aplicável
- [x] Criar Proxy (em vez de middleware) para resolução automática de tenant
  - ✅ Implementado em `src/proxy.ts` (injecta `x-org-id`/`x-org-id-proxy` com headers sanitizados)
  - ✅ Org context aplicado apenas em APIs org-scoped; rotas globais isentas (ex: `/api/auth`, `/api/diagnostics`, webhooks/health)
- [x] Implementar `resolveTenant` com validação de hostname
  - ✅ Implementado em `src/lib/tenant-resolver.ts` (cache + validação de domínios permitidos)
- [x] Implementar org-guard com filtros explícitos
  - ✅ Implementado em `src/lib/org-guard.ts` (sem `SET` fora de transações)

### Fase 3: RBAC Core (Sprint 3)
- [x] Criar schema para roles e permissions
  - ✅ Tabelas `role`, `permission`, `role_permission` e `user_role` consolidadas em `src/lib/schema.ts` + migration `drizzle/0002_light_mentor.sql`
- [x] Implementar seed de permissões padrão (script completo)
  - ✅ Script `scripts/seed-permissions.ts` idempotente com 18 permissões base (`pnpm run db:seed:permissions`)
- [x] Criar funções hasPermission/requirePermission (lógica corrigida)
  - ✅ `src/lib/rbac.ts` com owner bypass, restrições de admin e checagem de roles customizados
- [x] Implementar `getDefaultMemberPermissions()`
  - ✅ `DEFAULT_MEMBER_PERMISSIONS` usado como fallback para membros sem roles customizadas
- [x] Implementar role hierarchy
  - ✅ `ROLE_HIERARCHY` + helpers `hasMinimumRole`/`requireRole`
- [x] Testes de autorização
  - ✅ `pnpm test:rbac` passa após lazy-load do `db` em `src/lib/rbac.ts` (evita exigir env em testes)
  - ⚠️ Cobertura atual: owner/admin/member + roles customizados; adicionar casos negativos de org/role mismatch e permissões restritas extras
- [x] Integridade cruzada role/user_role por tenant
  - ✅ FK composta `user_role_role_org_fk` garante `user_role.organization_id` = `role.organization_id` (migration `0004`)
  - ✅ `role_id_org_unique` em `role` permite a FK composta

**Alinhamento com documentação Better Auth (Organization plugin/RBAC)**
- Active organization nasce como `null`; seguir docs do plugin de organização e manter alternância de organização preferencialmente em client-side ou via endpoint dedicado, sem depender apenas da sessão (respeita suporte a múltiplas abas).
- Aproveitar hooks `beforeCreateOrganization`/`afterCreateOrganization` do plugin para criar roles/policies padrão logo após `POST /api/organizations`, evitando step manual.
- Usar a ação `api.hasPermission`/`authClient.hasPermission` como camada fina sobre `hasPermission` local para checagens server/client, mantendo estrutura `{ resource: [actions] }` compatível com o plugin.
- Para SSO enterprise, mapear domínios ou atributos do provedor para `organization provisioning`, garantindo criação/atribuição automática de membership e roles ao vincular provedores (conforme docs do plugin de SSO).
- Garantir que a lista de permissões padrão inclui `team:create|update|delete` se times forem habilitados, alinhado às permissões recomendadas em Teams do plugin de organização.

### Fase 4: API Routes (Sprint 4)
- [x] GET /api/organizations (listar) - com validação
- [x] POST /api/organizations (criar) - com validação Zod, rate limiting, verificação de slug
- [x] POST /api/organizations/[orgId]/switch - atualizar lastActiveOrgId
- [x] GET /api/organizations/[orgId]/members - com validação
- [x] POST /api/organizations/[orgId]/invitations - com validação email, tokens seguros, rate limiting, transação
- [x] POST /api/invitations/[token]/accept - com transação
- [x] PUT /api/organizations/[orgId]/members/[userId] - atualizar role com transação
- [x] Todas as rotas: validação de entrada com Zod
- [x] Todas as rotas: rate limiting apropriado
- [x] Todas as operações críticas: transações

### Fase 5: UI Components (Sprint 5)
- [ ] Organization switcher component
- [ ] Organization creation form
- [ ] Member management UI
- [ ] Invitation flow UI
- [ ] Permission-based UI rendering
- [ ] Integrar endpoint `/api/post-signin` no fluxo de sign-in do cliente

### Fase 6: Segurança e Testes (Sprint 6)
- [ ] Testes de isolamento (cross-tenant access)
- [ ] Testes de RBAC
- [ ] Auditoria de ações críticas (implementar logging)
- [ ] Rate limiting por organização (já implementado na Fase 1, revisar)
- [ ] Documentação de API
- [ ] Testes de validação de entrada
- [ ] Testes de rate limiting
- [ ] Testes específicos de validação de hostname (diferentes configurações e casos de borda)
- [ ] Logging de tentativas de hostname inválido para auditoria e segurança

---

## 🔒 Considerações de Segurança

1. **Isolamento de Dados**
   - Sempre usar RLS ou filtros explícitos
   - Nunca confiar apenas em client-side
   - Validar orgId em cada request

2. **Autorização**
   - Verificar membership antes de qualquer operação
   - Validar permissions antes de ações críticas
   - Log de todas as mudanças de role/permission

3. **Session Management**
   - Rotacionar tokens ao trocar organização
   - Invalidar sessões ao remover membership
   - Timeout apropriado para sessões

4. **Invitations**
   - Tokens únicos e expiráveis (gerar com alta entropia: `randomBytes(32)` ou `nanoid(32)`)
   - Validação de email (formato e domínio com Zod)
   - Rate limiting de convites
   - Transações para aceitar convites (criar membership + atualizar invitation)

5. **Validação de Entrada**
   - Sempre validar entrada com schemas (Zod) antes de processar
   - Retornar erros 400 com detalhes de validação
   - Sanitizar strings (trim, lowercase quando apropriado)

6. **Connection Pooling e RLS**
   - Nunca usar `SET` global em aplicações com pooling
   - Usar `SET LOCAL` dentro de transações ou filtros explícitos
   - RLS como camada adicional, não única

---

## 📚 Referências

- Better Auth Documentation
- PostgreSQL Row-Level Security: https://www.postgresql.org/docs/current/ddl-rowsecurity.html
- Drizzle ORM Documentation
- OWASP Multi-Tenancy: https://owasp.org/www-community/Multi-Tenancy

---

## 📋 Casos de Borda e Tratamento de Erros

### Casos de Borda Críticos

1. **Último Owner de uma Organização**
   - Não permitir remover último owner
   - Exigir transferência de ownership antes de remover
   - Implementar endpoint de transferência de ownership

2. **Transferência de Ownership**
   - Validar que transferidor é owner atual
   - Transferir ownership e rebaixar para admin
   - Registrar em log de auditoria

3. **Convites Expirados ou Inválidos**
   - Validar token e expiração antes de aceitar
   - Retornar erro claro se expirado
   - Limpar convites expirados periodicamente (cron job)

4. **Usuário Removido com Convites Pendentes**
   - Ao remover usuário, cancelar convites criados por ele
   - Notificar organizações afetadas

5. **Dados Existentes sem Organização**
   - Criar organização padrão para usuários existentes
   - Migrar dados órfãos para organização padrão
   - Documentar processo de migração

### Limites e Quotas

Definir limites por organização:
- **Membros:** Máximo de membros por organização (ex: 100)
- **Convites:** Máximo de convites pendentes (ex: 50)
- **Organizações por usuário:** Máximo de organizações que um usuário pode criar (ex: 10)
- **Rate Limits:**
  - Criação de organização: 5 por hora
  - Convites: 20 por hora
  - Mudanças de role: 50 por hora

### Plano de Migração de Dados Existentes

1. **Fase de Preparação**
   - Criar migrations para novas tabelas
   - Adicionar `organizationId` em tabelas existentes (nullable inicialmente)

2. **Migração de Usuários**
   - Para cada usuário existente:
     - Criar organização padrão (nome: "{Nome do Usuário}'s Organization")
     - Criar membership como owner
     - Atualizar `lastActiveOrgId`

3. **Migração de Dados**
   - Para cada registro sem `organizationId`:
     - Associar à organização padrão do criador
     - Se criador não tiver organização, criar uma

4. **Validação**
   - Verificar que todos os registros têm `organizationId`
   - Tornar `organizationId` NOT NULL após migração
   - Testar isolamento de dados

### Guia de Auditoria

**Eventos Críticos a Serem Logados:**

1. **Organizações**
   - Criação, atualização, exclusão
   - Mudança de ownership
   - Verificação de domínio

2. **Memberships**
   - Criação, atualização de role, remoção
   - Mudança de status (active/pending/suspended)

3. **Convites**
   - Criação, aceitação, expiração, cancelamento

4. **Permissões**
   - Criação/remoção de roles customizados
   - Atribuição/remoção de permissões a roles
   - Atribuição/remoção de roles a usuários

5. **Ações Críticas**
   - Tentativas de acesso não autorizado
   - Tentativas de acesso cross-tenant
   - Rate limit exceeded

**Formato de Log:**
```typescript
{
  timestamp: Date,
  userId: string,
  organizationId: string,
  action: string,
  resource: string,
  resourceId?: string,
  metadata?: Record<string, unknown>,
  ipAddress?: string,
  userAgent?: string,
}
```

### Seed de Permissões Padrão

Criar script `scripts/seed-permissions.ts`:

```typescript
// Permissões padrão do sistema
const defaultPermissions = [
  // Organization
  { name: "organization:read", resource: "organization", action: "read" },
  { name: "organization:update", resource: "organization", action: "update" },
  { name: "organization:delete", resource: "organization", action: "delete" },
  { name: "organization:transfer", resource: "organization", action: "transfer" },
  
  // Members
  { name: "member:read", resource: "member", action: "read" },
  { name: "member:invite", resource: "member", action: "invite" },
  { name: "member:update", resource: "member", action: "update" },
  { name: "member:remove", resource: "member", action: "remove" },
  
  // Projects (exemplo)
  { name: "project:create", resource: "project", action: "create" },
  { name: "project:read", resource: "project", action: "read" },
  { name: "project:update", resource: "project", action: "update" },
  { name: "project:delete", resource: "project", action: "delete" },
  
  // Users
  { name: "user:read", resource: "user", action: "read" },
  // ... adicionar outras conforme necessário
];
```

### Exemplo de Endpoint de Convite com Todas as Melhorias

```typescript
// src/app/api/organizations/[orgId]/invitations/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";
import { requireOrgAccess } from "@/lib/org-guard";
import { db } from "@/lib/db";
import { organizationInvitation } from "@/lib/schema";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(20, "1 h"), // 20 convites por hora
});

const invitationSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  role: z.enum(["owner", "admin", "member"]).default("member"),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { orgId: string } }
) {
  const result = await requireOrgAccess(req, "admin"); // Apenas admin+ pode convidar
  
  if (result instanceof NextResponse) {
    return result;
  }
  
  // Rate limiting
  const { success } = await ratelimit.limit(result.session.user.id);
  if (!success) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429 }
    );
  }
  
  // Validar entrada
  const body = await req.json();
  const parsed = invitationSchema.safeParse(body);
  
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  
  const { email, role } = parsed.data;
  
  // Gerar token seguro
  const token = randomBytes(32).toString("base64url"); // 256 bits de entropia
  
  // Criar convite em transação
  const invitation = await db.transaction(async (tx) => {
    const invitationId = nanoid();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Expira em 7 dias
    
    const [invitation] = await tx
      .insert(organizationInvitation)
      .values({
        id: invitationId,
        organizationId: params.orgId,
        email,
        role,
        token,
        invitedBy: result.session.user.id,
        expiresAt,
      })
      .returning();
    
    return invitation;
  });
  
  // Enviar email de convite (implementar serviço de email)
  // await sendInvitationEmail(email, token, result.orgId);
  
  return NextResponse.json({ id: invitation.id, email, expiresAt: invitation.expiresAt });
}
```

---

## 🚀 Otimizações Futuras (Pós-Fase 6)

Estas otimizações não são críticas para o funcionamento básico, mas devem ser consideradas para ambientes de produção em escala:

### Cache Distribuído
- [ ] Implementar cache distribuído (Redis) para lista de domínios permitidos
  - Atualmente: cache em memória (invalidado apenas na reinicialização)
  - Benefício: compartilhamento de cache entre múltiplas instâncias da aplicação
  - Quando: quando houver múltiplas instâncias ou necessidade de invalidar cache dinamicamente

### Monitoramento e Observabilidade
- [ ] Métricas de performance para resolução de tenant
- [ ] Alertas para padrões suspeitos de hostname inválido
- [ ] Dashboard de auditoria para tentativas de acesso inválido

### Documentação
- [ ] Documentar estratégias de resolução de tenant em detalhes
- [ ] Guia de troubleshooting para problemas de resolução de tenant
- [ ] Exemplos de configuração para diferentes ambientes (dev, staging, prod)

---

**Próximos Passos:** 
1. Avançar para Fase 5 (UI): switcher de organização, fluxo de criação, gestão de membros/convites e renderização condicionada por permissão.
2. Expandir Fase 6 (testes): casos negativos cross-tenant, demote do último owner, rate limits e validação de hostname/subdomínio.
3. Trocar rate limiting in-memory por backend distribuído (Redis/Upstash/KV) antes de produção e documentar configuração.
