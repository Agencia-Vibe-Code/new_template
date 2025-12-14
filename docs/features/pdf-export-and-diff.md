# PDF Export & Diff

## O que faz
- Gera um PDF preenchido usando o PDF original como fundo, aplicando valores do submission nas coordenadas mapeadas.
- Registra logs de exportação e oferece um utilitário de diff visual para validar pixel a pixel.

## Como funciona
- Exportação: `src/lib/pdf/export.ts` carrega o PDF base (caminho em `form_template.pdf_template_file_ref`), embute fonte Helvetica e desenha os valores usando `pdf-lib`.
- Endpoint: `GET /api/submissions/:id/export`
  - Checa permissão `submission:export`.
  - Busca submission + template + mappings filtrando por `tenantId`.
  - Gera `application/pdf` e grava log em `export_log`.
- Diff: `src/lib/pdf/diff.ts`
  - Usa `pdfjs-dist` para renderizar página 1 em PNG e `pixelmatch` para calcular diferença.
  - Endpoint `POST /api/pdf/diff` recebe o PDF exportado em base64 e retorna contagem e razão de pixels diferentes.
  - Dependências opcionais: `canvas`, `pdfjs-dist`, `pixelmatch`, `pngjs`.

## Arquivos chave
- `src/app/api/submissions/[submissionId]/export/route.ts`
- `src/app/api/pdf/diff/route.ts`
- `src/lib/pdf/export.ts`
- `src/lib/pdf/diff.ts`

## Uso
1) Garanta que o PDF original está em `public/templates/Roteiro_de_Visita_44134649.pdf`.
2) Salve uma submissão (`POST /api/submissions` ou via formulário no dashboard).
3) Baixe o PDF preenchido em `/api/submissions/:id/export`.
4) Para validar, envie o PDF exportado (base64) para `/api/pdf/diff`.

## Configuração
- Instale dependências opcionais para diff se precisar do cálculo visual:
  ```bash
  pnpm add canvas pdfjs-dist pixelmatch pngjs
  ```
- Ajuste `ROTEIRO_TEMPLATE_FILE` se o PDF ficar em outro caminho.

## Decisões de design
- Overlay em cima do PDF original garante fidelidade ao layout em vez de HTML-to-PDF.
- Coordenadas são definidas por campo e podem ser calibradas sem recriar o template.
- Diff opera em página única (ajuste conforme necessidade), suficiente para validar o roteiro.
