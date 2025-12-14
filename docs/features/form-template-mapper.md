# Form Template + PDF Mapper

## O que faz
- Mantém o template “Roteiro de visita” com esquema de campos em JSON e mapeia cada campo para coordenadas no PDF original.
- Permite calibrar visualmente os campos em um canvas A4 e salvar o mapping em banco (UI removida; mapping padrão permanece).
- Garante isolamento por tenant: cada template e mapping pertence a um `tenantId`.

## Como funciona
- Tabelas:
  - `form_template`: nome, status (draft/published/archived), `schema_json`, referência para o PDF (`pdf_template_file_ref`).
  - `pdf_field_map`: coordenadas (x,y), página, fonte para cada `field_key`.
- Seed automático: `ensureDefaultTemplateForTenant` insere o template Roteiro com os campos e um mapping inicial quando o tenant acessa `/api/templates`.
- API:
  - `GET /api/templates` — lista templates e dispara o seed padrão.
  - `GET /api/templates/:id` — traz schema + mappings.
  - `POST /api/templates` — cria template (permissão `form:create`).
  - `PATCH /api/templates/:id` — edita/publica template (permissões `form:edit` / `form:publish`).
  - `POST /api/templates/:id/map` — salva coordenadas (permissão `form:map`).
- UI:
  - Dashboard mostra o template publicado.
  - UI de mapper foi removida; ajustes agora exigem edição do mapping no banco/seed.
- Coordenadas seguem o sistema do PDF (`pdf-lib`): origem no canto inferior esquerdo.

## Arquivos chave
- `src/lib/templates/roteiro-template.ts` — definição do schema, nome, caminho do PDF e mapping inicial.
- `src/lib/form-service.ts` — seed, leitura e escrita de mappings, submissões e logs de export.
- `drizzle/0005_form_builder_core.sql` — tabelas e índices.

## Uso / passos
1) Coloque o PDF original em `public/templates/Roteiro_de_Visita_44134649.pdf`.
2) Acesse `/dashboard` (seed automático do template para o tenant ativo).
3) Ajustes finos de coordenada devem ser feitos via seed (`ROTEIRO_INITIAL_FIELD_MAP`) ou update direto em `pdf_field_map`.

## Decisões de design
- O mapper usa um canvas A4 com origem superior apenas para visual; converte para coordenadas PDF invertendo o eixo Y.
- Mapping é salvo via replace (delete + insert) para simplificar consistência.
- Template único “Roteiro de visita” vem pronto, mas a API aceita novos templates para futuros PDFs.
