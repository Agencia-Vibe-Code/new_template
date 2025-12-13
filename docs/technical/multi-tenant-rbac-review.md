# Revisão Técnica - Fase 1: Multi-Tenant RBAC

**Data:** 2025-01-27  
**Revisão:** Fase 1 - Fundação (Sprint 1)  
**Stack:** Next.js 16, Better Auth, Drizzle ORM, PostgreSQL  
**Revisor:** AI Assistant (Auto)

---

## 📋 Resumo Executivo

A Fase 1 da implementação multi-tenant RBAC foi revisada. A implementação está **bem estruturada** e segue as melhores práticas, mas foram identificados **8 problemas** que precisam ser corrigidos antes de prosseguir para a Fase 2. A maioria dos problemas são de **média gravidade**, relacionados a segurança, integridade de dados e tratamento de erros.

**Status Geral:** ⚠️ **Requer Correções** antes de prosseguir

---

## 🔍 Lições Relevantes de Revisões Anteriores

As seguintes lições aprendidas são aplicáveis a esta revisão:

1. **LL-007 – Row-Level Security com Connection Pooling**
   - Contexto: Uso de `SET LOCAL` em transações vs `SET` global
   - Aplicação: Verificar que `db-context.ts` usa `SET LOCAL` corretamente dentro de transações
   - Status: ✅ Implementação correta, mas há problema na função deprecated

2. **LL-001 – Validação de Variáveis de Ambiente em Tempo de Execução**
   - Contexto: Acesso direto a `process.env` sem validação
   - Aplicação: Verificar uso de variáveis de ambiente em `db.ts` e `rate-limit.ts`
   - Status: ⚠️ `db.ts` acessa `process.env` diretamente

3. **LL-008 – Validação de Entrada em API Routes**
   - Contexto: Validação de entrada com schemas Zod
   - Aplicação: Verificar se scripts de teste validam entrada adequadamente
   - Status: ⚠️ Script de teste não valida entrada de UUIDs

4. **LL-003 – Falta de Rate Limiting em Endpoints Públicos**
   - Contexto: Rate limiting em endpoints
   - Aplicação: Verificar implementação de rate limiting
   - Status: ✅ Implementação básica presente, mas com limitações conhecidas

---

## ✅ Resultados de Lint e Typecheck

### Comandos Executados
- `pnpm run lint` - ESLint
- `pnpm run typecheck` - TypeScript Compiler

### Resumo
- **Lint:** ✅ **0 erros, 0 avisos**
- **Typecheck:** ✅ **0 erros**

### Análise
Nenhum problema foi detectado pelas ferramentas de análise estática. O código está sintaticamente correto e type-safe. Todos os problemas identificados são de natureza lógica, arquitetural ou de segurança que não são detectáveis por lint/typecheck.

---

## 📊 Revisão de Requisitos

### Objetivos da Fase 1
Conforme o plano, a Fase 1 deveria implementar:
1. ✅ Migrations para novas tabelas
2. ✅ Schema Drizzle para organizations
3. ✅ Schema para memberships
4. ✅ Schema para invitations
5. ✅ Campo `lastActiveOrgId` na tabela user
6. ✅ Índices compostos
7. ✅ Configuração RLS no PostgreSQL
8. ✅ Implementação `withOrgContext`
9. ✅ Rate limiting básico
10. ✅ Testes de isolamento básico

### Conformidade
**Status:** ✅ **Todos os requisitos foram implementados**

Todos os itens do checklist da Fase 1 foram concluídos. No entanto, alguns itens têm problemas de implementação que precisam ser corrigidos.

---

## 🐞 Relatório de Problemas

### P-001: Função `setOrgContext` Deprecated Usa SET LOCAL Fora de Transação

- **Categoria:** Segurança / Banco de Dados
- **Gravidade:** 🔴 **Alta**
- **Origem:** Manual
- **Arquivo:** `src/lib/db-context.ts:35-38`

**Descrição:**
A função `setOrgContext` está marcada como deprecated, mas ainda implementa `SET LOCAL` fora de uma transação. `SET LOCAL` **só funciona dentro de transações**. Quando chamada fora de transação, o comando falha silenciosamente ou não tem efeito, mas o código não trata esse erro.

**Evidência:**
```35:38:src/lib/db-context.ts
export async function setOrgContext(orgId: string, userId: string) {
  await db.execute(sql`SET LOCAL app.current_org_id = ${orgId}`);
  await db.execute(sql`SET LOCAL app.user_id = ${userId}`);
}
```

**Impacto:**
- Se alguém usar `setOrgContext` por engano, o contexto não será definido
- RLS policies não funcionarão corretamente
- Risco de vazamento de dados entre tenants
- Erro silencioso que pode passar despercebido

**Referência:**
- LL-007: Row-Level Security com Connection Pooling
- [PostgreSQL SET LOCAL Documentation](https://www.postgresql.org/docs/current/sql-set.html)

**Recomendação:**
Remover a função `setOrgContext` completamente ou implementá-la como wrapper que sempre usa transação:

```typescript
export async function setOrgContext(orgId: string, userId: string) {
  throw new Error(
    "setOrgContext is deprecated. Use withOrgContext for operations within transactions."
  );
}
```

---

### P-002: Migration Não Valida Constraints de Foreign Keys em Casos de Borda

- **Categoria:** Integridade de Dados
- **Gravidade:** 🟡 **Média**
- **Origem:** Manual
- **Arquivo:** `drizzle/0002_light_mentor.sql:82,85`

**Descrição:**
As foreign keys `organization_invitation_invited_by_user_id_fk` e `organization_membership_invited_by_user_id_fk` usam `ON DELETE no action`, o que pode causar problemas se o usuário que criou o convite/membership for deletado. O plano sugere tratar isso na aplicação, mas a migration não documenta esse comportamento.

**Evidência:**
```82:82:drizzle/0002_light_mentor.sql
ALTER TABLE "organization_invitation" ADD CONSTRAINT "organization_invitation_invited_by_user_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
```

```85:85:drizzle/0002_light_mentor.sql
ALTER TABLE "organization_membership" ADD CONSTRAINT "organization_membership_invited_by_user_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
```

**Impacto:**
- Se um usuário que criou convites for deletado, a deleção falhará (por `ON DELETE no action`)
- Pode bloquear operações de limpeza de dados
- Comportamento não documentado na migration

**Referência:**
- [PostgreSQL Foreign Key Constraints](https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-FK)

**Recomendação:**
Considerar usar `ON DELETE SET NULL` para campos `invited_by`, já que são campos históricos/auditoria. Alternativamente, documentar claramente que a aplicação deve tratar a remoção de usuários antes de deletá-los.

---

### P-003: RLS Policy para `organization_invitation` Pode Expor Dados Não Autorizados

- **Categoria:** Segurança
- **Gravidade:** 🟡 **Média**
- **Origem:** Manual
- **Arquivo:** `drizzle/rls-setup.sql:58-64`

**Descrição:**
A política RLS para `organization_invitation` permite que usuários vejam convites enviados para seu email, mesmo que não sejam membros da organização. Isso pode expor informações sobre organizações das quais o usuário não faz parte.

**Evidência:**
```58:64:drizzle/rls-setup.sql
CREATE POLICY org_invitation_isolation ON organization_invitation
  FOR SELECT
  USING (
    organization_id::text = app.current_org_id() OR
    email = (SELECT email FROM "user" WHERE id::text = app.current_user_id())
  );
```

**Impacto:**
- Usuário pode ver convites de organizações das quais não é membro
- Pode descobrir existência de organizações privadas
- Informação de auditoria (quem convidou) pode ser exposta

**Referência:**
- LL-007: Row-Level Security com Connection Pooling
- [PostgreSQL RLS Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)

**Recomendação:**
Restringir acesso a convites apenas para:
1. Membros da organização (com role apropriado para ver convites)
2. Usuário que recebeu o convite (email match) **E** que o convite ainda não foi aceito

```sql
CREATE POLICY org_invitation_isolation ON organization_invitation
  FOR SELECT
  USING (
    (organization_id::text = app.current_org_id() AND 
     organization_id IN (
       SELECT organization_id FROM organization_membership 
       WHERE user_id::text = app.current_user_id() AND status = 'active'
     )) OR
    (email = (SELECT email FROM "user" WHERE id::text = app.current_user_id()) 
     AND accepted_at IS NULL)
  );
```

---

### P-004: Função Helper RLS Retorna NULL Sem Tratamento

- **Categoria:** Qualidade / Banco de Dados
- **Gravidade:** 🟡 **Média**
- **Origem:** Manual
- **Arquivo:** `drizzle/rls-setup.sql:9-12,15-18`

**Descrição:**
As funções helper `app.current_org_id()` e `app.current_user_id()` retornam `NULL` quando a variável de sessão não está definida, mas as políticas RLS não tratam esse caso explicitamente. Comparações com `NULL` em SQL sempre retornam `false`, o que pode causar comportamento inesperado.

**Evidência:**
```9:12:drizzle/rls-setup.sql
CREATE OR REPLACE FUNCTION app.current_org_id() 
RETURNS TEXT AS $$
  SELECT current_setting('app.current_org_id', true);
$$ LANGUAGE sql STABLE;
```

**Impacto:**
- Se o contexto não for definido, todas as políticas RLS falharão silenciosamente
- Usuários podem ser bloqueados de acessar seus próprios dados
- Dificulta debugging de problemas de contexto

**Referência:**
- [PostgreSQL current_setting Documentation](https://www.postgresql.org/docs/current/functions-admin.html#FUNCTIONS-ADMIN-SET)

**Recomendação:**
Adicionar tratamento de erro ou valor padrão nas funções helper:

```sql
CREATE OR REPLACE FUNCTION app.current_org_id() 
RETURNS TEXT AS $$
  SELECT COALESCE(
    NULLIF(current_setting('app.current_org_id', true), ''),
    NULL
  );
$$ LANGUAGE sql STABLE;
```

Ou melhor ainda, fazer as políticas RLS verificarem explicitamente se o contexto está definido:

```sql
CREATE POLICY org_membership_isolation ON organization_membership
  FOR ALL
  USING (
    (app.current_org_id() IS NOT NULL AND 
     organization_id::text = app.current_org_id()) OR
    (app.current_user_id() IS NOT NULL AND 
     user_id::text = app.current_user_id())
  );
```

---

### P-005: Rate Limiting em Memória Não Funciona em Produção

- **Categoria:** Performance / Arquitetura
- **Gravidade:** 🟡 **Média**
- **Origem:** Manual
- **Arquivo:** `src/lib/rate-limit.ts:1-98`

**Descrição:**
A implementação de rate limiting usa um `Map` em memória, que não funciona em ambientes com múltiplas instâncias do servidor (horizontal scaling). O código tem avisos, mas não há validação de ambiente ou fallback.

**Evidência:**
```1:18:src/lib/rate-limit.ts
/**
 * Basic rate limiting implementation for development.
 * 
 * ⚠️ WARNING: This is an in-memory implementation and will not work
 * across multiple server instances. For production, use a proper
 * rate limiting solution like:
 * - @upstash/ratelimit with Redis
 * - Vercel KV
 * - Other distributed rate limiting solutions
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store (development only)
const rateLimitStore = new Map<string, RateLimitEntry>();
```

**Impacto:**
- Em produção com múltiplas instâncias, rate limiting não funciona corretamente
- Cada instância mantém seu próprio contador
- Limites podem ser facilmente ultrapassados
- Aviso existe, mas pode ser ignorado

**Referência:**
- LL-003: Falta de Rate Limiting em Endpoints Públicos

**Recomendação:**
1. Adicionar validação de ambiente que lança erro em produção se não houver implementação distribuída
2. Ou implementar fallback para Redis/Upstash quando disponível
3. Documentar claramente no README que rate limiting em produção requer configuração adicional

```typescript
export async function rateLimit(...) {
  if (process.env.NODE_ENV === "production" && !process.env.REDIS_URL && !process.env.UPSTASH_REDIS_REST_URL) {
    throw new Error(
      "Rate limiting in production requires Redis or Upstash. " +
      "Set REDIS_URL or UPSTASH_REDIS_REST_URL environment variable."
    );
  }
  // ... implementação atual
}
```

---

### P-006: Script de Teste Não Valida UUIDs Antes de Usar

- **Categoria:** Qualidade / Testes
- **Gravidade:** 🟢 **Baixa**
- **Origem:** Manual
- **Arquivo:** `scripts/test-isolation.ts:26-28`

**Descrição:**
O script de teste usa `randomUUID()` do Node.js, que gera UUIDs válidos, mas não valida se os UUIDs gerados são únicos ou se já existem no banco. Em teoria, colisões são raras, mas o script não trata esse caso.

**Evidência:**
```26:28:scripts/test-isolation.ts
    // Create test users
    const user1Id = randomUUID();
    const user2Id = randomUUID();
```

**Impacto:**
- Em teoria, pode haver colisão de UUIDs (extremamente raro)
- Se houver dados de teste anteriores não limpos, pode causar conflitos
- Script não é idempotente

**Referência:**
- LL-008: Validação de Entrada em API Routes

**Recomendação:**
1. Adicionar prefixo único baseado em timestamp para evitar colisões
2. Ou verificar existência antes de inserir
3. Ou usar `nanoid()` que gera IDs mais curtos e únicos

```typescript
const user1Id = `test-${Date.now()}-${randomUUID()}`;
```

---

### P-007: Migration Não Cria Schema `app` para Funções RLS

- **Categoria:** Banco de Dados / Qualidade
- **Gravidade:** 🟡 **Média**
- **Origem:** Manual
- **Arquivo:** `drizzle/rls-setup.sql:9-18`

**Descrição:**
O script RLS cria funções no schema `app` (`app.current_org_id()`, `app.current_user_id()`), mas não verifica se o schema existe. Se o schema não existir, o script falhará.

**Evidência:**
```9:12:drizzle/rls-setup.sql
CREATE OR REPLACE FUNCTION app.current_org_id() 
RETURNS TEXT AS $$
  SELECT current_setting('app.current_org_id', true);
$$ LANGUAGE sql STABLE;
```

**Impacto:**
- Script pode falhar em bancos novos se o schema `app` não existir
- Requer execução manual prévia de `CREATE SCHEMA IF NOT EXISTS app;`
- Não é idempotente

**Referência:**
- [PostgreSQL CREATE SCHEMA](https://www.postgresql.org/docs/current/sql-createschema.html)

**Recomendação:**
Adicionar criação do schema no início do script:

```sql
-- Create schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS app;

-- Helper function to get current organization ID from session context
CREATE OR REPLACE FUNCTION app.current_org_id() 
...
```

---

### P-008: `db.ts` Acessa `process.env` Diretamente Sem Validação

- **Categoria:** Qualidade / Configuração
- **Gravidade:** 🟡 **Média**
- **Origem:** Manual
- **Arquivo:** `src/lib/db.ts:5`

**Descrição:**
O arquivo `db.ts` acessa `process.env.POSTGRES_URL` diretamente, mesmo existindo `src/lib/env.ts` com validação centralizada. Isso viola o padrão estabelecido no projeto.

**Evidência:**
```5:9:src/lib/db.ts
const connectionString = process.env.POSTGRES_URL as string;

if (!connectionString) {
  throw new Error("POSTGRES_URL environment variable is not set");
}
```

**Impacto:**
- Inconsistência com padrão do projeto
- Validação menos robusta (não valida formato de URL)
- Pode causar erros em runtime se URL estiver malformada
- Dificulta manutenção centralizada

**Referência:**
- LL-001: Validação de Variáveis de Ambiente em Tempo de Execução
- LL-006: Uso de Variáveis de Ambiente sem Validação Centralizada

**Recomendação:**
Usar `getServerEnv()` de `src/lib/env.ts`:

```typescript
import { getServerEnv } from "./env";

const env = getServerEnv();
const connectionString = env.POSTGRES_URL;
```

---

## 💡 Recomendações Adicionais

### R-001: Adicionar Validação de Slug na Migration

Considerar adicionar constraint CHECK na migration para validar formato de slug:

```sql
ALTER TABLE "organization" ADD CONSTRAINT "organization_slug_format" 
CHECK (slug ~ '^[a-z0-9-]+$' AND length(slug) >= 3 AND length(slug) <= 50);
```

### R-002: Adicionar Índice para `lastActiveOrgId`

O campo `lastActiveOrgId` na tabela `user` pode ser consultado frequentemente. Considerar adicionar índice:

```sql
CREATE INDEX "user_last_active_org_idx" ON "user" ("last_active_org_id");
```

### R-003: Documentar Ordem de Execução de Scripts

Criar documentação clara sobre a ordem de execução:
1. Executar migrations (`pnpm run db:migrate`)
2. Executar RLS setup (`psql < drizzle/rls-setup.sql`)
3. Executar seed de permissões (quando implementado)

### R-004: Adicionar Testes de Concorrência

O script `test-isolation.ts` testa isolamento básico, mas não testa:
- Múltiplas conexões simultâneas
- Vazamento de contexto entre requests
- Race conditions em criação de organizações

Considerar adicionar testes de concorrência.

---

## 📋 Checklist de Tarefas

### Críticas (Bloqueiam Fase 2)
- [ ] **P-001:** Remover ou corrigir função `setOrgContext` deprecated
- [ ] **P-003:** Corrigir política RLS para `organization_invitation`
- [ ] **P-004:** Adicionar tratamento de NULL nas funções helper RLS

### Importantes (Recomendado Corrigir Antes de Produção)
- [ ] **P-002:** Revisar constraints de foreign keys `invited_by`
- [ ] **P-005:** Adicionar validação de ambiente para rate limiting
- [ ] **P-007:** Adicionar criação de schema `app` no script RLS
- [ ] **P-008:** Usar `getServerEnv()` em `db.ts`

### Melhorias (Opcional)
- [ ] **P-006:** Melhorar geração de IDs únicos no script de teste
- [ ] **R-001:** Adicionar constraint CHECK para formato de slug
- [ ] **R-002:** Adicionar índice para `lastActiveOrgId`
- [ ] **R-003:** Documentar ordem de execução de scripts
- [ ] **R-004:** Adicionar testes de concorrência

---

## 🆕 Atualização das Lições Aprendidas

### LL-010 – RLS Helper Functions Sem Tratamento de NULL

- **Data:** 2025-01-27
- **Contexto:** Quando criando funções helper para RLS que acessam variáveis de sessão PostgreSQL
- **Área:** Banco de Dados / Segurança
- **Causa Raiz:** `current_setting()` retorna string vazia ou NULL quando variável não está definida. Comparações com NULL em SQL sempre retornam false, fazendo políticas RLS falharem silenciosamente.
- **Padrão Geral:** Sempre tratar casos onde variáveis de sessão podem não estar definidas. Usar `COALESCE` ou verificar `IS NOT NULL` explicitamente nas políticas.
- **Sintomas Típicos:**
  - Políticas RLS bloqueiam acesso mesmo quando deveriam permitir
  - Dificuldade em debugar problemas de contexto
  - Comportamento inconsistente entre ambientes
- **Checklist de Prevenção:**
  - [ ] Verificar se variável de sessão está definida antes de usar
  - [ ] Usar `COALESCE` ou `NULLIF` para tratar valores vazios
  - [ ] Adicionar verificações `IS NOT NULL` nas políticas RLS
  - [ ] Testar comportamento quando contexto não está definido
- **Exemplo:** Funções `app.current_org_id()` e `app.current_user_id()` retornam NULL sem tratamento, causando falha silenciosa em políticas RLS
- **Referências:** [PostgreSQL current_setting](https://www.postgresql.org/docs/current/functions-admin.html#FUNCTIONS-ADMIN-SET), [PostgreSQL NULL Handling](https://www.postgresql.org/docs/current/functions-comparison.html)

---

### LL-011 – Rate Limiting em Memória em Ambientes Distribuídos

- **Data:** 2025-01-27
- **Contexto:** Quando implementando rate limiting para aplicações que podem escalar horizontalmente
- **Área:** Performance / Arquitetura
- **Causa Raiz:** Rate limiting em memória (Map, objeto) não funciona em ambientes com múltiplas instâncias. Cada instância mantém seu próprio contador, permitindo que limites sejam ultrapassados.
- **Padrão Geral:** Rate limiting em produção deve usar armazenamento distribuído (Redis, Upstash, Vercel KV). Implementações em memória devem validar ambiente e lançar erro em produção.
- **Sintomas Típicos:**
  - Rate limits não funcionam corretamente em produção
  - Limites podem ser ultrapassados facilmente
  - Comportamento inconsistente entre instâncias
- **Checklist de Prevenção:**
  - [ ] Validar ambiente antes de usar rate limiting em memória
  - [ ] Lançar erro em produção se implementação distribuída não estiver configurada
  - [ ] Documentar claramente limitações da implementação
  - [ ] Usar Redis/Upstash/Vercel KV em produção
- **Exemplo:** `src/lib/rate-limit.ts` usa Map em memória com aviso, mas não valida ambiente em produção
- **Referências:** [Upstash Rate Limiting](https://upstash.com/docs/redis/features/ratelimiting), [Vercel KV](https://vercel.com/docs/storage/vercel-kv)

---

### LL-012 – Foreign Keys com ON DELETE no action em Campos de Auditoria

- **Data:** 2025-01-27
- **Contexto:** Quando criando foreign keys para campos de auditoria/histórico (como `created_by`, `invited_by`)
- **Área:** Banco de Dados / Integridade de Dados
- **Causa Raiz:** `ON DELETE no action` em campos de auditoria pode bloquear deleção de registros principais. Campos históricos geralmente devem permitir que o registro principal seja deletado, mantendo referência ou setando NULL.
- **Padrão Geral:** Para campos de auditoria/histórico, usar `ON DELETE SET NULL` ou `ON DELETE RESTRICT` apenas se a referência for crítica. Documentar comportamento claramente.
- **Sintomas Típicos:**
  - Deleção de usuários falha devido a foreign keys
  - Operações de limpeza de dados bloqueadas
  - Confusão sobre comportamento esperado
- **Checklist de Prevenção:**
  - [ ] Avaliar se campo é crítico ou apenas histórico
  - [ ] Usar `ON DELETE SET NULL` para campos históricos
  - [ ] Documentar comportamento na migration
  - [ ] Implementar lógica de limpeza na aplicação se necessário
- **Exemplo:** Foreign keys `invited_by` em `organization_invitation` e `organization_membership` usam `ON DELETE no action`, bloqueando deleção de usuários
- **Referências:** [PostgreSQL Foreign Key Actions](https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-FK)

---

## ✅ Conclusão

A Fase 1 foi implementada de forma **sólida e bem estruturada**. Os problemas identificados são principalmente relacionados a:

1. **Segurança:** Políticas RLS e tratamento de contexto
2. **Integridade:** Foreign keys e validações
3. **Qualidade:** Consistência de padrões e tratamento de erros

**Recomendação:** Corrigir os problemas **P-001, P-003, P-004** antes de prosseguir para a Fase 2, pois são críticos para segurança e funcionamento correto do sistema multi-tenant.

Os demais problemas podem ser corrigidos em paralelo ou durante a Fase 2, mas devem ser tratados antes de qualquer deploy em produção.

---

**Próximos Passos:**
1. Revisar e aplicar correções dos problemas críticos
2. Executar testes de isolamento novamente após correções
3. Validar RLS policies em ambiente de desenvolvimento
4. Prosseguir para Fase 2 após validação completa
