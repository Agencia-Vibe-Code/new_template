---
description: Perform comprehensive code review and save documentation in organized subfolders
---

# Code Review

This command performs a comprehensive technical code review of the project and saves the documentation in organized subfolders within `/docs`.

## Instructions

### 1. Ensure Documentation Directory Structure

Before creating the review document, ensure the `/docs` directory exists with appropriate subfolders:

- If `/docs` doesn't exist, create it
- Create subfolders as needed based on the review type:
  - `docs/technical/` - For technical code reviews
  - `docs/technical/{topic}/` - For topic-specific technical reviews (e.g., `ai/`, `betterauth/`, `database/`)
  - `docs/business/` - For business/requirements reviews
  - `docs/security/` - For security-focused reviews
  - `docs/performance/` - For performance reviews

### 2. Determine Review Type and Location

Based on the conversation context or user request, determine:
- **Review type**: Technical, security, performance, business, etc.
- **Topic/subtopic**: Specific area being reviewed (e.g., "multi-tenant-rbac", "ai-integration", "authentication")
- **Target subfolder**: Where to save the review document

Default structure:
- General technical reviews → `docs/technical/{review-name}.md`
- Topic-specific reviews → `docs/technical/{topic}/{review-name}.md`
- Security reviews → `docs/security/{review-name}.md`
- Performance reviews → `docs/performance/{review-name}.md`

### 3. Perform Comprehensive Code Review

Execute the following review process:

#### A. Run Static Analysis
1. Run `npm run lint` (or `pnpm run lint`) and capture all output
2. Run `npm run typecheck` (or `pnpm run typecheck`) and capture all output
3. Document results in the review

#### B. Analyze Codebase Structure
1. Review project structure and organization
2. Identify main components, modules, and their relationships
3. Check adherence to project conventions and patterns

#### C. Review Key Areas
1. **Security**
   - Authentication and authorization
   - Input validation and sanitization
   - Environment variable handling
   - API security (rate limiting, CORS, etc.)
   - SQL injection and XSS vulnerabilities

2. **Code Quality**
   - Type safety and TypeScript usage
   - Error handling patterns
   - Code organization and modularity
   - Naming conventions
   - Code duplication

3. **Performance**
   - Database query optimization
   - API response times
   - Caching strategies
   - Bundle size and optimization

4. **Best Practices**
   - Following project guidelines
   - Using recommended libraries correctly
   - Proper use of framework features
   - Testing coverage (if applicable)

5. **Architecture**
   - Design patterns used
   - Separation of concerns
   - Scalability considerations
   - Maintainability

#### D. Check Lessons Learned
1. Review `.cursor/knowledge/lessons-learned.*.md` files if they exist
2. Apply relevant lessons to the current review
3. Reference lessons in the review document

#### E. Document Issues
For each issue found:
- **Severity**: Critical, High, Medium, Low, Info
- **Category**: Security, Performance, Code Quality, Architecture, etc.
- **Location**: File path and line numbers
- **Description**: Clear explanation of the issue
- **Impact**: What could go wrong
- **Recommendation**: How to fix it
- **Priority**: When to address it

### 4. Create Review Document

Create a comprehensive markdown document with the following structure:

```markdown
# {Review Title}

**Data:** {YYYY-MM-DD}  
**Projeto:** {Project Name}  
**Revisor:** AI Assistant  
**Tipo de Revisão:** {Technical/Security/Performance/etc.}

---

## 📊 Resumo Executivo

Brief overview of the review scope, findings, and overall assessment.

### Stack Tecnológica Identificada
- List of technologies, frameworks, and libraries used

### Escopo da Revisão
- What was reviewed (files, modules, features)
- What was NOT reviewed (if applicable)

---

## ✅ Resultados de Lint e Typecheck

### Comandos Executados
```bash
npm run lint      # ESLint
npm run typecheck # TypeScript compiler
```

### Resumo dos Resultados
- ✅/⚠️/❌ **Lint:** Results
- ✅/⚠️/❌ **Typecheck:** Results

### Análise
Detailed analysis of static analysis results.

---

## 📚 Lições Relevantes de Revisões Anteriores

Reference and apply lessons from previous reviews if available.

---

## 🔍 Revisão de Requisitos ("O quê")

### Funcionalidades Identificadas
List of features and their status.

### Conformidade com Requisitos
- Functional requirements compliance
- Non-functional requirements compliance

---

## 🏗️ Revisão de Arquitetura ("Como")

### Estrutura do Projeto
Analysis of project organization.

### Padrões de Design
Design patterns used and their appropriateness.

### Escalabilidade
Scalability considerations and potential issues.

---

## 🔒 Revisão de Segurança

### Vulnerabilidades Identificadas
List of security issues with severity ratings.

### Recomendações de Segurança
Actionable security improvements.

---

## ⚡ Revisão de Performance

### Problemas de Performance
Performance bottlenecks and issues.

### Otimizações Recomendadas
Performance improvement suggestions.

---

## 🐛 Problemas Identificados

### Críticos
- [ ] Issue 1: Description
  - **Arquivo:** `path/to/file.ts`
  - **Linha:** X
  - **Impacto:** What could go wrong
  - **Recomendação:** How to fix

### Altos
- [ ] Issue 2: Description
  ...

### Médios
- [ ] Issue 3: Description
  ...

### Baixos
- [ ] Issue 4: Description
  ...

### Informacionais
- [ ] Issue 5: Description
  ...

---

## ✅ Pontos Positivos

What's working well in the codebase.

---

## 📋 Recomendações Prioritárias

1. **Prioridade Alta:** Action items
2. **Prioridade Média:** Action items
3. **Prioridade Baixa:** Action items

---

## 🔄 Próximos Passos

Suggested follow-up actions and improvements.

---

## 📝 Notas Adicionais

Any additional observations or context.
```

### 5. Save Document in Appropriate Location

1. **Determine filename**: Use kebab-case (e.g., `multi-tenant-rbac-review.md`, `api-security-review.md`)
2. **Create directory structure**: Ensure all necessary subdirectories exist
3. **Save document**: Write to the determined path within `/docs`

Example paths:
- `docs/technical/multi-tenant-rbac-review.md`
- `docs/technical/ai/chat-integration-review.md`
- `docs/security/authentication-review.md`
- `docs/performance/api-optimization-review.md`

### 6. File Naming Convention

- Use descriptive, kebab-case names
- Include review type or topic in filename
- Format: `{topic}-{type}-review.md` or `{feature}-review.md`
- Examples:
  - `multi-tenant-rbac-review.md`
  - `api-security-review.md`
  - `database-schema-review.md`
  - `authentication-review.md`

## Directory Creation Logic

When creating directories:

1. Check if `/docs` exists, create if missing
2. Determine target subfolder based on review type:
   - Technical reviews → `docs/technical/`
   - Security reviews → `docs/security/`
   - Performance reviews → `docs/performance/`
   - Business reviews → `docs/business/`
3. If topic-specific, create nested folder: `docs/technical/{topic}/`
4. Create all necessary parent directories recursively

## Review Scope

By default, review:
- All files in `src/` directory
- Configuration files (`next.config.ts`, `drizzle.config.ts`, etc.)
- Environment variable usage
- API routes and handlers
- Database schema and migrations
- Authentication and authorization logic
- Error handling patterns
- Type safety and validation

If user specifies a narrower scope, focus on that area but still provide context.

## Output

After completing the review:

1. Inform the user where the document was saved
2. Provide a summary of findings (number of issues by severity)
3. Highlight critical issues that need immediate attention
4. Suggest next steps

Example output:
> Code review completed and saved to `docs/technical/multi-tenant-rbac-review.md`
>
> **Summary:**
> - ✅ Lint: No errors
> - ✅ Typecheck: No errors
> - 🔴 Critical issues: 2
> - 🟠 High priority: 5
> - 🟡 Medium priority: 8
> - 🔵 Low priority: 3
>
> **Critical issues require immediate attention.**
>
> Review the full document for detailed recommendations.

## Notes

- Be thorough but practical - focus on actionable issues
- Reference project guidelines and best practices
- Consider the project's current stage (early development vs. production-ready)
- Balance between perfectionism and pragmatism
- Always check for lessons learned from previous reviews
- Ensure the review document is well-structured and easy to navigate

