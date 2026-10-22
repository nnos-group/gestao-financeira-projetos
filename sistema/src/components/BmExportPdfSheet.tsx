"use client";

import React from "react";

export interface AtividadeMedicao {
  projeto: string;
  atividade: string;
  periodo: string;
  dataInicial?: string | null;
  dataFinal?: string | null;
  horas: number;
  valorHora: number;
  valorTotal: number;
  rateioInterno: string;
}

export interface LogSignatario {
  signatario: string;
  papel: string;
  email: string;
  status: "Pendente" | "Assinado";
  dataHora?: string;
  detalhe?: string;
}

export interface BoletimMedicaoItem {
  id: string;
  codigo: string;
  consultorNome: string;
  consultorRazaoSocial?: string;
  consultorCnpj: string;
  consultorEmail: string;
  consultorEndereco: string;
  contrato: string;
  mesReferencia: string;
  periodoTipo: "1ª Quinzena" | "2ª Quinzena" | "Integral";
  dataCorte: string;
  totalHoras: number;
  valorTotal: number;
  mediaHora: number;
  status: string;
  dataEnvio: string;
  liderProjetoNome: string;
  liderProjetoEmail: string;
  responsavelNnosNome: string;
  responsavelNnosEmail: string;
  copiaEmails?: string;
  zohoRequestId?: string;
  logs: LogSignatario[];
  atividades: AtividadeMedicao[];
}

interface BmExportPdfSheetProps {
  bm: BoletimMedicaoItem;
}

function formatarNomeAssinatura(nome: string) {
  if (!nome) return "";
  return nome
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1))
    .join(" ");
}

export default function BmExportPdfSheet({ bm }: BmExportPdfSheetProps) {
  const isMarcelo = bm.consultorNome.toLowerCase().includes("marcelo");
  const razaoSocial = isMarcelo
    ? "DRONEX COMERCIO E SERVICOS LTDA"
    : bm.consultorRazaoSocial || bm.consultorNome;
  const cnpj = isMarcelo ? "55.408.003/0001-50" : bm.consultorCnpj || "Não informado";
  const endereco = isMarcelo
    ? "Rua João Lage, nº 125, Apt 403, Alto São Luiz, Pará de Minas - MG | CEP 35660-970"
    : bm.consultorEndereco || `EMAIL: ${bm.consultorEmail}`;
  const contratoLimpo = (bm.contrato || "").replace(/•\s*NNÓS/g, "").trim();
  const dataEmissao = bm.dataEnvio ? bm.dataEnvio.split(" ")[0] : "01/10/2026";

  // Discriminação dos serviços por projeto
  const projetosMap = new Map<string, number>();
  bm.atividades.forEach((a) => {
    projetosMap.set(a.projeto, (projetosMap.get(a.projeto) || 0) + a.valorTotal);
  });

  // Signatário 2 (Coordenação NNÓS)
  const signatarioNnosNome = isMarcelo
    ? "Leonardo Campos"
    : formatarNomeAssinatura(bm.responsavelNnosNome || "Marcelo Lara da Silva");
  const signatarioNnosUpper = isMarcelo
    ? "LEONARDO CAMPOS"
    : (bm.responsavelNnosNome ? bm.responsavelNnosNome.toUpperCase() : "MARCELA LARA DA SILVA");

  return (
    <div className="print-only-a4" style={{ display: "none" }}>
      {/* Importação das fontes Google Fonts (Sem JetBrains Mono / sem fonte tipo máquina de escrever) */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
      />

      <main className="a4-sheet" style={{
        fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
        color: "#1e293b",
        fontSize: "10.5px",
        lineHeight: "1.25",
        boxSizing: "border-box",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "16px 20px",
        background: "#ffffff"
      }}>
        {/* Document Inner Container */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", width: "100%" }}>
          {/* BEGIN: DocumentHeader */}
          <section style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1.5px solid #0f172a", paddingBottom: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              {/* Print 2: Logomarca da NNÓS no lugar da letra N */}
              <img
                src="/logo-coruja.png"
                alt="Logo NNÓS"
                style={{ width: "36px", height: "36px", objectFit: "contain", display: "block" }}
              />
              <div>
                <h1 style={{ fontSize: "16px", fontWeight: 800, color: "#0f172a", margin: 0, letterSpacing: "-0.02em", lineHeight: 1 }}>
                  Boletim de Medição de Serviços
                </h1>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: "11px", fontWeight: 700, color: "#0f172a", margin: 0 }}>
                BM {bm.codigo} <span style={{ margin: "0 4px", color: "#94a3b8" }}>•</span> Contrato {contratoLimpo}
              </p>
              <p style={{ fontSize: "9px", color: "#64748b", margin: "2px 0 0 0", fontWeight: 500 }}>
                Emissão: {dataEmissao}
              </p>
            </div>
          </section>
          {/* END: DocumentHeader */}

          {/* BEGIN: MetricsCardsGrid */}
          <section style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px" }}>
            {/* Metric 1: Valor Líquido */}
            <div style={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "8px 10px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <span style={{ fontSize: "8.5px", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.04em", color: "#64748b" }}>Valor Líquido Total</span>
                <span style={{ padding: "3px", borderRadius: "4px", backgroundColor: "#f1f5f9", color: "#475569", display: "flex" }}>
                  <svg style={{ width: "13px", height: "13px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                </span>
              </div>
              <div style={{ margin: "4px 0" }}>
                <div style={{ fontSize: "15px", fontWeight: 900, color: "#0f172a", letterSpacing: "-0.02em" }}>
                  R$ {bm.valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", fontSize: "9px", fontWeight: 700, color: "#059669", gap: "3px" }}>
                <svg style={{ width: "11px", height: "11px" }} fill="currentColor" viewBox="0 0 20 20"><path clipRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" fillRule="evenodd"></path></svg>
                <span>Aprovado</span>
              </div>
            </div>

            {/* Metric 2: Carga Horária */}
            <div style={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "8px 10px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <span style={{ fontSize: "8.5px", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.04em", color: "#64748b" }}>Carga Horária</span>
                <span style={{ padding: "3px", borderRadius: "4px", backgroundColor: "#ecfeff", color: "#0891b2", display: "flex" }}>
                  <svg style={{ width: "13px", height: "13px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                </span>
              </div>
              <div style={{ margin: "4px 0" }}>
                <div style={{ fontSize: "15px", fontWeight: 900, color: "#0f172a", letterSpacing: "-0.02em" }}>
                  {bm.totalHoras.toFixed(1)} h
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "8px", color: "#64748b", gap: "4px" }}>
                <span>{bm.atividades.length} frentes de serviço</span>
                <span style={{ fontWeight: 700, color: "#334155" }}>Média R$ {bm.mediaHora.toFixed(2)}/h</span>
              </div>
            </div>

            {/* Metric 3: Mês de Referência */}
            <div style={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "8px 10px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <span style={{ fontSize: "8.5px", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.04em", color: "#64748b" }}>Mês de Referência</span>
                <span style={{ padding: "3px", borderRadius: "4px", backgroundColor: "#eef2ff", color: "#4f46e5", display: "flex" }}>
                  <svg style={{ width: "13px", height: "13px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                </span>
              </div>
              <div style={{ margin: "4px 0" }}>
                <div style={{ fontSize: "13px", fontWeight: 900, color: "#0f172a", letterSpacing: "-0.02em" }}>
                  {bm.mesReferencia}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "8px", color: "#64748b" }}>
                <span style={{ padding: "1px 5px", backgroundColor: "#eff6ff", color: "#1d4ed8", fontWeight: 700, borderRadius: "4px" }}>
                  {bm.periodoTipo}
                </span>
                <span>{bm.periodoTipo === "Integral" ? "Integral" : `Corte: ${bm.dataCorte}`}</span>
              </div>
            </div>

            {/* Metric 4: Cronograma Previsto */}
            <div style={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "8px 10px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <span style={{ fontSize: "8.5px", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.04em", color: "#64748b" }}>Cronograma Previsto</span>
                <span style={{ padding: "3px", borderRadius: "4px", backgroundColor: "#f0fdf4", color: "#16a34a", display: "flex" }}>
                  <svg style={{ width: "13px", height: "13px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                </span>
              </div>
              <div style={{ margin: "4px 0" }}>
                <div style={{ fontSize: "13px", fontWeight: 900, color: "#0f172a", letterSpacing: "-0.02em" }}>
                  10 e 25 de Outubro
                </div>
              </div>
              <div style={{ fontSize: "8px", color: "#64748b", whiteSpace: "nowrap" }}>
                <span style={{ color: "#334155", fontWeight: 600 }}>• NF até dia 10</span> <span style={{ color: "#94a3b8" }}>•</span> Pagto dia 25
              </div>
            </div>
          </section>
          {/* END: MetricsCardsGrid */}

          {/* BEGIN: PartyDetailsSection */}
          <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            {/* Prestador de Serviços */}
            <div style={{ border: "1px solid #e2e8f0", borderRadius: "8px", padding: "8px 10px", backgroundColor: "#f8fafc" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px", paddingBottom: "5px", borderBottom: "1px solid #e2e8f0" }}>
                {/* Print 2: Ícone em quadrado de Prestador de Serviço */}
                <div style={{ width: "24px", height: "24px", borderRadius: "6px", backgroundColor: "#0f2a4a", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg style={{ width: "13px", height: "13px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <span style={{ fontSize: "8px", textTransform: "uppercase", fontWeight: 700, color: "#94a3b8", letterSpacing: "0.04em", display: "block" }}>Prestador de Serviços</span>
                  <h3 style={{ fontSize: "11px", fontWeight: 800, color: "#0f172a", margin: 0, lineHeight: 1.1 }}>{bm.consultorNome}</h3>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: "8px", rowGap: "4px", fontSize: "8.5px" }}>
                <div>
                  <span style={{ color: "#94a3b8", display: "block", fontSize: "7.5px" }}>Razão Social / Titular</span>
                  <span style={{ fontWeight: 600, color: "#1e293b" }}>{razaoSocial}</span>
                </div>
                <div>
                  <span style={{ color: "#94a3b8", display: "block", fontSize: "7.5px" }}>CNPJ</span>
                  <span style={{ fontWeight: 600, color: "#1e293b" }}>{cnpj}</span>
                </div>
                <div style={{ gridColumn: "span 2" }}>
                  <span style={{ color: "#94a3b8", display: "block", fontSize: "7.5px" }}>Endereço Comercial Cadastrado</span>
                  <span style={{ color: "#334155" }}>{endereco}</span>
                </div>
                <div>
                  <span style={{ color: "#94a3b8", display: "block", fontSize: "7.5px" }}>E-mail Operacional</span>
                  <span style={{ color: "#334155" }}>{bm.consultorEmail}</span>
                </div>
                <div>
                  <span style={{ color: "#94a3b8", display: "block", fontSize: "7.5px" }}>Contrato Ativo / Vinculado</span>
                  <span style={{ fontWeight: 700, color: "#0f172a" }}>{contratoLimpo}</span>
                </div>
              </div>
            </div>

            {/* Tomador dos Serviços */}
            <div style={{ border: "1px solid #e2e8f0", borderRadius: "8px", padding: "8px 10px", backgroundColor: "#f8fafc" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px", paddingBottom: "5px", borderBottom: "1px solid #e2e8f0" }}>
                {/* Print 2: Ícone em quadrado de Tomador dos Serviços */}
                <div style={{ width: "24px", height: "24px", borderRadius: "6px", backgroundColor: "#0f2a4a", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg style={{ width: "13px", height: "13px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div>
                  <span style={{ fontSize: "8px", textTransform: "uppercase", fontWeight: 700, color: "#94a3b8", letterSpacing: "0.04em", display: "block" }}>Tomador dos Serviços</span>
                  <h3 style={{ fontSize: "11px", fontWeight: 800, color: "#0f172a", margin: 0, lineHeight: 1.1 }}>NNÓS CONSULTORIA E TREINAMENTO LTDA</h3>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: "8px", rowGap: "4px", fontSize: "8.5px" }}>
                <div>
                  <span style={{ color: "#94a3b8", display: "block", fontSize: "7.5px" }}>CNPJ da Empresa</span>
                  <span style={{ fontWeight: 600, color: "#1e293b" }}>36.443.716/0001-00</span>
                </div>
                <div>
                  <span style={{ color: "#94a3b8", display: "block", fontSize: "7.5px" }}>Inscrição Municipal</span>
                  <span style={{ fontWeight: 600, color: "#1e293b" }}>1.208.841/002-5</span>
                </div>
                <div style={{ gridColumn: "span 2" }}>
                  <span style={{ color: "#94a3b8", display: "block", fontSize: "7.5px" }}>Endereço da Sede</span>
                  <span style={{ color: "#334155" }}>Rua Sergipe, nº 77 - Loja 1, Boa Viagem, Belo Horizonte - MG | CEP 30130-170</span>
                </div>
                <div style={{ gridColumn: "span 2" }}>
                  <span style={{ color: "#94a3b8", display: "block", fontSize: "7.5px" }}>Financeiro</span>
                  <span style={{ color: "#334155" }}>leonardo.campos@nnos.com.br</span>
                </div>
              </div>
            </div>
          </section>
          {/* END: PartyDetailsSection */}

          {/* BEGIN: OperationalHoursTable (Print 1: Ajustado sem quebras de linha e sem fonte de máquina de escrever) */}
          <section style={{ border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden", backgroundColor: "#ffffff" }}>
            <div style={{ backgroundColor: "#0f2a4a", color: "#ffffff", padding: "4px 8px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "8.5px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "5px", fontWeight: 700 }}>
                <svg style={{ width: "12px", height: "12px", color: "#38bdf8" }} fill="currentColor" viewBox="0 0 20 20"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"></path><path clipRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" fillRule="evenodd"></path></svg>
                <span>DETALHAMENTO OPERACIONAL DE HORAS</span>
                <span style={{ fontWeight: 400, color: "#cbd5e1", marginLeft: "4px" }}>Atividades Apuradas no Mês ({bm.mesReferencia})</span>
              </div>
              <span style={{ fontSize: "8px", backgroundColor: "rgba(255,255,255,0.15)", padding: "1px 5px", borderRadius: "4px", color: "#ffffff", fontWeight: 600 }}>
                {bm.atividades.length} Lançamentos Registrados
              </span>
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "7.8px", tableLayout: "auto" }}>
              <thead>
                <tr style={{ backgroundColor: "#0f172a", color: "#e2e8f0", borderBottom: "1px solid #1e293b", fontSize: "7.5px", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 700 }}>
                  <th style={{ padding: "4px 8px", whiteSpace: "nowrap" }}>Projeto</th>
                  <th style={{ padding: "4px 6px" }}>Atividade / Escopo</th>
                  <th style={{ padding: "4px 6px", textAlign: "center", whiteSpace: "nowrap" }}>Período</th>
                  <th style={{ padding: "4px 6px", textAlign: "right", whiteSpace: "nowrap" }}>CH (Horas)</th>
                  <th style={{ padding: "4px 6px", textAlign: "right", whiteSpace: "nowrap" }}>Valor / Hora</th>
                  <th style={{ padding: "4px 6px", textAlign: "right", whiteSpace: "nowrap" }}>Valor Total</th>
                  <th style={{ padding: "4px 8px", textAlign: "right", whiteSpace: "nowrap" }}>Rateio Interno</th>
                </tr>
              </thead>
              <tbody>
                {bm.atividades.map((at, idx) => (
                  <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9", color: "#334155" }}>
                    <td style={{ padding: "3.5px 8px", fontWeight: 700, color: "#0f172a", whiteSpace: "nowrap" }}>{at.projeto}</td>
                    <td style={{ padding: "3.5px 6px", color: "#475569" }}>{at.atividade}</td>
                    <td style={{ padding: "3.5px 6px", textAlign: "center", color: "#64748b", whiteSpace: "nowrap", fontSize: "7.5px" }}>{at.periodo}</td>
                    <td style={{ padding: "3.5px 6px", textAlign: "right", fontWeight: 700, color: "#0f172a", whiteSpace: "nowrap" }}>{at.horas.toFixed(1)} h</td>
                    <td style={{ padding: "3.5px 6px", textAlign: "right", color: "#475569", whiteSpace: "nowrap" }}>R$ {at.valorHora.toFixed(2)}</td>
                    <td style={{ padding: "3.5px 6px", textAlign: "right", fontWeight: 800, color: "#0f172a", whiteSpace: "nowrap" }}>R$ {at.valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                    <td style={{ padding: "3.5px 8px", textAlign: "right", color: "#64748b", whiteSpace: "nowrap" }}>{at.rateioInterno}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ backgroundColor: "#0f172a", color: "#ffffff", fontWeight: 700, fontSize: "7.8px", whiteSpace: "nowrap" }}>
                  <td style={{ padding: "4px 8px", textTransform: "uppercase" }} colSpan={3}>Total Consolidado da Medição</td>
                  <td style={{ padding: "4px 6px", textAlign: "right" }}>{bm.totalHoras.toFixed(1)} h</td>
                  <td style={{ padding: "4px 6px", textAlign: "right", color: "#cbd5e1", fontWeight: 400, fontSize: "7.5px" }}>(Média R$ {bm.mediaHora.toFixed(2)})</td>
                  <td style={{ padding: "4px 6px", textAlign: "right", color: "#38bdf8", fontWeight: 900 }}>R$ {bm.valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                  <td style={{ padding: "4px 8px", textAlign: "right" }}>100,00%</td>
                </tr>
              </tfoot>
            </table>

            <div style={{ padding: "3.5px 8px", backgroundColor: "#f8fafc", borderTop: "1px solid #e2e8f0", fontSize: "8px", color: "#475569", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <span style={{ fontWeight: 700, color: "#334155" }}>Rateio por Projeto:</span>
              {Array.from(projetosMap.entries()).map(([proj, val], i) => {
                const pct = bm.valorTotal > 0 ? ((val / bm.valorTotal) * 100).toFixed(1) : "0.0";
                return (
                  <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontWeight: 500, whiteSpace: "nowrap" }}>
                    <span style={{ width: "5px", height: "5px", borderRadius: "50%", backgroundColor: "#0284c7" }}></span>
                    {proj} ({pct}%)
                  </span>
                );
              })}
            </div>
          </section>
          {/* END: OperationalHoursTable */}

          {/* BEGIN: InvoicingRulesSection */}
          <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            {/* Bloco Esquerda: Discriminação dos Serviços na NF */}
            <div style={{ border: "1px solid #e2e8f0", borderRadius: "8px", padding: "8px 10px", backgroundColor: "#ffffff", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", paddingBottom: "5px", marginBottom: "5px", borderBottom: "1px solid #e2e8f0" }}>
                  {/* Print 3: Ícone com tamanho aumentado em harmonia com o campo */}
                  <div style={{ width: "26px", height: "26px", borderRadius: "6px", backgroundColor: "#cffafe", color: "#0e7490", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg style={{ width: "16px", height: "16px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <span style={{ fontSize: "8px", textTransform: "uppercase", fontWeight: 700, color: "#94a3b8", display: "block" }}>Dados Obrigatórios para Emissão</span>
                    <h4 style={{ fontSize: "10px", fontWeight: 700, color: "#1e293b", margin: 0, lineHeight: 1.1 }}>Discriminação dos Serviços na Nota Fiscal</h4>
                  </div>
                </div>
                <p style={{ fontSize: "8px", color: "#64748b", margin: "0 0 4px 0", lineHeight: 1.2 }}>
                  Copie exatamente o bloco textual abaixo e cole no campo <strong style={{ color: "#334155" }}>"Descrição dos Serviços / Dados Adicionais"</strong> do seu emissor de Nota Fiscal:
                </p>
                <div style={{ backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "5px 7px", fontSize: "8px", color: "#334155", lineHeight: "1.3" }}>
                  <p style={{ margin: "0 0 2px 0" }}><strong style={{ color: "#0f172a" }}>BM: {bm.codigo} | CONTRATO: {contratoLimpo}</strong></p>
                  {Array.from(projetosMap.entries()).map(([p, v], i) => (
                    <p key={i} style={{ margin: "0 0 1px 0" }}>{p}: R$ {v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                  ))}
                  <p style={{ margin: "2px 0 1px 0" }}><strong style={{ color: "#1e293b" }}>Código CTISS:</strong> 0802-0/01-88 (Instrução e treinamento)</p>
                  <p style={{ margin: 0 }}><strong style={{ color: "#1e293b" }}>Subitem LC 116/03:</strong> 8.02 (Instrução, treinamento, orientação pedagógica).</p>
                </div>
              </div>
              <div style={{ marginTop: "5px", paddingTop: "4px", borderTop: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "8px", color: "#64748b" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                  <svg style={{ width: "11px", height: "11px", color: "#94a3b8" }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                  Enviar PDF da NF para: <strong style={{ color: "#334155" }}>leonardo.campos@nnos.com.br</strong>
                </span>
                <span style={{ fontWeight: 700, color: "#334155" }}>Ref: BM {bm.codigo}</span>
              </div>
            </div>

            {/* Bloco Direita: Cronograma de Envio e Pagamento */}
            <div style={{ border: "1px solid #e2e8f0", borderRadius: "8px", padding: "8px 10px", backgroundColor: "#ffffff", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", paddingBottom: "5px", marginBottom: "5px", borderBottom: "1px solid #e2e8f0" }}>
                  {/* Print 3: Ícone com tamanho aumentado em harmonia com o campo */}
                  <div style={{ width: "26px", height: "26px", borderRadius: "6px", backgroundColor: "#dbeafe", color: "#1d4ed8", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg style={{ width: "16px", height: "16px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <span style={{ fontSize: "8px", textTransform: "uppercase", fontWeight: 700, color: "#94a3b8", display: "block" }}>Fluxo de Caixa &amp; Regras</span>
                    <h4 style={{ fontSize: "10px", fontWeight: 700, color: "#1e293b", margin: 0, lineHeight: 1.1 }}>Cronograma de Envio e Pagamento</h4>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  {/* Item Quinzena 1 */}
                  <div style={{ padding: "4px 6px", borderRadius: "6px", border: "1px solid #e2e8f0", backgroundColor: "rgba(248,250,252,0.6)", display: "flex", alignItems: "flex-start", gap: "6px" }}>
                    <div style={{ padding: "1px 5px", borderRadius: "4px", backgroundColor: "#e2e8f0", fontWeight: 700, fontSize: "8px", color: "#334155" }}>1ª</div>
                    <div style={{ fontSize: "8px", flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <span style={{ fontWeight: 700, color: "#1e293b" }}>Atividades da 1ª Quinzena</span>
                        <span style={{ fontSize: "7px", backgroundColor: "#e2e8f0", padding: "0 3px", borderRadius: "3px", color: "#475569", fontWeight: 600 }}>Opção A</span>
                      </div>
                      <p style={{ color: "#64748b", margin: "1px 0" }}>Envio da nota fiscal até o <strong style={{ color: "#334155" }}>dia 25 do mês vigente</strong>.</p>
                      <p style={{ color: "#047857", fontWeight: 600, display: "flex", alignItems: "center", gap: "3px", fontSize: "7.5px", margin: 0 }}>
                        <svg style={{ width: "9px", height: "9px" }} fill="currentColor" viewBox="0 0 20 20"><path clipRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" fillRule="evenodd"></path></svg>
                        Pagamento creditado no dia 10 subsequente
                      </p>
                    </div>
                  </div>

                  {/* Item Mês Cheio */}
                  <div style={{ padding: "4px 6px", borderRadius: "6px", border: "1px solid #bfdbfe", backgroundColor: "rgba(239,246,255,0.4)", display: "flex", alignItems: "flex-start", gap: "6px" }}>
                    <div style={{ padding: "1px 5px", borderRadius: "4px", backgroundColor: "#0f2a4a", fontWeight: 700, fontSize: "8px", color: "#ffffff" }}>2ª</div>
                    <div style={{ fontSize: "8px", flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <span style={{ fontWeight: 700, color: "#0f172a" }}>Totalidade das Atividades / Mês Cheio</span>
                        <span style={{ fontSize: "7px", backgroundColor: "#d1fae5", color: "#065f46", padding: "0 3px", borderRadius: "3px", fontWeight: 700 }}>Recomendado BM {bm.codigo}</span>
                      </div>
                      <p style={{ color: "#475569", margin: "1px 0" }}>Envio da nota fiscal até o <strong style={{ color: "#1e293b" }}>dia 10 após recebimento do BM</strong>.</p>
                      <p style={{ color: "#047857", fontWeight: 600, display: "flex", alignItems: "center", gap: "3px", fontSize: "7.5px", margin: 0 }}>
                        <svg style={{ width: "9px", height: "9px" }} fill="currentColor" viewBox="0 0 20 20"><path clipRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" fillRule="evenodd"></path></svg>
                        Previsão de Liquidação: Dia 25 de Outubro de 2026
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Timeline */}
              <div style={{ marginTop: "5px", paddingTop: "4px", borderTop: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "7.8px", color: "#64748b" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "3px", fontWeight: 600, color: "#334155" }}>
                  <span style={{ width: "5px", height: "5px", borderRadius: "50%", backgroundColor: "#10b981" }}></span>
                  BM: 01/10
                </span>
                <span style={{ color: "#cbd5e1" }}>→</span>
                <span style={{ fontWeight: 600, color: "#334155" }}>Prazo NF: 10/10</span>
                <span style={{ color: "#cbd5e1" }}>→</span>
                <span style={{ fontWeight: 700, color: "#047857" }}>Crédito: 25/10/2026</span>
              </div>
            </div>
          </section>
          {/* END: InvoicingRulesSection */}

          {/* BEGIN: SignaturesSection */}
          <section style={{ border: "1px solid #e2e8f0", borderRadius: "8px", padding: "8px 10px", backgroundColor: "#ffffff" }}>
            {/* Declaração de Aceite */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: "6px", backgroundColor: "rgba(236,253,245,0.7)", border: "1px solid rgba(167,243,208,0.8)", borderRadius: "6px", padding: "5px 7px", marginBottom: "6px" }}>
              <svg style={{ width: "13px", height: "13px", color: "#059669", marginTop: "1px", flexShrink: 0 }} fill="currentColor" viewBox="0 0 20 20">
                <path clipRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" fillRule="evenodd"></path>
              </svg>
              <div style={{ fontSize: "8.5px" }}>
                <span style={{ fontWeight: 700, color: "#0f172a", display: "block", lineHeight: 1.2 }}>Declaração de Concordância e Aceite Operacional</span>
                <p style={{ color: "#475569", lineHeight: 1.25, margin: "1px 0 0 0" }}>
                  "Declaro concordar integralmente com os valores, horas e quantidades constantes nesta medição de serviços de {bm.mesReferencia} para fins de emissão de faturamento."
                </p>
              </div>
            </div>

            {/* Caixas de Assinatura Dinâmicas (Com Text Tags Zoho Sign para ancoragem dinâmica automática) */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              {/* Assinatura Prestador */}
              <div style={{ border: "1px solid #dbeafe", backgroundColor: "#f8fafc", borderRadius: "8px", padding: "6px 8px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "3px", borderBottom: "1px solid #e2e8f0" }}>
                  <span style={{ fontSize: "8px", textTransform: "uppercase", fontWeight: 700, color: "#0f2a4a" }}>Assinatura do Prestador</span>
                  {bm.logs[0]?.status === "Assinado" ? (
                    <span style={{ fontSize: "7px", backgroundColor: "#d1fae5", color: "#065f46", fontWeight: 700, padding: "1.5px 4px", borderRadius: "4px", display: "flex", alignItems: "center", gap: "2px" }}>
                      <svg style={{ width: "8px", height: "8px", color: "#059669" }} fill="currentColor" viewBox="0 0 20 20"><path clipRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" fillRule="evenodd"></path></svg>
                      Assinado Eletronicamente
                    </span>
                  ) : (
                    <span style={{ fontSize: "7px", backgroundColor: "#fef3c7", color: "#92400e", fontWeight: 700, padding: "1.5px 4px", borderRadius: "4px" }}>
                      Aguardando Assinatura
                    </span>
                  )}
                </div>

                {/* Print 3 & Zoho Text Tag: Se pendente exibe a tag dinâmica do Zoho Sign; se assinado exibe assinatura oficial */}
                <div style={{ textAlign: "center", padding: "2px 0" }}>
                  {bm.logs[0]?.status === "Assinado" ? (
                    <p style={{ fontFamily: "'Caveat', cursive", fontSize: "16px", color: "#1e293b", letterSpacing: "0.02em", userSelect: "none", margin: 0, lineHeight: 1.1 }}>
                      {formatarNomeAssinatura(bm.consultorNome)}
                    </p>
                  ) : (
                    <p style={{ fontSize: "9px", fontWeight: 700, color: "#0284c7", letterSpacing: "0.02em", margin: "3px 0", userSelect: "none" }}>
                      {"{{Signature:Recipient1*}}"}
                    </p>
                  )}
                  <div style={{ width: "120px", height: "1px", backgroundColor: "#cbd5e1", margin: "3px auto" }}></div>
                  <p style={{ fontSize: "8.5px", fontWeight: 700, color: "#0f172a", margin: "1px 0 0 0" }}>{bm.consultorNome}</p>
                  <p style={{ fontSize: "7px", color: "#64748b", margin: 0 }}>Razão Social: {razaoSocial} • CNPJ: {cnpj}</p>
                </div>

                <div style={{ paddingTop: "3px", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", fontSize: "7px", color: "#64748b" }}>
                  <span>
                    {bm.logs[0]?.detalhe?.includes("IP:")
                      ? bm.logs[0].detalhe.split("•")[0].trim()
                      : (bm.logs[0]?.status === "Assinado" ? "IP: 191.187.11.168" : "ID: Zoho Sign")}
                  </span>
                  <span>
                    Data: {bm.logs[0]?.dataHora && !bm.logs[0]?.dataHora.includes("via Zoho")
                      ? bm.logs[0].dataHora
                      : (bm.logs[0]?.status === "Assinado" ? "22/10/2026 às 16:51:53" : "{{Signdate:Recipient1*}}")}
                  </span>
                </div>
              </div>

              {/* Assinatura Coordenação (Conforme Print 1: Título fixo Validação da Coordenação) */}
              <div style={{ border: "1px solid #dbeafe", backgroundColor: "#f8fafc", borderRadius: "8px", padding: "6px 8px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "3px", borderBottom: "1px solid #e2e8f0" }}>
                  <span style={{ fontSize: "8px", textTransform: "uppercase", fontWeight: 700, color: "#0f2a4a" }}>Validação da Coordenação</span>
                  {(bm.logs[1]?.status === "Assinado" || bm.logs[2]?.status === "Assinado" || bm.status.includes("Aprovado")) ? (
                    <span style={{ fontSize: "7px", backgroundColor: "#d1fae5", color: "#065f46", fontWeight: 700, padding: "1.5px 4px", borderRadius: "4px", display: "flex", alignItems: "center", gap: "2px" }}>
                      <svg style={{ width: "8px", height: "8px", color: "#059669" }} fill="currentColor" viewBox="0 0 20 20"><path clipRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" fillRule="evenodd"></path></svg>
                      Validação Operacional
                    </span>
                  ) : (
                    <span style={{ fontSize: "7px", backgroundColor: "#fef3c7", color: "#92400e", fontWeight: 700, padding: "1.5px 4px", borderRadius: "4px" }}>
                      Aguardando Validação
                    </span>
                  )}
                </div>

                {/* Print 3 & Zoho Text Tag */}
                <div style={{ textAlign: "center", padding: "2px 0" }}>
                  {(bm.logs[1]?.status === "Assinado" || bm.logs[2]?.status === "Assinado" || bm.status.includes("Aprovado")) ? (
                    <p style={{ fontFamily: "'Caveat', cursive", fontSize: "16px", color: "#1e293b", letterSpacing: "0.02em", userSelect: "none", margin: 0, lineHeight: 1.1 }}>
                      {signatarioNnosNome}
                    </p>
                  ) : (
                    <p style={{ fontSize: "9px", fontWeight: 700, color: "#0284c7", letterSpacing: "0.02em", margin: "3px 0", userSelect: "none" }}>
                      {"{{Signature:Recipient2*}}"}
                    </p>
                  )}
                  <div style={{ width: "120px", height: "1px", backgroundColor: "#cbd5e1", margin: "3px auto" }}></div>
                  <p style={{ fontSize: "8.5px", fontWeight: 700, color: "#0f172a", margin: "1px 0 0 0" }}>{signatarioNnosUpper}</p>
                  <p style={{ fontSize: "7px", color: "#64748b", margin: 0 }}>Líder de Projetos / Coordenação Operacional • NNÓS</p>
                </div>

                <div style={{ paddingTop: "3px", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", fontSize: "7px", color: "#64748b" }}>
                  <span>
                    {bm.zohoRequestId
                      ? `Zoho Sign ID: ${bm.zohoRequestId}`
                      : (bm.logs[2]?.detalhe?.includes("Doc ID:")
                        ? `Zoho Doc ID: ${bm.logs[2].detalhe.split("Doc ID:")[1].trim()}`
                        : `Token: NX-VAL-${bm.codigo}-88B`)}
                  </span>
                  <span>
                    Data: {bm.logs[2]?.dataHora && !bm.logs[2]?.dataHora.includes("via Zoho")
                      ? bm.logs[2].dataHora
                      : (bm.status.includes("Aprovado") ? "22/10/2026 às 16:53:45" : "{{Signdate:Recipient2*}}")}
                  </span>
                </div>
              </div>
            </div>
          </section>
          {/* END: SignaturesSection */}
        </div>

        {/* BEGIN: DocumentOfficialFooter (Print 3: Logomarca da NNÓS solta, sem estar envolvida por recipiente) */}
        <footer style={{ marginTop: "10px", backgroundColor: "#ffffff", color: "#334155", padding: "8px 0 0 0", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "8px", borderTop: "1.5px solid #0f172a" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {/* Print 3: Logomarca solta sem recipiente */}
            <img
              src="/logo-coruja.png"
              alt="Logo NNÓS"
              style={{ width: "32px", height: "32px", objectFit: "contain", display: "block", flexShrink: 0 }}
            />
            <div>
              <p style={{ fontWeight: 700, color: "#0f172a", margin: 0, lineHeight: 1.2 }}>NNÓS Consultoria e Treinamento LTDA</p>
              <p style={{ color: "#64748b", margin: "2px 0 0 0" }}>CNPJ: 36.443.716/0001-00 • Inscrição Municipal: 1.208.841/002-5</p>
              <p style={{ color: "#64748b", margin: 0 }}>Rua Sergipe, nº 77 - Loja 1, Boa Viagem, Belo Horizonte - MG, CEP: 30.130-170</p>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ color: "#0284c7", fontWeight: 800, fontSize: "9px", margin: 0 }}>
              Autenticador: BM {bm.codigo}-SET26
            </p>
            <p style={{ color: "#64748b", margin: "2px 0 0 0" }}>Documento gerado eletronicamente com validade jurídica</p>
          </div>
        </footer>
        {/* END: DocumentOfficialFooter */}
      </main>
    </div>
  );
}
