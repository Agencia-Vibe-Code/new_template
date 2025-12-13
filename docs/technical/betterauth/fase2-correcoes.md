# Revisão de Código: Fase 2 - Better Auth Integration

**Data:** 2025-01-27  
**Projeto:** Novo Roteiro - Multi-Tenant RBAC  
**Revisor:** AI Assistant  
**Tipo de Revisão:** Technical - Phase 2 Implementation Review  
**Fase Revisada:** Fase 2 - Better Auth Integration (Sprint 2)

---

## 📊 Resumo Executivo

Esta revisão analisa a implementação da **Fase 2: Better Auth Integration** do plano multi-tenant RBAC. A fase inclui integração do Better Auth com contexto de organização, resolução automática de tenant via middleware, e guards de autorização.

### Stack Tecnológica Identificada
- **Framework:** Next.js 16 com App Router
- **Autenticação:** Better Auth
- **ORM:** Drizzle ORM
- **Banco de Dados:** PostgreSQL
- **Validação:** Zod (via `getServerEnv()`)
- **TypeScript:** 5.x

### Escopo da Revisão
- ✅ `src/lib/auth.ts` - Configuração do Better Auth
- ✅ `src/middleware.ts` - Middleware de resolução de tenant
- ✅ `src/lib/tenant-resolver.ts` - Lógica de resolução de organização
- ✅ `src/lib/org-guard.ts` - Guard de autorização
- ✅ `src/lib/schema.ts` - Schema do banco (campo `lastActiveOrgId`)
- ✅ `src/lib/env.ts` - Validação de variáveis de ambiente
- ✅ `src/lib/db-context.ts` - Contexto de organização para RLS

### Status da Implementação

| Item | Status | Observações |
|------|--------|-------------|
| Estender configuração do Better Auth (usar `getServerEnv()`) | ✅ **Completo** | Implementado corretamente |
| Implementar hooks para enriquecer sessão | ❌ **Pendente** | Comentado no código, não implementado |
| Implementar `lastActiveOrgId` no user record | ✅ **Completo** | Campo adicionado no schema |
| Criar Next.js Middleware para resolução automática de tenant | ✅ **Completo** | Implementado com validação |
| Implementar `resolveTenant` com validação de hostname | ⚠️ **Parcial** | Implementado mas com problemas de segurança |
| Implementar org-guard com filtros explícitos | ✅ **Completo** | Implementado corretamente |

---

## ✅ Resultados de Lint e Typecheck

### Comandos Executados
```bash
pnpm run lint      # ESLint
pnpm run typecheck # TypeScript compiler
```

### Resumo dos Resultados
- ✅ **Lint:** Sem erros
- ✅ **Typecheck:** Sem erros

### Análise
O código está limpo de erros de lint e TypeScript. A tipagem está correta e não há problemas de sintaxe.

---

## 📚 Lições Relevantes de Revisões Anteriores

As seguintes lições aprendidas são relevantes para esta fase:

### LL-006 – Uso de Variáveis de Ambiente sem Validação Centralizada
- ✅ **Aplicado:** `src/lib/auth.ts` usa `getServerEnv()` corretamente
- ⚠️ **Atenção:** `src/lib/tenant-resolver.ts` linha 56 acessa `process.env.NEXT_PUBLIC_APP_URL` diretamente

### LL-009 – Host Header Injection em Resolução de Tenant
- ⚠️ **Problema Identificado:** `resolveTenant` valida hostname mas pode ter vulnerabilidades
- 🔴 **Crítico:** Validação de hostname precisa ser mais rigorosa

### LL-007 – Row-Level Security com Connection Pooling
- ✅ **Aplicado:** `db-context.ts` usa `SET LOCAL` dentro de transações corretamente
- ✅ **Aplicado:** `org-guard.ts` usa filtros explícitos, não depende apenas de RLS

---

## 🔍 Revisão de Requisitos ("O quê")

### Funcionalidades Identificadas

#### 1. Configuração do Better Auth ✅
**Arquivo:** `src/lib/auth.ts`

**Status:** ✅ Implementado corretamente

**Análise:**
- Usa `getServerEnv()` para validação de variáveis de ambiente
- Configuração de OAuth condicional (apenas se credenciais estiverem presentes)
- Session configurada com expiração de 7 dias
- **Problema:** Hooks comentados, não implementados

```1:27:src/lib/auth.ts
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { db } from "./db"
import { getServerEnv } from "./env"

const env = getServerEnv()

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  socialProviders: env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
    ? {
        google: {
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
        },
      }
    : undefined,
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 dias
    updateAge: 60 * 60 * 24, // Atualizar a cada 24h
  },
  // Hooks serão implementados quando necessário
  // Nota: A lógica de definir lastActiveOrgId será feita
  // no endpoint de switch de organização
})
```

#### 2. Hooks para Enriquecer Sessão ❌
**Status:** ❌ Não implementado

**Problema:** Hooks estão comentados e não implementados. Segundo o Better Auth MCP, hooks devem ser implementados para:
- Definir organização padrão após sign-in
- Enriquecer sessão com contexto de organização

**Recomendação:** Implementar hooks conforme orientação do Better Auth MCP.

#### 3. Campo `lastActiveOrgId` no User ✅
**Arquivo:** `src/lib/schema.ts`

**Status:** ✅ Implementado corretamente

```22:22:src/lib/schema.ts
    lastActiveOrgId: text("last_active_org_id"),
```

**Análise:**
- Campo adicionado corretamente no schema
- Foreign key constraint será adicionada na migration (conforme comentário)

#### 4. Middleware de Resolução de Tenant ✅
**Arquivo:** `src/middleware.ts`

**Status:** ✅ Implementado corretamente

**Análise:**
- Middleware resolve tenant automaticamente
- Adiciona `x-org-id` header para uso em route handlers
- Trata rotas de API e páginas diferentemente (erro 400 vs redirect)
- Matcher configurado corretamente

```20:44:src/middleware.ts
export async function middleware(request: NextRequest) {
  // Resolver tenant (passar headers do request para evitar await headers() no middleware)
  const orgId = await resolveTenant(request, request.headers);

  // Se rota protegida e orgId não encontrado, redirecionar
  if (isProtectedRoute(request.nextUrl.pathname) && !orgId) {
    // Para rotas de API, retornar erro 400
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Organization context required" },
        { status: 400 }
      );
    }
    // Para rotas de página, redirecionar para home
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Adicionar orgId ao header para uso em route handlers
  const response = NextResponse.next();
  if (orgId) {
    response.headers.set("x-org-id", orgId);
  }

  return response;
}
```

#### 5. Resolução de Tenant ⚠️
**Arquivo:** `src/lib/tenant-resolver.ts`

**Status:** ⚠️ Implementado mas com problemas

**Análise:**
- Implementa 4 estratégias de resolução (header, path, subdomain, fallback)
- **Problema 1:** Acessa `process.env` diretamente (linha 56) em vez de usar `getClientEnv()`
- **Problema 2:** Validação de hostname pode ser melhorada (ver LL-009)
- **Problema 3:** Lógica de subdomain pode ser explorada se validação falhar

```51:82:src/lib/tenant-resolver.ts
  // Estratégia 3: Subdomain (com validação de segurança)
  const hostname = req.headers.get("host") || "";

  // Validar hostname contra lista de domínios permitidos
  // NEXT_PUBLIC_APP_URL é uma variável client-side, mas pode ser acessada no servidor também
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const allowedDomains = [
    appUrl?.replace(/^https?:\/\//, ""),
    // Adicionar outros domínios permitidos se necessário
  ]
    .filter(Boolean)
    .map((domain) => domain as string);

  const isValidHost = allowedDomains.some(
    (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
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
```

#### 6. Org Guard com Filtros Explícitos ✅
**Arquivo:** `src/lib/org-guard.ts`

**Status:** ✅ Implementado corretamente

**Análise:**
- Usa filtros explícitos (não depende apenas de RLS)
- Valida membership e role corretamente
- Retorna tipos apropriados (NextResponse ou OrgAccessResult)
- Hierarquia de roles implementada corretamente

```42:75:src/lib/org-guard.ts
  // Verificar membership com filtros explícitos
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
    const userRoleLevel =
      roleHierarchy[membership[0].role as keyof typeof roleHierarchy] || 0;
    const requiredLevel = roleHierarchy[requiredRole];

    if (userRoleLevel < requiredLevel) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }
  }
```

---

## 🏗️ Revisão de Arquitetura ("Como")

### Estrutura do Projeto

A arquitetura está bem organizada:

1. **Separação de Responsabilidades:**
   - `auth.ts` - Configuração do Better Auth
   - `tenant-resolver.ts` - Lógica de resolução de tenant
   - `org-guard.ts` - Autorização e validação
   - `middleware.ts` - Integração com Next.js

2. **Padrões de Design:**
   - ✅ Strategy Pattern: Múltiplas estratégias de resolução de tenant
   - ✅ Guard Pattern: `requireOrgAccess` valida acesso antes de processar
   - ✅ Dependency Injection: Funções recebem dependências como parâmetros

3. **Escalabilidade:**
   - ✅ Resolução de tenant é eficiente (queries otimizadas)
   - ✅ Middleware é executado apenas em rotas necessárias
   - ⚠️ Validação de hostname pode ser otimizada (cache de domínios permitidos)

---

## 🔒 Revisão de Segurança

### Vulnerabilidades Identificadas

#### 🔴 Crítico: Host Header Injection (LL-009)

**Arquivo:** `src/lib/tenant-resolver.ts`  
**Linha:** 52-82  
**Severidade:** 🔴 Crítico

**Problema:**
A validação de hostname pode ser contornada se:
1. `NEXT_PUBLIC_APP_URL` não estiver configurado corretamente
2. Atacante conseguir manipular o header `Host`
3. Lista de domínios permitidos estiver vazia ou mal configurada

**Impacto:**
- Acesso não autorizado a organizações
- Bypass de autenticação por contexto
- Possível escalação de privilégios

**Recomendação:**
1. Usar `getClientEnv()` em vez de `process.env` direto
2. Validar que lista de domínios não está vazia
3. Adicionar logging de tentativas de hostname inválido
4. Considerar usar path-based routing como alternativa mais segura

**Código Sugerido:**
```typescript
import { getClientEnv } from "@/lib/env";

// No início da função resolveTenant
const clientEnv = getClientEnv();
const allowedDomains = [
  clientEnv.NEXT_PUBLIC_APP_URL.replace(/^https?:\/\//, ""),
  // Adicionar outros domínios permitidos
].filter(Boolean);

if (allowedDomains.length === 0) {
  console.error("No allowed domains configured for tenant resolution");
  return null; // Rejeitar se não houver domínios configurados
}

// Validar hostname
const isValidHost = allowedDomains.some(
  (domain) => {
    const normalizedDomain = domain.toLowerCase().trim();
    const normalizedHostname = hostname.toLowerCase().trim();
    return normalizedHostname === normalizedDomain || 
           normalizedHostname.endsWith(`.${normalizedDomain}`);
  }
);

if (!isValidHost) {
  // Log tentativa de hostname inválido (para auditoria)
  console.warn(`Invalid hostname attempted: ${hostname}`);
  return null;
}
```

#### 🟠 Alto: Acesso Direto a process.env

**Arquivo:** `src/lib/tenant-resolver.ts`  
**Linha:** 56  
**Severidade:** 🟠 Alto

**Problema:**
Acessa `process.env.NEXT_PUBLIC_APP_URL` diretamente em vez de usar `getClientEnv()`.

**Impacto:**
- Violação de LL-006
- Validação inconsistente
- Possível valor `undefined` em runtime

**Recomendação:**
Usar `getClientEnv()` para acessar variáveis de ambiente do cliente.

#### 🟡 Médio: Falta de Hooks no Better Auth

**Arquivo:** `src/lib/auth.ts`  
**Linha:** 24-26  
**Severidade:** 🟡 Médio

**Problema:**
Hooks não estão implementados. Isso significa que:
- Organização padrão não é definida após sign-in
- Sessão não é enriquecida com contexto de organização
- Usuário pode precisar fazer switch manual após cada login

**Impacto:**
- UX degradada (usuário precisa selecionar organização manualmente)
- Possível confusão se usuário não tiver organização padrão

**Recomendação:**
Implementar hooks conforme orientação do Better Auth MCP (fornecida na revisão).

---

## ⚡ Revisão de Performance

### Problemas de Performance

#### 🟡 Médio: Query Duplicada em resolveTenant

**Arquivo:** `src/lib/tenant-resolver.ts`  
**Linha:** 35-48, 72-80

**Problema:**
Se a estratégia 2 (path) falhar, a estratégia 3 (subdomain) faz query similar. Se ambas falharem, a estratégia 4 (fallback) faz outra query.

**Impacto:**
- Múltiplas queries ao banco em casos de falha
- Latência aumentada

**Recomendação:**
Considerar cache de resultados ou otimizar ordem de estratégias.

#### 🟢 Baixo: Validação de Hostname Pode Ser Otimizada

**Arquivo:** `src/lib/tenant-resolver.ts`  
**Linha:** 64-66

**Problema:**
Validação de hostname é feita a cada request, mesmo que lista de domínios não mude.

**Recomendação:**
Cachear lista de domínios permitidos (validar apenas na inicialização ou mudança de config).

---

## 🐛 Problemas Identificados

### Críticos

- [ ] **CRI-001:** Host Header Injection em `resolveTenant`
  - **Arquivo:** `src/lib/tenant-resolver.ts`
  - **Linha:** 52-82
  - **Impacto:** Acesso não autorizado a organizações
  - **Recomendação:** Melhorar validação de hostname, usar `getClientEnv()`, adicionar logging
  - **Prioridade:** 🔴 Imediata

### Altos

- [ ] **ALT-001:** Acesso direto a `process.env` em `tenant-resolver.ts`
  - **Arquivo:** `src/lib/tenant-resolver.ts`
  - **Linha:** 56
  - **Impacto:** Violação de LL-006, validação inconsistente
  - **Recomendação:** Usar `getClientEnv()` em vez de `process.env`
  - **Prioridade:** 🟠 Alta

### Médios

- [ ] **MED-001:** Hooks do Better Auth não implementados
  - **Arquivo:** `src/lib/auth.ts`
  - **Linha:** 24-26
  - **Impacto:** UX degradada, organização padrão não definida após sign-in
  - **Recomendação:** Implementar hooks conforme Better Auth MCP
  - **Prioridade:** 🟡 Média

- [ ] **MED-002:** Queries duplicadas em `resolveTenant`
  - **Arquivo:** `src/lib/tenant-resolver.ts`
  - **Linha:** 35-48, 72-80
  - **Impacto:** Performance degradada em casos de falha
  - **Recomendação:** Otimizar ordem de estratégias ou adicionar cache
  - **Prioridade:** 🟡 Média

### Baixos

- [ ] **BAI-001:** Validação de hostname pode ser otimizada
  - **Arquivo:** `src/lib/tenant-resolver.ts`
  - **Linha:** 64-66
  - **Impacto:** Validação repetida desnecessariamente
  - **Recomendação:** Cachear lista de domínios permitidos
  - **Prioridade:** 🔵 Baixa

### Informacionais

- [ ] **INF-001:** Comentário sobre hooks no `auth.ts` pode ser mais específico
  - **Arquivo:** `src/lib/auth.ts`
  - **Linha:** 24-26
  - **Impacto:** Documentação pode ser melhorada
  - **Recomendação:** Adicionar link para documentação ou issue tracking
  - **Prioridade:** ℹ️ Informativo

---

## ✅ Pontos Positivos

1. **✅ Uso Correto de `getServerEnv()`**
   - `auth.ts` usa validação centralizada de variáveis de ambiente
   - Segue LL-006 corretamente

2. **✅ Filtros Explícitos em `org-guard.ts`**
   - Não depende apenas de RLS
   - Valida membership e role explicitamente
   - Segue LL-007 corretamente

3. **✅ Middleware Bem Estruturado**
   - Trata rotas de API e páginas diferentemente
   - Adiciona header `x-org-id` para uso downstream
   - Matcher configurado corretamente

4. **✅ Type Safety**
   - Tipos bem definidos (`OrgAccessResult`)
   - TypeScript sem erros
   - Inferência de tipos funcionando corretamente

5. **✅ Estratégias Múltiplas de Resolução**
   - 4 estratégias diferentes (header, path, subdomain, fallback)
   - Flexibilidade para diferentes casos de uso

6. **✅ Hierarquia de Roles**
   - Implementação correta de hierarquia (owner > admin > member)
   - Validação de role apropriada

---

## 📋 Recomendações Prioritárias

### Prioridade Alta (Fazer Imediatamente)

1. **Corrigir Host Header Injection (CRI-001)**
   - Usar `getClientEnv()` em vez de `process.env`
   - Validar que lista de domínios não está vazia
   - Adicionar logging de tentativas inválidas
   - Testar com diferentes configurações de hostname

2. **Corrigir Acesso Direto a process.env (ALT-001)**
   - Substituir `process.env.NEXT_PUBLIC_APP_URL` por `getClientEnv().NEXT_PUBLIC_APP_URL`
   - Garantir validação consistente

### Prioridade Média (Fazer em Breve)

3. **Implementar Hooks do Better Auth (MED-001)**
   - Implementar hook `onSignIn` para definir organização padrão
   - Implementar hook `onSession` para enriquecer sessão
   - Seguir orientação do Better Auth MCP fornecida

4. **Otimizar Queries em resolveTenant (MED-002)**
   - Revisar ordem de estratégias
   - Considerar cache de resultados
   - Otimizar queries duplicadas

### Prioridade Baixa (Melhorias Futuras)

5. **Otimizar Validação de Hostname (BAI-001)**
   - Cachear lista de domínios permitidos
   - Validar apenas na inicialização ou mudança de config

---

## 🔄 Próximos Passos

### Imediatos (Esta Sprint)

1. ✅ Corrigir vulnerabilidade de Host Header Injection
2. ✅ Substituir acesso direto a `process.env` por `getClientEnv()`
3. ✅ Adicionar testes de segurança para validação de hostname

### Curto Prazo (Próxima Sprint)

4. ⏳ Implementar hooks do Better Auth
5. ⏳ Otimizar queries em `resolveTenant`
6. ⏳ Adicionar logging de auditoria para tentativas de acesso inválido

### Médio Prazo

7. ⏳ Implementar cache de domínios permitidos
8. ⏳ Adicionar métricas de performance para resolução de tenant
9. ⏳ Documentar estratégias de resolução de tenant

---

## 📝 Notas Adicionais

### Implementação de Hooks do Better Auth

Com base na orientação do Better Auth MCP, os hooks devem ser implementados assim:

```typescript
// src/lib/auth.ts
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { db } from "./db"
import { getServerEnv } from "./env"
import { user, organizationMembership, organization } from "./schema"
import { eq, and } from "drizzle-orm"

const env = getServerEnv()

// Helper para resolver ou criar organização padrão
async function resolveOrCreateDefaultOrg(userId: string) {
  // 1. Buscar última organização ativa (lastActiveOrgId)
  const userRecord = await db
    .select({ lastActiveOrgId: user.lastActiveOrgId })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  if (userRecord[0]?.lastActiveOrgId) {
    const membership = await db
      .select({
        organizationId: organizationMembership.organizationId,
        role: organizationMembership.role,
      })
      .from(organizationMembership)
      .where(
        and(
          eq(organizationMembership.userId, userId),
          eq(organizationMembership.organizationId, userRecord[0].lastActiveOrgId),
          eq(organizationMembership.status, "active")
        )
      )
      .limit(1);

    if (membership[0]) {
      return { orgId: membership[0].organizationId, role: membership[0].role };
    }
  }

  // 2. Buscar primeira organização do usuário
  const firstMembership = await db
    .select({
      organizationId: organizationMembership.organizationId,
      role: organizationMembership.role,
    })
    .from(organizationMembership)
    .where(
      and(
        eq(organizationMembership.userId, userId),
        eq(organizationMembership.status, "active")
      )
    )
    .limit(1);

  if (firstMembership[0]) {
    return { orgId: firstMembership[0].organizationId, role: firstMembership[0].role };
  }

  // 3. Criar organização padrão (se nenhuma existir)
  // Esta lógica deve ser implementada quando necessário
  // Por enquanto, retornar null se não houver organização
  return null;
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  socialProviders: env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
    ? {
        google: {
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
        },
      }
    : undefined,
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 dias
    updateAge: 60 * 60 * 24, // Atualizar a cada 24h
  },
  hooks: {
    after: [
      {
        matcher: (ctx) => ctx.path === "/sign-in",
        handler: async (ctx) => {
          if (ctx.user) {
            const defaultOrg = await resolveOrCreateDefaultOrg(ctx.user.id);
            if (defaultOrg) {
              // Atualizar lastActiveOrgId no user record
              await db
                .update(user)
                .set({ lastActiveOrgId: defaultOrg.orgId })
                .where(eq(user.id, ctx.user.id));
            }
          }
        },
      },
    ],
    // Enriquecer sessão com contexto de organização
    session: {
      async onSession({ session, user }) {
        if (!user) return session;

        const userRecord = await db
          .select({ lastActiveOrgId: user.lastActiveOrgId })
          .from(user)
          .where(eq(user.id, user.id))
          .limit(1);

        if (userRecord[0]?.lastActiveOrgId) {
          const membership = await db
            .select({
              orgId: organizationMembership.organizationId,
              role: organizationMembership.role,
              orgName: organization.name,
              orgSlug: organization.slug,
            })
            .from(organizationMembership)
            .innerJoin(
              organization,
              eq(organization.id, organizationMembership.organizationId)
            )
            .where(
              and(
                eq(organizationMembership.userId, user.id),
                eq(organizationMembership.organizationId, userRecord[0].lastActiveOrgId),
                eq(organizationMembership.status, "active")
              )
            )
            .limit(1);

          if (membership[0]) {
            // Adicionar contexto de organização à sessão
            // Nota: Verificar se Better Auth suporta extensão de sessão desta forma
            // Pode ser necessário usar callbacks.jwt e callbacks.session
            return {
              ...session,
              org: {
                id: membership[0].orgId,
                name: membership[0].orgName,
                slug: membership[0].orgSlug,
                role: membership[0].role,
              },
            };
          }
        }

        return session;
      },
    },
  },
});
```

**Nota:** A implementação exata dos hooks pode variar dependendo da versão do Better Auth. Consultar documentação oficial para API exata.

### Considerações sobre Validação de Hostname

A validação de hostname é crítica para segurança. Recomendações adicionais:

1. **Lista de Domínios Permitidos:**
   - Manter lista em variável de ambiente (separada de `NEXT_PUBLIC_APP_URL`)
   - Permitir múltiplos domínios (ex: `ALLOWED_DOMAINS=example.com,app.example.com`)

2. **Logging e Auditoria:**
   - Logar todas as tentativas de hostname inválido
   - Incluir IP, user agent, e timestamp
   - Alertar sobre padrões suspeitos

3. **Testes:**
   - Testar com hostnames maliciosos
   - Testar com hostnames válidos mas não permitidos
   - Testar com lista de domínios vazia

---

## 📊 Resumo de Métricas

| Métrica | Valor |
|---------|-------|
| **Arquivos Revisados** | 6 |
| **Linhas de Código Revisadas** | ~300 |
| **Problemas Críticos** | 1 |
| **Problemas Altos** | 1 |
| **Problemas Médios** | 2 |
| **Problemas Baixos** | 1 |
| **Problemas Informacionais** | 1 |
| **Taxa de Implementação** | 83% (5/6 itens completos) |
| **Conformidade com Lições Aprendidas** | 67% (2/3 aplicadas) |

---

**Fim da Revisão**

