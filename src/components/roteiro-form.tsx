"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import type {
  InputHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { useSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const labelCell =
  "bg-[#dbe6f9] border border-[#1f3a71] px-2 py-2 text-[11px] font-bold uppercase tracking-tight text-[#1c2d55]";
const valueCell =
  "border border-[#1f3a71] px-2 py-[7px] text-[12px] text-[#1a1a1a]";
const inputBase =
  "w-full bg-transparent text-[12px] leading-tight text-[#1a1a1a] placeholder:text-[#96a0b3] focus:outline-none focus:ring-0";

type FieldProps = {
  fieldKey?: string;
};

function CellInput({
  defaultValue,
  className,
  fieldKey,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & FieldProps) {
  const resolvedKey =
    fieldKey ||
    props.name ||
    (props["aria-label"] as string | undefined) ||
    props.id;

  return (
    <input
      {...props}
      name={props.name ?? resolvedKey}
      data-field-key={resolvedKey}
      defaultValue={defaultValue}
      className={cn(inputBase, className)}
    />
  );
}

function CellTextarea({
  defaultValue,
  rows = 3,
  className,
  fieldKey,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & FieldProps) {
  const resolvedKey =
    fieldKey ||
    props.name ||
    (props["aria-label"] as string | undefined) ||
    props.id;

  return (
    <textarea
      {...props}
      name={props.name ?? resolvedKey}
      data-field-key={resolvedKey}
      defaultValue={defaultValue}
      rows={rows}
      className={cn(
        "w-full resize-none bg-transparent text-[12px] leading-tight text-[#1a1a1a] placeholder:text-[#96a0b3] focus:outline-none focus:ring-0",
        className
      )}
    />
  );
}

function TemplateCard({
  name,
  active,
  onSelect,
}: {
  name: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-center justify-between rounded-md border px-3 py-2 text-left shadow-sm transition hover:border-[#1f3f7c]",
        active ? "border-[#1f3f7c] bg-white" : "border-[#d1d9ec] bg-white/80"
      )}
    >
      <span className="text-sm font-semibold text-[#1c2d55]">{name}</span>
      <span className="text-[11px] uppercase tracking-tight text-[#1f3f7c]">
        Selecionar
      </span>
    </button>
  );
}

export function RoteiroForm({
  forceTemplateId,
  onSubmitted,
  headerAction,
  embedded = false,
}: {
  forceTemplateId?: string | null;
  onSubmitted?: (id: string) => void;
  headerAction?: React.ReactNode;
  embedded?: boolean;
}) {
  const { data: session } = useSession();
  const [especialistaNome, setEspecialistaNome] = useState("");
  const [templates, setTemplates] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [cep, setCep] = useState("");
  const [cepHint, setCepHint] = useState<string | null>(null);
  const [logradouro, setLogradouro] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");
  const [exporting, setExporting] = useState(false);
  const formRef = useRef<HTMLDivElement | null>(null);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const collectFormData = useCallback(() => {
    const data: Record<string, string> = {};
    if (!formRef.current) return data;
    const seenKeys = new Map<string, number>();
    let idx = 0;
    formRef.current.querySelectorAll("input,textarea").forEach((el) => {
      const explicitFieldKey = el.getAttribute("data-field-key");
      const fallbackKey =
        el.getAttribute("name") ||
        el.getAttribute("aria-label") ||
        el.id ||
        `field_${idx++}`;
      const rawKey = explicitFieldKey || fallbackKey;
      const section =
        (el.closest("[data-section]") as HTMLElement | null)?.getAttribute(
          "data-section"
        ) || "";
      const baseKey =
        explicitFieldKey?.trim()
          ? rawKey
          : section && rawKey
            ? `${section}__${rawKey}`
            : rawKey || `field_${idx++}`;
      const count = seenKeys.get(baseKey) ?? 0;
      const resolvedKey = count > 0 ? `${baseKey}_${count + 1}` : baseKey;
      seenKeys.set(baseKey, count + 1);
      const value =
        (el as HTMLInputElement).value ??
        (el.textContent ?? "").toString();
      data[resolvedKey] = value;
    });
    return data;
  }, []);

  const persistSubmission = useCallback(
    async (payload: Record<string, string>) => {
      try {
        setStatusMsg(null);
        const templateId = forceTemplateId ?? selectedTemplateId;
        if (!templateId) {
          setStatusMsg("Selecione um modelo para salvar.");
          return null;
        }
        const submitRes = await fetch("/api/submissions", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            templateId,
            data: payload,
          }),
        });
        const submitJson = await submitRes.json();
        if (!submitRes.ok) {
          setStatusMsg(submitJson?.error || "Falha ao salvar submissão.");
          return null;
        }
        setSubmissionId(submitJson?.submission?.id ?? null);
        setStatusMsg("Submissão salva.");
        return submitJson?.submission?.id ?? null;
      } catch (error) {
        console.error("Erro ao salvar submissão", error);
        setStatusMsg("Não foi possível salvar a submissão.");
        return null;
      }
    },
    [forceTemplateId, selectedTemplateId]
  );

  useEffect(() => {
    if (session?.user?.name) {
      setEspecialistaNome(session.user.name);
    }
  }, [session?.user?.name]);

  useEffect(() => {
    if (forceTemplateId) {
      setSelectedTemplateId(forceTemplateId);
      return;
    }

    (async () => {
      try {
        const res = await fetch("/api/templates", { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        const list =
          data.templates?.map((t: any) => ({ id: t.id, name: t.name })) || [];
        setTemplates(list);
        setSelectedTemplateId(list[0]?.id ?? null);
      } catch {
        // falha silenciosa
      }
    })();
  }, [forceTemplateId]);

  const handleExportPdf = useCallback(async () => {
    if (exporting || !formRef.current) return;
    setExporting(true);
    const formData = collectFormData();
    const savedId = await persistSubmission(formData);
    if (savedId) {
      onSubmitted?.(savedId);
      window.open(`/api/submissions/${savedId}/export`, "_blank");
    }
    setExporting(false);
  }, [collectFormData, exporting, onSubmitted, persistSubmission]);

  const handleCepBlur = useCallback(async () => {
    const numericCep = cep.replace(/\D/g, "");
    if (numericCep.length !== 8) {
      setCepHint("CEP deve ter 8 dígitos.");
      return;
    }
    try {
      const res = await fetch(`https://viacep.com.br/ws/${numericCep}/json/`);
      if (!res.ok) {
        setCepHint("Não foi possível consultar o CEP.");
        return;
      }
      const data = await res.json();
      if (data?.erro) {
        setCepHint("CEP não encontrado.");
        return;
      }
      setCepHint(null);
      setLogradouro(data?.logradouro || "");
      setBairro(data?.bairro || "");
      setCidade(data?.localidade || "");
      setEstado(data?.uf || "");
    } catch {
      setCepHint("Não foi possível consultar o CEP agora.");
    }
  }, [cep]);

  return (
    <div
      className={cn(
        "bg-[#e7ecf5] px-3 py-8 md:px-8",
        embedded ? "min-h-full" : "min-h-screen"
      )}
      style={{ fontFamily: '"Arial","Helvetica",sans-serif' }}
    >
      <main
        id="main-content"
        className="mx-auto w-[940px] max-w-full overflow-hidden rounded-lg border-[3px] border-[#1f3f7c] bg-white shadow-xl print:border-black print:shadow-none"
      >
        <div className="flex items-center justify-between bg-[#0f3e7c] px-4 py-2 text-white">
          <div>
            <span className="text-[13px] font-bold uppercase tracking-tight">
              Modelos de formulário
            </span>
            <p className="text-[12px] text-white/80">
              Selecione um modelo para preencher e salvar.
            </p>
          </div>
          {headerAction}
        </div>
        <div className="border-b border-[#dbe6f9] bg-[#dbe6f9] px-3 py-3">
          <div className="grid gap-3 md:grid-cols-2">
            {forceTemplateId ? (
              <p className="text-sm text-[#1c2d55]">Modelo ativo selecionado.</p>
            ) : (
              templates.map((t) => (
                <TemplateCard
                  key={t.id}
                  name={t.name}
                  active={t.id === selectedTemplateId}
                  onSelect={() => setSelectedTemplateId(t.id)}
                />
              ))
            )}
            {!forceTemplateId && templates.length === 0 && (
              <p className="text-sm text-[#1c2d55]">
                Nenhum modelo disponível ainda.
              </p>
            )}
          </div>
        </div>

        <header
          className="flex items-center justify-between bg-[#0f3e7c] px-4 py-2 text-white"
          data-section="cabecalho"
        >
          <span className="text-[13px] font-bold uppercase tracking-tight">
            Roteiro de visita
          </span>
          <div className="flex flex-wrap items-center gap-3 text-[12px]">
            <div className="flex items-center gap-2">
              <span className="font-semibold">Data:</span>
              <CellInput
                aria-label="Data"
                fieldKey="data_rodape"
                defaultValue="01/13/2025"
                className="w-[118px] rounded-sm border border-white/60 bg-white/10 px-2 py-1 text-white placeholder:text-white/70"
              />
            </div>
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={exporting}
              className="rounded-sm border border-white/60 bg-[#1f5ba8] px-3 py-1 text-[12px] font-semibold uppercase tracking-tight shadow-sm transition hover:bg-[#1a4e93] focus:outline-none disabled:opacity-70"
            >
              {exporting ? "Gerando PDF..." : "Salvar e gerar PDF"}
            </button>
          </div>
        </header>

        <div ref={formRef} className="border-b border-[#dbe6f9]">
        <div className="border-b border-[#1f3f7c] bg-[#dbe6f9] px-3 py-2 text-center text-[12px] font-bold uppercase tracking-tight text-[#1c2d55]">
          Informações pessoais (minuta)-formulário
        </div>

        <table className="w-full border-collapse text-left">
          <tbody data-section="info-pessoal">
            <tr>
              <td className={labelCell}>Especialista em indenização</td>
              <td className={valueCell} colSpan={3}>
                <CellInput
                  aria-label="Especialista em indenização"
                  value={especialistaNome}
                  onChange={(e) => setEspecialistaNome(e.target.value)}
                  placeholder="Nome do usuário logado"
                  fieldKey="especialista"
                />
              </td>
            </tr>
            <tr>
              <td className={labelCell}>Nome completo</td>
              <td className={valueCell}>
                <CellInput
                  aria-label="Nome completo"
                  defaultValue="FABIO LEMOS ESPINHOSA"
                  className="font-semibold uppercase"
                  fieldKey="nome"
                />
              </td>
              <td className={labelCell}>CPF</td>
              <td className={valueCell}>
                <CellInput aria-label="CPF" fieldKey="cpf" />
              </td>
            </tr>
            <tr>
              <td className={labelCell}>Telefone (residência)</td>
              <td className={valueCell}>
                <CellInput aria-label="Telefone residência" fieldKey="telefone" />
              </td>
              <td className={labelCell}>RG</td>
              <td className={valueCell}>
                <CellInput aria-label="RG" fieldKey="rg" />
              </td>
            </tr>
            <tr>
              <td className={labelCell}>Telefone (recado)</td>
              <td className={valueCell}>
                <CellInput
                  aria-label="Telefone recado"
                  defaultValue="16 9946-1763"
                  fieldKey="telefone_recado"
                />
              </td>
              <td className={labelCell}>Orgão emissor</td>
              <td className={valueCell}>
                <CellInput aria-label="Orgão emissor" fieldKey="orgao_emissor" />
              </td>
            </tr>
            <tr>
              <td className={labelCell}>E-mail</td>
              <td className={valueCell}>
                <CellInput aria-label="E-mail" fieldKey="email" />
              </td>
              <td className={labelCell}>Cidade emissão</td>
              <td className={valueCell}>
                <CellInput aria-label="Cidade emissão" fieldKey="cidade_emissao" />
              </td>
            </tr>
            <tr>
              <td className={labelCell}>CEP</td>
              <td className={valueCell}>
                <CellInput
                  aria-label="CEP"
                  fieldKey="cep"
                  value={cep}
                  onChange={(e) => {
                    setCep(e.target.value.replace(/\D/g, "").slice(0, 8));
                    setCepHint(null);
                  }}
                  onBlur={handleCepBlur}
                  placeholder="Somente números"
                  inputMode="numeric"
                />
                {cepHint && (
                  <p className="mt-1 text-[11px] text-[#b45309]">{cepHint}</p>
                )}
              </td>
              <td className={labelCell}>Endereço</td>
              <td className={valueCell}>
                <CellInput
                  aria-label="Endereço"
                  value={logradouro}
                  onChange={(e) => setLogradouro(e.target.value)}
                  fieldKey="endereco"
                />
              </td>
            </tr>
            <tr>
              <td className={labelCell}>Complemento</td>
              <td className={valueCell}>
                <CellInput aria-label="Complemento" fieldKey="complemento" />
              </td>
              <td className={labelCell}>Bairro</td>
              <td className={valueCell}>
                <CellInput
                  aria-label="Bairro"
                  value={bairro}
                  onChange={(e) => setBairro(e.target.value)}
                  fieldKey="bairro"
                />
              </td>
            </tr>
            <tr>
              <td className={labelCell}>Cidade</td>
              <td className={valueCell}>
                <CellInput
                  aria-label="Cidade"
                  value={cidade}
                  onChange={(e) => setCidade(e.target.value)}
                  fieldKey="cidade"
                />
              </td>
              <td className={labelCell}>Estado</td>
              <td className={valueCell}>
                <CellInput
                  aria-label="Estado"
                  value={estado}
                  onChange={(e) => setEstado(e.target.value)}
                  fieldKey="estado"
                />
              </td>
            </tr>
            <tr>
              <td className={labelCell}>Nacionalidade</td>
              <td className={valueCell}>
                <CellInput aria-label="Nacionalidade" fieldKey="nacionalidade" />
              </td>
              <td className={labelCell}>Documento adicional</td>
              <td className={valueCell}>
                <CellInput aria-label="Documento adicional" fieldKey="documento_adicional" />
              </td>
            </tr>
            <tr>
              <td className={labelCell}>Empregado (registro atual)</td>
              <td className={valueCell}>
                <CellInput aria-label="Empregado registro atual" fieldKey="empregado_atual" />
              </td>
              <td className={labelCell}>Estado civil</td>
              <td className={valueCell}>
                <CellInput aria-label="Estado civil" fieldKey="estado_civil" />
              </td>
            </tr>
            <tr>
              <td className={labelCell}>INSS</td>
              <td className={valueCell}>
                <CellInput aria-label="INSS" fieldKey="beneficio_inss" />
              </td>
              <td className={labelCell}>Desempregado (último registro)</td>
              <td className={valueCell}>
                <CellInput aria-label="Desempregado último registro" fieldKey="desempregado_ultimo" />
              </td>
            </tr>
            <tr>
              <td className={labelCell} colSpan={4}>
                Sem | Se No (INSS não obrigatório)
              </td>
            </tr>
          </tbody>
        </table>

        <div className="border-b border-[#1f3f7c] bg-[#1f4e92] px-3 py-2 text-center text-[12px] font-semibold uppercase tracking-tight text-white">
          Informação detalhada sobre o acidente
        </div>

        <table className="w-full border-collapse text-left">
          <tbody data-section="acidente">
            <tr>
              <td className={labelCell}>Data do acidente</td>
              <td className={valueCell}>
                <CellInput
                  aria-label="Data do acidente"
                  defaultValue="01/01/2022"
                  className="font-semibold"
                  fieldKey="data_acidente"
                />
              </td>
              <td className={labelCell}>Como foi o acidente</td>
              <td className={valueCell}>
                <CellInput
                  aria-label="Como foi o acidente"
                  defaultValue="Dentro do trabalho"
                  fieldKey="como_acidente"
                />
              </td>
            </tr>
            <tr>
              <td className={labelCell}>Envolveu veículo</td>
              <td className={valueCell}>
                <CellInput aria-label="Envolveu veículo" fieldKey="envolveu_veiculo" />
              </td>
              <td className={labelCell}>Parte do corpo afetada</td>
              <td className={valueCell}>
                <CellInput
                  aria-label="Parte do corpo afetada"
                  defaultValue="Dedos"
                  fieldKey="corpo_afetado"
                />
              </td>
            </tr>
            <tr>
              <td className={labelCell}>Lesão</td>
              <td className={valueCell}>
                <CellInput aria-label="Lesão" defaultValue="Fratura" fieldKey="lesao" />
              </td>
              <td className={labelCell}>Pós cirurgia</td>
              <td className={valueCell}>
                <CellInput aria-label="Pós cirurgia" defaultValue="Não" fieldKey="cirurgia" />
              </td>
            </tr>
            <tr>
              <td className={labelCell}>Colocou material</td>
              <td className={valueCell}>
                <CellInput aria-label="Colocou material" fieldKey="material" />
              </td>
              <td className={labelCell}>Outros</td>
              <td className={valueCell}>
                <CellInput
                  aria-label="Outros itens"
                  fieldKey="outros_material"
                />
              </td>
            </tr>
            <tr>
              <td className={labelCell}>Sequela</td>
              <td className={valueCell}>
                <CellInput aria-label="Sequela" fieldKey="sequela" />
              </td>
              <td className={labelCell}>Outros</td>
              <td className={valueCell}>
                <CellInput
                  aria-label="Outros complementares"
                  fieldKey="outros_sequela"
                />
              </td>
            </tr>
            <tr>
              <td className={labelCell}>Impacto no trabalho</td>
              <td className={valueCell} colSpan={3}>
                <CellInput aria-label="Impacto no trabalho" defaultValue="Sim" fieldKey="impacto_trabalho" />
              </td>
            </tr>
            <tr>
              <td className={labelCell}>Descreva os detalhes do acidente</td>
              <td className={valueCell} colSpan={3}>
                <CellTextarea
                  aria-label="Descreva os detalhes do acidente"
                  rows={4}
                  defaultValue="TRAVEAVA CAIXA DE LIMA, DO DEDO OCASIONANDO A LESÃO , INCHOU BASTANTE E FICOU ROXO E FOI LEVADO PARA SANTA CASA DE SÃO CARLOS E FOI INSS EDO E FICOU AFASTADO 3 MESES"
                  fieldKey="detalhes"
                />
              </td>
            </tr>
          </tbody>
        </table>

        <div className="grid border-t border-[#1f3f7c] text-white md:grid-cols-2">
          <div className="border-b border-r border-[#1f3f7c] bg-[#1f4e92] px-3 py-2 text-center text-[12px] font-semibold uppercase tracking-tight md:border-b-0">
            INSS
          </div>
          <div className="border-b border-[#1f3f7c] bg-[#1f4e92] px-3 py-2 text-center text-[12px] font-semibold uppercase tracking-tight md:border-b-0">
            Empresa
          </div>
        </div>

        <div className="grid border-b border-[#1f3f7c] md:grid-cols-2">
          <div className="border-r border-[#1f3f7c]">
            <table className="w-full border-collapse text-left">
              <tbody data-section="inss">
                <tr>
                  <td className={labelCell}>Afastado pelo INSS</td>
                  <td className={valueCell}>
                    <CellInput aria-label="Afastado pelo INSS" defaultValue="Sim" fieldKey="afastado_inss" />
                  </td>
                </tr>
                <tr>
                  <td className={labelCell}>Quanto tempo ficou afastado</td>
                  <td className={valueCell}>
                    <CellInput
                      aria-label="Quanto tempo ficou afastado"
                      defaultValue="3 MESES"
                      className="font-semibold"
                      fieldKey="tempo_afastado"
                    />
                  </td>
                </tr>
                <tr>
                  <td className={labelCell}>Estava ou está no período de graça</td>
                  <td className={valueCell}>
                    <CellInput
                      aria-label="Estava ou está no período de graça"
                      defaultValue="Sim"
                      fieldKey="periodo_graca"
                    />
                  </td>
                </tr>
                <tr>
                  <td className={labelCell}>Tem acesso ao app meu INSS</td>
                  <td className={valueCell}>
                    <CellInput
                      aria-label="Tem acesso ao app meu INSS"
                      defaultValue="Não"
                      fieldKey="app_inss"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div>
            <table className="w-full border-collapse text-left">
              <tbody data-section="empresa">
                <tr>
                  <td className={labelCell}>Profissão na época do acidente</td>
                  <td className={valueCell}>
                    <CellInput
                      aria-label="Profissão na época do acidente"
                      defaultValue="AUXILIAR DE DESCARGA"
                      className="font-semibold uppercase"
                      fieldKey="profissao"
                    />
                  </td>
                </tr>
                <tr>
                  <td className={labelCell}>Tinha carteira assinada (CLT)</td>
                  <td className={valueCell}>
                    <CellInput
                      aria-label="Tinha carteira assinada"
                      defaultValue="Sim"
                      fieldKey="clt"
                    />
                  </td>
                </tr>
                <tr>
                  <td className={labelCell}>
                    Não ficou afastado pelo INSS, apenas atestado
                  </td>
                  <td className={valueCell}>
                    <CellInput
                      aria-label="Não ficou afastado pelo INSS, apenas atestado"
                      fieldKey="apenas_atestado"
                    />
                  </td>
                </tr>
                <tr>
                  <td className={labelCell}>Quanto tempo ficou de atestado</td>
                  <td className={valueCell}>
                    <CellInput
                      aria-label="Quanto tempo ficou de atestado"
                      defaultValue="3 MESES"
                      fieldKey="tempo_atestado"
                    />
                  </td>
                </tr>
                <tr>
                  <td className={labelCell}>Empresa amparou</td>
                  <td className={valueCell}>
                    <CellInput aria-label="Empresa amparou" fieldKey="empresa" />
                  </td>
                </tr>
                <tr>
                  <td className={labelCell}>Voltou ao trabalho</td>
                  <td className={valueCell}>
                    <CellInput aria-label="Voltou ao trabalho" fieldKey="volta_trabalho" />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid border-b border-[#1f3f7c] text-white md:grid-cols-2">
          <div className="border-r border-[#1f3f7c] bg-[#1f4e92] px-3 py-2 text-center text-[12px] font-semibold uppercase tracking-tight">
            Documentações
          </div>
          <div className="bg-[#1f4e92] px-3 py-2 text-center text-[12px] font-semibold uppercase tracking-tight">
            Hospital
          </div>
        </div>

        <div className="grid border-b border-[#1f3f7c] md:grid-cols-2">
          <div className="border-r border-[#1f3f7c]">
            <table className="w-full border-collapse text-left">
              <tbody data-section="documentacao">
                <tr>
                  <td className={labelCell}>CAT foi emitida</td>
                  <td className={valueCell}>
                    <CellInput aria-label="CAT foi emitida" defaultValue="Sim" fieldKey="cat_emitida" />
                  </td>
                </tr>
                <tr>
                  <td className={labelCell}>Tem CAT em mãos</td>
                  <td className={valueCell}>
                    <CellInput aria-label="Tem CAT em mãos" defaultValue="Sim" fieldKey="cat_maos" />
                  </td>
                </tr>
                <tr>
                  <td className={labelCell}>Médico emite de hora a CAT</td>
                  <td className={valueCell}>
                    <CellInput aria-label="Médico emite de hora a CAT" fieldKey="medico_emite_cat" />
                  </td>
                </tr>
                <tr>
                  <td className={labelCell}>Tem Doc. Médicos</td>
                  <td className={valueCell}>
                    <CellInput aria-label="Tem Documentos Médicos" defaultValue="Sim" fieldKey="doc_medicos" />
                  </td>
                </tr>
                <tr>
                  <td className={labelCell}>Observação</td>
                  <td className={valueCell}>
                    <CellInput aria-label="Observação documentação" fieldKey="observacao_doc" />
                  </td>
                </tr>
                <tr>
                  <td className={labelCell}>Tem BO</td>
                  <td className={valueCell}>
                    <CellInput aria-label="Tem BO" fieldKey="tem_bo" />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div>
            <table className="w-full border-collapse text-left">
              <tbody data-section="hospital">
                <tr>
                  <td className={labelCell}>Nome do hospital</td>
                  <td className={valueCell}>
                    <CellInput
                      aria-label="Nome do hospital"
                      defaultValue="SANTA CASA DE SÃO CARLOS"
                      className="font-semibold uppercase"
                      fieldKey="hospital"
                    />
                  </td>
                </tr>
                <tr>
                  <td className={labelCell}>Estado</td>
                  <td className={valueCell}>
                    <CellInput aria-label="Estado do hospital" fieldKey="hospital_estado" />
                  </td>
                </tr>
                <tr>
                  <td className={labelCell}>Município</td>
                  <td className={valueCell}>
                    <CellInput aria-label="Município do hospital" fieldKey="hospital_municipio" />
                  </td>
                </tr>
                <tr>
                  <td className={labelCell}>Endereço</td>
                  <td className={valueCell}>
                    <CellInput aria-label="Endereço do hospital" fieldKey="hospital_endereco" />
                  </td>
                </tr>
                <tr>
                  <td className={labelCell} colSpan={2}>
                    Em casos de óbito não terá nenhum documento médico atualizado
                  </td>
                </tr>
                <tr>
                  <td className={labelCell} colSpan={2}>
                    Se houver a possibilidade de ir a uma consulta médica, qual seria a
                    melhor dia da semana e horário?
                  </td>
                </tr>
                <tr>
                  <td className={labelCell}>Dias/Horários</td>
                  <td className={valueCell}>
                    <CellInput aria-label="Dias e horários" fieldKey="dias_horarios" />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        </div>

        <div
          className="space-y-2 border-t border-[#1f3f7c] px-3 py-3 text-[12px] text-[#1a1a1a]"
          data-section="processo"
        >
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
            <span className="font-semibold uppercase text-[#1c2d55]">
              Quais processos em sequência?
            </span>
            <CellInput
              aria-label="Quais processos em sequência"
              defaultValue="Auxílio Acidente"
              className="sm:max-w-[260px]"
              fieldKey="processos"
            />
          </div>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
            <span className="font-semibold uppercase text-[#1c2d55]">
              Observação:
            </span>
            <CellInput aria-label="Observação final" className="sm:flex-1" fieldKey="observacao_final" />
          </div>
          {submissionId && (
            <p className="text-[12px] text-[#1c2d55]">
              Submissão salva: #{submissionId.slice(0, 8)}
            </p>
          )}
          {statusMsg && (
            <p className="text-[12px] text-[#1c2d55]">
              {statusMsg}
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
