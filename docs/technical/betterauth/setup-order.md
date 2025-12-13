# Ordem de Execução - Setup Multi-Tenant RBAC

Este documento descreve a ordem correta de execução dos scripts para configurar o sistema multi-tenant RBAC.

## 📋 Pré-requisitos

1. **Variáveis de Ambiente Configuradas**
   - Certifique-se de que todas as variáveis necessárias estão configuradas em `.env.local`
   - Veja `env.example` para referência

2. **Banco de Dados PostgreSQL**
   - Banco de dados criado e acessível
   - `POSTGRES_URL` configurada corretamente

## 🔄 Ordem de Execução

### 1. Executar Migrations

Execute as migrations do Drizzle para criar todas as tabelas:

```bash
pnpm run db:migrate
```

**O que faz:**
- Cria todas as tabelas necessárias (`organization`, `organization_membership`, etc.)
- Adiciona foreign keys e constraints
- Adiciona índices
- Adiciona constraint CHECK para formato de slug
- Adiciona índice para `lastActiveOrgId`

**Verificação:**
- Verifique se não houve erros na execução
- Confirme que todas as tabelas foram criadas: `pnpm run db:studio`

### 2. Configurar Row-Level Security (RLS)

Execute o script SQL para configurar RLS policies:

```bash
psql $POSTGRES_URL -f drizzle/rls-setup.sql
```

**Alternativa (se psql não estiver disponível):**
```bash
# Usando Node.js
npx tsx -e "
import { db } from './src/lib/db';
import { readFileSync } from 'fs';
const sql = readFileSync('./drizzle/rls-setup.sql', 'utf-8');
// Execute SQL statements (requer biblioteca para executar SQL direto)
"
```

**O que faz:**
- Cria schema `app` se não existir
- Cria funções helper `app.current_org_id()` e `app.current_user_id()`
- Habilita RLS em todas as tabelas tenant-scoped
- Cria políticas RLS para isolamento de dados

**Verificação:**
```sql
-- Verificar se RLS está habilitado
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('organization', 'organization_membership', 'organization_invitation');

-- Verificar se funções foram criadas
SELECT proname FROM pg_proc WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'app');
```

### 3. Seed de Permissões (Opcional - Fase 3)

Quando a Fase 3 for implementada, execute o seed de permissões:

```bash
npx tsx scripts/seed-permissions.ts
```

**O que faz:**
- Popula tabela `permission` com permissões padrão do sistema
- Cria roles padrão (owner, admin, member) se necessário

### 4. Testar Isolamento (Opcional)

Execute o script de teste para verificar isolamento básico:

```bash
npx tsx scripts/test-isolation.ts
```

**O que faz:**
- Cria usuários e organizações de teste
- Verifica que usuários só veem dados de suas organizações
- Limpa dados de teste automaticamente

## ⚠️ Problemas Comuns

### Erro: "schema 'app' does not exist"

**Causa:** O script RLS tenta criar funções no schema `app` antes de criá-lo.

**Solução:** O script `rls-setup.sql` já inclui `CREATE SCHEMA IF NOT EXISTS app;` no início. Se ainda assim falhar, execute manualmente:

```sql
CREATE SCHEMA IF NOT EXISTS app;
```

### Erro: "relation 'organization' does not exist"

**Causa:** Migrations não foram executadas ou falharam.

**Solução:** Execute `pnpm run db:migrate` novamente e verifique se não houve erros.

### Erro: "permission denied for schema app"

**Causa:** Usuário do banco não tem permissão para criar schemas.

**Solução:** Conceda permissão ao usuário:

```sql
GRANT CREATE ON SCHEMA app TO seu_usuario;
```

### RLS Policies não funcionam

**Causa:** Contexto não está sendo definido corretamente.

**Solução:** 
1. Verifique se está usando `withOrgContext` para operações em transação
2. Verifique se as funções helper retornam valores corretos:
   ```sql
   SELECT app.current_org_id(), app.current_user_id();
   ```

## 📝 Checklist de Validação

Após executar todos os scripts, valide:

- [ ] Todas as tabelas foram criadas
- [ ] Foreign keys estão funcionando
- [ ] RLS está habilitado em todas as tabelas tenant-scoped
- [ ] Funções helper `app.current_org_id()` e `app.current_user_id()` existem
- [ ] Políticas RLS foram criadas
- [ ] Constraint CHECK para slug está funcionando
- [ ] Índice para `lastActiveOrgId` foi criado

## 🔄 Atualizações Futuras

Quando novas migrations forem criadas:

1. Execute `pnpm run db:generate` para gerar nova migration
2. Revise a migration gerada
3. Execute `pnpm run db:migrate` para aplicar
4. Se necessário, atualize `rls-setup.sql` com novas políticas

## 📚 Referências

- [Drizzle Migrations](https://orm.drizzle.team/docs/migrations)
- [PostgreSQL RLS](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Multi-Tenant RBAC Plan](../betterauth/multi-tenant-rbac-plan.md)

