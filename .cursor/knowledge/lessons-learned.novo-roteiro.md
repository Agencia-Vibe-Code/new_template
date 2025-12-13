# Lições Aprendidas - Novo Roteiro

Este arquivo contém lições aprendidas de revisões de código realizadas neste projeto.

---

## LL-001 – Validação de Variáveis de Ambiente em Tempo de Execução

- **Data:** 2025-01-27
- **Contexto:** Quando variáveis de ambiente são acessadas diretamente via `process.env` sem validação prévia
- **Área:** Segurança / Configuração
- **Causa Raiz:** Acesso direto a `process.env` sem validação pode resultar em valores `undefined` ou inválidos em runtime
- **Padrão Geral:** Variáveis de ambiente devem ser validadas no início da aplicação usando schemas (ex: Zod)
- **Sintomas Típicos:**
  - Erros em runtime quando variáveis estão ausentes
  - Comportamento inesperado com valores inválidos
  - Dificuldade em identificar problemas de configuração
- **Checklist de Prevenção:**
  - [ ] Criar schema de validação para todas as variáveis de ambiente
  - [ ] Validar no início da aplicação (startup)
  - [ ] Usar funções centralizadas para acessar variáveis validadas
  - [ ] Evitar acesso direto a `process.env` em código de produção
- **Exemplo:** No projeto, `src/lib/env.ts` fornece validação, mas alguns arquivos ainda acessam `process.env` diretamente
- **Referências:** [Zod Documentation](https://zod.dev/), [Next.js Environment Variables](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables)

---

## LL-002 – Type Assertions Perigosas em APIs

- **Data:** 2025-01-27
- **Contexto:** Quando type assertions (`as`) são usadas para contornar verificações de tipo do TypeScript
- **Área:** Qualidade / Type Safety
- **Causa Raiz:** Type assertions ignoram a verificação de tipos do TypeScript, podendo mascarar incompatibilidades reais
- **Padrão Geral:** Evitar type assertions; preferir type guards, validação em runtime, ou ajustar tipos na origem
- **Sintomas Típicos:**
  - Erros em runtime que não são detectados em compile-time
  - Código que "funciona" mas quebra silenciosamente
  - Dificuldade em manter tipos consistentes
- **Checklist de Prevenção:**
  - [ ] Usar type guards quando necessário
  - [ ] Validar dados em runtime antes de assertions
  - [ ] Revisar tipos na origem dos dados
  - [ ] Documentar razão quando assertion for necessária
- **Exemplo:** `src/app/api/chat/route.ts` linha 59 usa `as` após validação Zod, mas poderia usar tipos inferidos
- **Referências:** [TypeScript Type Assertions](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#type-assertions)

---

## LL-003 – Falta de Rate Limiting em Endpoints Públicos

- **Data:** 2025-01-27
- **Contexto:** Quando endpoints de API não implementam rate limiting ou throttling
- **Área:** Segurança / Performance
- **Causa Raiz:** Endpoints sem rate limiting são vulneráveis a abuso, DDoS e consumo excessivo de recursos
- **Padrão Geral:** Implementar rate limiting em todos os endpoints públicos, especialmente aqueles que consomem recursos externos (APIs pagas, banco de dados)
- **Sintomas Típicos:**
  - Consumo excessivo de recursos (API keys, banco de dados)
  - Degradação de performance sob carga
  - Custos inesperados com serviços externos
- **Checklist de Prevenção:**
  - [ ] Implementar rate limiting por IP ou usuário
  - [ ] Configurar limites apropriados para cada endpoint
  - [ ] Retornar headers HTTP apropriados (X-RateLimit-*)
  - [ ] Monitorar e alertar sobre violações de rate limit
- **Exemplo:** `src/app/api/chat/route.ts` não possui rate limiting, permitindo uso ilimitado da API OpenRouter
- **Referências:** [Next.js Rate Limiting](https://nextjs.org/docs/app/building-your-application/routing/middleware), [Vercel Rate Limiting](https://vercel.com/docs/edge-network/rate-limiting)

---

## LL-004 – Validação Incompleta de Tipos de Arquivo

- **Data:** 2025-01-27
- **Contexto:** Quando validação de upload de arquivos confia apenas em extensão ou MIME type fornecido pelo cliente
- **Área:** Segurança
- **Causa Raiz:** Clientes podem falsificar extensões e MIME types; validação deve verificar o conteúdo real do arquivo
- **Padrão Geral:** Validar tipo de arquivo verificando magic bytes/cabeçalhos do arquivo, não apenas extensão ou MIME type
- **Sintomas Típicos:**
  - Upload de arquivos maliciosos com extensões falsas
  - Execução de código não autorizado
  - Armazenamento de conteúdo não permitido
- **Checklist de Prevenção:**
  - [ ] Validar magic bytes/cabeçalhos do arquivo
  - [ ] Usar biblioteca confiável para detecção de tipo (ex: `file-type`)
  - [ ] Validar extensão E conteúdo do arquivo
  - [ ] Sanitizar nomes de arquivo adequadamente
- **Exemplo:** `src/lib/storage.ts` valida apenas extensão e menciona MIME type, mas não valida magic bytes
- **Referências:** [OWASP File Upload](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html), [file-type npm](https://www.npmjs.com/package/file-type)

---

## LL-005 – Tratamento de Erros em Operações Assíncronas do Cliente

- **Data:** 2025-01-27
- **Contexto:** Quando operações assíncronas no cliente (localStorage, fetch) não têm tratamento de erro adequado
- **Área:** Qualidade / UX
- **Causa Raiz:** Operações do navegador podem falhar silenciosamente; usuários não recebem feedback adequado
- **Padrão Geral:** Sempre tratar erros de operações assíncronas e fornecer feedback ao usuário
- **Sintomas Típicos:**
  - Dados perdidos sem aviso ao usuário
  - Interface que parece funcionar mas não salva dados
  - Erros silenciosos no console
- **Checklist de Prevenção:**
  - [ ] Usar try/catch em todas as operações assíncronas
  - [ ] Tratar casos específicos (localStorage bloqueado, quota excedida)
  - [ ] Fornecer feedback visual ao usuário
  - [ ] Implementar fallbacks quando apropriado
- **Exemplo:** `src/app/chat/page.tsx` usa localStorage sem tratamento de erro para quota excedida ou bloqueio
- **Referências:** [MDN localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage), [Web Storage API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API)

---

## LL-006 – Uso de Variáveis de Ambiente sem Validação Centralizada

- **Data:** 2025-01-27
- **Contexto:** Quando múltiplos arquivos acessam `process.env` diretamente em vez de usar validação centralizada
- **Área:** Manutenibilidade / Segurança
- **Causa Raiz:** Acesso direto a `process.env` espalha lógica de validação e dificulta manutenção
- **Padrão Geral:** Centralizar acesso a variáveis de ambiente através de módulo de configuração validado
- **Sintomas Típicos:**
  - Validação inconsistente entre arquivos
  - Dificuldade em rastrear uso de variáveis
  - Erros de configuração descobertos tarde demais
- **Checklist de Prevenção:**
  - [ ] Criar módulo centralizado de configuração
  - [ ] Validar todas as variáveis no início da aplicação
  - [ ] Exportar funções/getters para acessar variáveis validadas
  - [ ] Evitar acesso direto a `process.env` em código de produção
- **Exemplo:** Vários arquivos acessam `process.env` diretamente apesar de existir `src/lib/env.ts`
- **Referências:** [12-Factor App Config](https://12factor.net/config), [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)

---

## LL-007 – Row-Level Security com Connection Pooling

- **Data:** 2025-01-27
- **Contexto:** Quando usando PostgreSQL RLS com variáveis de sessão (`SET`) em aplicações com connection pooling
- **Área:** Banco de Dados / Segurança
- **Causa Raiz:** `SET` em PostgreSQL é por conexão, não por transação. Em pools de conexão, o contexto pode vazar entre requests diferentes usando a mesma conexão.
- **Padrão Geral:** Nunca usar `SET` global em aplicações com pooling. Usar `SET LOCAL` dentro de transações ou filtros explícitos em queries.
- **Sintomas Típicos:**
  - Vazamento de contexto entre requests
  - Acesso cross-tenant não autorizado
  - Dados de uma organização aparecendo em outra
- **Checklist de Prevenção:**
  - [ ] Usar `SET LOCAL` dentro de transações quando necessário
  - [ ] Preferir filtros explícitos em queries sobre RLS apenas
  - [ ] Usar RLS como camada adicional, não única
  - [ ] Testar isolamento com múltiplas conexões simultâneas
- **Exemplo:** Plano multi-tenant usa `SET app.current_org_id` que pode vazar entre requests no pool
- **Referências:** [PostgreSQL SET LOCAL](https://www.postgresql.org/docs/current/sql-set.html), [Connection Pooling Best Practices](https://www.postgresql.org/docs/current/runtime-config-connection.html)

---

## LL-008 – Validação de Entrada em API Routes

- **Data:** 2025-01-27
- **Contexto:** Quando criando endpoints de API que recebem dados do cliente
- **Área:** Segurança / API
- **Causa Raiz:** Dados do cliente nunca devem ser confiados sem validação. Falta de validação permite injeção de dados inválidos, XSS, e outros ataques.
- **Padrão Geral:** Sempre validar entrada com schemas (Zod, Yup, etc.) antes de processar. Validar tipo, formato, tamanho, e sanitizar quando necessário.
- **Sintomas Típicos:**
  - Erros 500 em vez de 400 para dados inválidos
  - Dados malformados no banco
  - Vulnerabilidades de segurança
- **Checklist de Prevenção:**
  - [ ] Criar schema de validação para cada endpoint
  - [ ] Validar antes de qualquer processamento
  - [ ] Retornar erros 400 com detalhes de validação
  - [ ] Sanitizar strings (trim, lowercase quando apropriado)
  - [ ] Validar formatos específicos (email, URL, slug, etc.)
- **Exemplo:** Plano multi-tenant não valida entrada em `POST /api/organizations`
- **Referências:** [OWASP Input Validation](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html), [Zod Documentation](https://zod.dev/)

---

## LL-009 – Host Header Injection em Resolução de Tenant

- **Data:** 2025-01-27
- **Contexto:** Quando resolvendo contexto de tenant/organização a partir do header `Host` ou subdomain
- **Área:** Segurança
- **Causa Raiz:** Headers HTTP podem ser manipulados por clientes. Confiar cegamente no header `Host` permite que atacantes acessem organizações não autorizadas.
- **Padrão Geral:** Sempre validar hostname contra lista de domínios permitidos. Não confiar apenas no formato do hostname.
- **Sintomas Típicos:**
  - Acesso não autorizado a organizações
  - Redirecionamentos maliciosos
  - Bypass de autenticação por contexto
- **Checklist de Prevenção:**
  - [ ] Manter lista de domínios permitidos
  - [ ] Validar que hostname termina com domínio permitido
  - [ ] Rejeitar hostnames não reconhecidos
  - [ ] Considerar usar path-based routing como alternativa mais segura
  - [ ] Logar tentativas de hostname inválido
- **Exemplo:** Plano multi-tenant extrai subdomain de `req.headers.get("host")` sem validação
- **Referências:** [OWASP Host Header Injection](https://owasp.org/www-community/vulnerabilities/HTTP_Header_Injection), [Next.js Host Validation](https://nextjs.org/docs/app/api-reference/next-config-js/headers)

---

## LL-010 – RLS Helper Functions Sem Tratamento de NULL

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

## LL-011 – Rate Limiting em Memória em Ambientes Distribuídos

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

## LL-012 – Foreign Keys com ON DELETE no action em Campos de Auditoria

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
