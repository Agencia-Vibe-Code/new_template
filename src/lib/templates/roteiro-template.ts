export type TemplateField = {
  key: string;
  label: string;
  type: "text" | "textarea" | "date" | "select";
  required?: boolean;
  options?: string[];
  width?: "full" | "half";
};

export type TemplateSection = {
  id: string;
  title: string;
  description?: string;
  fields: TemplateField[];
};

export const ROTEIRO_TEMPLATE_NAME = "Roteiro de visita";
export const ROTEIRO_TEMPLATE_FILE =
  "/templates/Roteiro_de_Visita_44134649.pdf";

export const ROTEIRO_TEMPLATE_SCHEMA: TemplateSection[] = [
  {
    id: "informacoes-pessoais",
    title: "Informações pessoais",
    fields: [
      { key: "nome", label: "Nome", type: "text", required: true, width: "full" },
      { key: "cpf", label: "CPF", type: "text", required: true, width: "half" },
      { key: "telefone", label: "Telefone", type: "text", required: true, width: "half" },
      { key: "email", label: "E-mail", type: "text", width: "full" },
      { key: "endereco", label: "Endereço", type: "text", width: "full" },
      { key: "estado_civil", label: "Estado civil", type: "select", options: ["Solteiro(a)", "Casado(a)", "Divorciado(a)", "Viúvo(a)"], width: "half" },
      { key: "naturalidade", label: "Naturalidade", type: "text", width: "half" },
      { key: "profissao", label: "Profissão", type: "text", width: "half" },
    ],
  },
  {
    id: "acidente",
    title: "Informação detalhada sobre o acidente",
    fields: [
      { key: "data_acidente", label: "Data do acidente", type: "date", required: true, width: "half" },
      { key: "corpo_afetado", label: "Corpo afetado", type: "text", required: true, width: "half" },
      { key: "lesao", label: "Lesão", type: "text", width: "full" },
      { key: "cirurgia", label: "Cirurgia", type: "select", options: ["Sim", "Não"], width: "half" },
      { key: "material", label: "Material", type: "text", width: "half" },
      { key: "detalhes", label: "Detalhes", type: "textarea" },
    ],
  },
  {
    id: "inss",
    title: "INSS",
    fields: [
      { key: "beneficio_inss", label: "INSS", type: "text", width: "full" },
      { key: "numero_beneficio", label: "Número do benefício", type: "text", width: "half" },
    ],
  },
  {
    id: "empresa",
    title: "EMPRESA",
    fields: [
      { key: "empresa", label: "Empresa", type: "text", width: "full" },
      { key: "cargo", label: "Cargo", type: "text", width: "half" },
    ],
  },
  {
    id: "documentacoes",
    title: "DOCUMENTAÇÕES",
    fields: [{ key: "documentacoes", label: "Documentações", type: "textarea" }],
  },
  {
    id: "hospital",
    title: "HOSPITAL",
    fields: [
      { key: "hospital", label: "Hospital", type: "text", width: "full" },
    ],
  },
  {
    id: "rodape",
    title: "Rodapé",
    fields: [
      { key: "data_rodape", label: "Data", type: "date", required: true, width: "half" },
    ],
  },
];

export const ROTEIRO_INITIAL_FIELD_MAP = [
  { fieldKey: "data_rodape", page: 1, x: 520, y: 822, fontSize: 11, width: 60 },
  { fieldKey: "especialista", page: 1, x: 170, y: 788, fontSize: 11, width: 280 },
  { fieldKey: "nome", page: 1, x: 170, y: 770, fontSize: 11, width: 220 },
  { fieldKey: "cpf", page: 1, x: 430, y: 770, fontSize: 11, width: 140 },
  { fieldKey: "telefone", page: 1, x: 170, y: 752, fontSize: 11, width: 150 },
  { fieldKey: "rg", page: 1, x: 430, y: 752, fontSize: 11, width: 140 },
  { fieldKey: "telefone_recado", page: 1, x: 170, y: 734, fontSize: 11, width: 150 },
  { fieldKey: "orgao_emissor", page: 1, x: 430, y: 734, fontSize: 11, width: 140 },
  { fieldKey: "email", page: 1, x: 170, y: 716, fontSize: 11, width: 200 },
  { fieldKey: "cidade_emissao", page: 1, x: 430, y: 716, fontSize: 11, width: 140 },
  { fieldKey: "cep", page: 1, x: 170, y: 698, fontSize: 11, width: 120 },
  { fieldKey: "endereco", page: 1, x: 350, y: 698, fontSize: 11, width: 230 },
  { fieldKey: "complemento", page: 1, x: 170, y: 680, fontSize: 11, width: 150 },
  { fieldKey: "bairro", page: 1, x: 400, y: 680, fontSize: 11, width: 180 },
  { fieldKey: "cidade", page: 1, x: 170, y: 662, fontSize: 11, width: 150 },
  { fieldKey: "estado", page: 1, x: 400, y: 662, fontSize: 11, width: 80 },
  { fieldKey: "nacionalidade", page: 1, x: 170, y: 644, fontSize: 11, width: 150 },
  { fieldKey: "documento_adicional", page: 1, x: 400, y: 644, fontSize: 11, width: 180 },
  { fieldKey: "empregado_atual", page: 1, x: 170, y: 626, fontSize: 11, width: 150 },
  { fieldKey: "estado_civil", page: 1, x: 400, y: 626, fontSize: 11, width: 140 },
  { fieldKey: "beneficio_inss", page: 1, x: 170, y: 608, fontSize: 11, width: 150 },
  { fieldKey: "desempregado_ultimo", page: 1, x: 400, y: 608, fontSize: 11, width: 180 },

  { fieldKey: "data_acidente", page: 1, x: 140, y: 588, fontSize: 11, width: 160 },
  { fieldKey: "como_acidente", page: 1, x: 360, y: 588, fontSize: 11, width: 210 },
  { fieldKey: "envolveu_veiculo", page: 1, x: 140, y: 570, fontSize: 11, width: 160 },
  { fieldKey: "corpo_afetado", page: 1, x: 360, y: 570, fontSize: 11, width: 210 },
  { fieldKey: "lesao", page: 1, x: 140, y: 552, fontSize: 11, width: 160 },
  { fieldKey: "cirurgia", page: 1, x: 360, y: 552, fontSize: 11, width: 120 },
  { fieldKey: "material", page: 1, x: 140, y: 534, fontSize: 11, width: 160 },
  { fieldKey: "outros_material", page: 1, x: 360, y: 534, fontSize: 11, width: 200 },
  { fieldKey: "sequela", page: 1, x: 140, y: 516, fontSize: 11, width: 160 },
  { fieldKey: "outros_sequela", page: 1, x: 360, y: 516, fontSize: 11, width: 200 },
  { fieldKey: "impacto_trabalho", page: 1, x: 140, y: 498, fontSize: 11, width: 160 },
  { fieldKey: "detalhes", page: 1, x: 140, y: 470, fontSize: 11, width: 430, height: 46 },

  { fieldKey: "afastado_inss", page: 1, x: 140, y: 430, fontSize: 11, width: 180 },
  { fieldKey: "tempo_afastado", page: 1, x: 140, y: 414, fontSize: 11, width: 180 },
  { fieldKey: "periodo_graca", page: 1, x: 140, y: 398, fontSize: 11, width: 180 },
  { fieldKey: "app_inss", page: 1, x: 140, y: 382, fontSize: 11, width: 180 },

  { fieldKey: "profissao", page: 1, x: 360, y: 430, fontSize: 11, width: 210 },
  { fieldKey: "clt", page: 1, x: 360, y: 414, fontSize: 11, width: 150 },
  { fieldKey: "apenas_atestado", page: 1, x: 360, y: 398, fontSize: 11, width: 210 },
  { fieldKey: "tempo_atestado", page: 1, x: 360, y: 382, fontSize: 11, width: 210 },
  { fieldKey: "empresa", page: 1, x: 360, y: 366, fontSize: 11, width: 210 },
  { fieldKey: "volta_trabalho", page: 1, x: 360, y: 350, fontSize: 11, width: 210 },

  { fieldKey: "cat_emitida", page: 1, x: 140, y: 322, fontSize: 11, width: 180 },
  { fieldKey: "cat_maos", page: 1, x: 140, y: 306, fontSize: 11, width: 180 },
  { fieldKey: "medico_emite_cat", page: 1, x: 140, y: 290, fontSize: 11, width: 180 },
  { fieldKey: "doc_medicos", page: 1, x: 140, y: 274, fontSize: 11, width: 180 },
  { fieldKey: "observacao_doc", page: 1, x: 140, y: 258, fontSize: 11, width: 230 },
  { fieldKey: "tem_bo", page: 1, x: 140, y: 242, fontSize: 11, width: 150 },

  { fieldKey: "hospital", page: 1, x: 360, y: 322, fontSize: 11, width: 210 },
  { fieldKey: "hospital_estado", page: 1, x: 360, y: 306, fontSize: 11, width: 100 },
  { fieldKey: "hospital_municipio", page: 1, x: 360, y: 290, fontSize: 11, width: 210 },
  { fieldKey: "hospital_endereco", page: 1, x: 360, y: 274, fontSize: 11, width: 210 },
  { fieldKey: "dias_horarios", page: 1, x: 360, y: 242, fontSize: 11, width: 210 },

  { fieldKey: "processos", page: 1, x: 250, y: 210, fontSize: 11, width: 260 },
  { fieldKey: "observacao_final", page: 1, x: 250, y: 194, fontSize: 11, width: 260 },
];
