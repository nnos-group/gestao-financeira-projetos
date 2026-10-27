"use client";

import React, { useState, useMemo } from "react";
import ConsultorHeader from "@/components/ConsultorHeader";
import { useConsultor } from "@/contexts/ConsultorContext";
import ModernDropdown from "@/components/ModernDropdown";
import { formatarPeriodoBR, formatarDataBR } from "@/lib/date-utils";

import BmExportPdfSheet from "@/components/BmExportPdfSheet";

export default function ConsultorBmsPage() {
  const { consultorAtivo, dadosConsultor } = useConsultor();
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("Todos");
  const [bmVisualizando, setBmVisualizando] = useState<any | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const bmsOriginais = dadosConsultor?.bms || [];

  const bmsFiltrados = useMemo(() => {
    return bmsOriginais.filter((bm: any) => {
      if (filtroStatus !== "Todos" && bm.status !== filtroStatus) return false;
      if (busca.trim()) {
        const q = busca.toLowerCase();
        const cod = String(bm.codigo || "").toLowerCase();
        const nome = String(bm.consultorNome || "").toLowerCase();
        const ref = String(bm.mesReferencia || "").toLowerCase();
        const contrato = String(bm.contrato || "").toLowerCase();
        return cod.includes(q) || nome.includes(q) || ref.includes(q) || contrato.includes(q);
      }
      return true;
    });
  }, [bmsOriginais, filtroStatus, busca]);

  const brl = (val: number | null | undefined) =>
    (val || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const formatarNomeAssinatura = (nome: string) => {
    if (!nome) return "Consultor";
    return nome
      .toLowerCase()
      .split(" ")
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(" ");
  };

  const handleCopyNfTexto = (bm: any) => {
    const linhasProjetos = Array.from(new Set((bm.atividades || []).map((a: any) => a.projeto)))
      .map((proj: any) => {
        const sub = (bm.atividades || [])
          .filter((a: any) => a.projeto === proj)
          .reduce((acc: number, a: any) => acc + (a.valorTotal || 0), 0);
        return `${proj}: R$ ${sub.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
      })
      .join("\n");

    const texto = `BM: ${bm.codigo} | CONTRATO: ${String(bm.contrato || "").replace(/•\s*NNÓS/g, "").trim()}\n${linhasProjetos}`;

    navigator.clipboard.writeText(texto);
    showToast("Discriminação copiada para a área de transferência!");
  };

  return (
    <>
      <style jsx global>{`
        @page {
          size: A4 portrait;
          margin: 6mm;
        }

        @media print {
          aside.sidebar,
          header,
          .top-header,
          .no-print,
          .screen-nav-bar,
          .content-container,
          button,
          .btn-primary,
          .btn-secondary {
            display: none !important;
          }

          html, body, .app-layout, .main-wrapper, .main-content {
            background: #ffffff !important;
            color: #000000 !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            box-shadow: none !important;
          }

          .print-only-a4 {
            display: block !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .a4-sheet {
            width: 100% !important;
            height: 100vh !important;
            min-height: 100vh !important;
            max-height: 100vh !important;
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
        }
      `}</style>

      {toastMsg && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            backgroundColor: "#00152f",
            color: "#ffffff",
            padding: "12px 20px",
            borderRadius: "10px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
            fontSize: "13px",
            fontWeight: 600,
            zIndex: 10000,
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#10b981" }}>
            check_circle
          </span>
          <span>{toastMsg}</span>
        </div>
      )}

      <div className="no-print">
        <ConsultorHeader tituloPagina="Meus BMs" />
      </div>

      <main className="content-container" style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: "20px" }}>
        {/* ========================================================= */}
        {/* CASO 1: VISUALIZAÇÃO COMPLETA DO BM SELECIONADO (PRINT 2) */}
        {/* ========================================================= */}
        {bmVisualizando ? (
          <div id="secao-bm-imprimir" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Header / Ações de Voltar e Exportar PDF */}
            <div
              className="no-print"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "12px",
                paddingBottom: "8px",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                  <button
                    type="button"
                    onClick={() => setBmVisualizando(null)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--secondary, #0284c7)",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      fontSize: "13px",
                      fontWeight: 700,
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>arrow_back</span>
                    <span>Voltar para Lista de BMs</span>
                  </button>
                  <span style={{ width: "4px", height: "4px", borderRadius: "50%", backgroundColor: "var(--outline, #94a3b8)" }}></span>
                  <span style={{ padding: "2px 8px", borderRadius: "999px", backgroundColor: "var(--surface-container, #e2e8f0)", fontSize: "11px", fontWeight: 600, color: "var(--on-surface-variant)" }}>
                    Ciclo: Mensal Fechado
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "baseline", gap: "12px", flexWrap: "wrap" }}>
                  <h1 style={{ fontSize: "24px", fontWeight: 800, color: "var(--primary)", margin: 0, letterSpacing: "-0.02em" }}>
                    Boletim de Medição de Serviços
                  </h1>
                  <span style={{ fontSize: "13px", color: "var(--on-surface-variant)" }}>
                    BM {bmVisualizando.codigo} • Contrato {String(bmVisualizando.contrato || "").replace(/•\s*NNÓS/g, "").trim()}
                  </span>
                </div>
              </div>

              {/* Botão Exportar PDF (Print 2 & 3) */}
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="btn-secondary"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    fontSize: "13px",
                    fontWeight: 700,
                    padding: "8px 16px",
                    borderRadius: "8px",
                    cursor: "pointer",
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>print</span>
                  <span>Exportar PDF</span>
                </button>
              </div>
            </div>

            {/* 4 Hero KPI Banner Cards (Print 2) */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
              {/* Valor Líquido Total */}
              <div style={{ padding: "20px", borderRadius: "14px", backgroundColor: "var(--surface-container-lowest)", border: "1px solid var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.03)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--on-surface-variant)", letterSpacing: "0.05em" }}>Valor Líquido Total</span>
                    <div style={{ fontSize: "24px", fontWeight: 800, color: "var(--primary)", marginTop: "4px" }}>
                      {brl(bmVisualizando.valorTotal || bmVisualizando.valorLiquidoTotal)}
                    </div>
                  </div>
                  <div style={{ width: "40px", height: "40px", borderRadius: "10px", backgroundColor: "rgba(0,21,47,0.08)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary)" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>payments</span>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "14px", color: "#047857", fontSize: "11px", fontWeight: 600 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>check_circle</span>
                  <span>Aprovado</span>
                </div>
              </div>

              {/* Carga Horária Apurada */}
              <div style={{ padding: "20px", borderRadius: "14px", backgroundColor: "var(--surface-container-lowest)", border: "1px solid var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.03)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--on-surface-variant)", letterSpacing: "0.05em" }}>Carga Horária Apurada</span>
                    <div style={{ fontSize: "24px", fontWeight: 800, color: "var(--primary)", marginTop: "4px" }}>
                      {Number(bmVisualizando.totalHoras || bmVisualizando.horasTotal || 0).toFixed(1)} h
                    </div>
                  </div>
                  <div style={{ width: "40px", height: "40px", borderRadius: "10px", backgroundColor: "rgba(0,103,129,0.08)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--secondary)" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>schedule</span>
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "14px", fontSize: "11px" }}>
                  <span style={{ color: "var(--on-surface-variant)" }}>{(bmVisualizando.atividades || []).length} frentes de serviço</span>
                  <strong style={{ color: "var(--secondary)" }}>
                    Média R$ {Number(bmVisualizando.mediaHora || ((bmVisualizando.valorTotal || 0) / (bmVisualizando.totalHoras || 1)) || 0).toFixed(2)}/h
                  </strong>
                </div>
              </div>

              {/* Mês de Referência */}
              <div style={{ padding: "20px", borderRadius: "14px", backgroundColor: "var(--surface-container-lowest)", border: "1px solid var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.03)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--on-surface-variant)", letterSpacing: "0.05em" }}>Mês de Referência</span>
                    <div style={{ fontSize: "24px", fontWeight: 800, color: "var(--primary)", marginTop: "4px" }}>
                      {bmVisualizando.mesReferencia}
                    </div>
                  </div>
                  <div style={{ width: "40px", height: "40px", borderRadius: "10px", backgroundColor: "var(--surface-container)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--on-surface)" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>calendar_month</span>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "14px", fontSize: "11px", color: "var(--on-surface-variant)" }}>
                  <span style={{ padding: "2px 6px", borderRadius: "4px", backgroundColor: "var(--surface-container)", fontWeight: 600 }}>{bmVisualizando.periodoTipo || "2ª Quinzena"}</span>
                  <span>Corte: {bmVisualizando.dataCorte || "20/09/2026"}</span>
                </div>
              </div>

              {/* Cronograma Previsto */}
              <div style={{ padding: "20px", borderRadius: "14px", backgroundColor: "var(--surface-container-lowest)", border: "1px solid var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.03)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--on-surface-variant)", letterSpacing: "0.05em" }}>Cronograma Previsto</span>
                    <div style={{ fontSize: "20px", fontWeight: 800, color: "var(--primary)", marginTop: "4px" }}>
                      10 e 25 de Outubro
                    </div>
                  </div>
                  <div style={{ width: "40px", height: "40px", borderRadius: "10px", backgroundColor: "rgba(135,221,255,0.3)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--secondary)" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>event_repeat</span>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "14px", fontSize: "11px", color: "var(--on-surface-variant)" }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "var(--secondary)" }}></span>
                  <span>NF até dia 10 • Pagamento dia 25</span>
                </div>
              </div>
            </div>

            {/* Identificação das Partes (Print 2) */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(460px, 1fr))", gap: "16px" }}>
              {/* Prestador de Serviços */}
              <div style={{ padding: "24px", borderRadius: "14px", backgroundColor: "var(--surface-container-lowest)", border: "1px solid var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", paddingBottom: "12px", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ width: "34px", height: "34px", borderRadius: "8px", backgroundColor: "var(--primary)", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>badge</span>
                  </div>
                  <div>
                    <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--on-surface-variant)" }}>Prestador de Serviços</span>
                    <h2 style={{ fontSize: "16px", fontWeight: 700, color: "var(--primary)", margin: 0 }}>{bmVisualizando.consultorNome}</h2>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", paddingTop: "14px", fontSize: "12px" }}>
                  <div>
                    <span style={{ fontSize: "11px", color: "var(--on-surface-variant)", display: "block" }}>Razão Social / Titular</span>
                    <strong style={{ color: "var(--on-surface)" }}>{bmVisualizando.consultorRazaoSocial || bmVisualizando.consultorNome}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: "11px", color: "var(--on-surface-variant)", display: "block" }}>CNPJ</span>
                    <strong style={{ color: "var(--on-surface)" }}>{bmVisualizando.consultorCnpj || "Não informado"}</strong>
                  </div>
                  <div style={{ gridColumn: "span 2" }}>
                    <span style={{ fontSize: "11px", color: "var(--on-surface-variant)", display: "block" }}>Endereço Comercial Cadastrado</span>
                    <span style={{ color: "var(--on-surface)" }}>{bmVisualizando.consultorEndereco || "Belo Horizonte / MG"}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: "11px", color: "var(--on-surface-variant)", display: "block" }}>E-mail Operacional</span>
                    <a href={`mailto:${bmVisualizando.consultorEmail}`} style={{ color: "var(--secondary)", textDecoration: "none" }}>{bmVisualizando.consultorEmail}</a>
                  </div>
                  <div>
                    <span style={{ fontSize: "11px", color: "var(--on-surface-variant)", display: "block" }}>Contrato Ativo / Vinculado</span>
                    <strong style={{ color: "var(--on-surface)" }}>{String(bmVisualizando.contrato || "").replace(/•\s*NNÓS/g, "").trim()}</strong>
                  </div>
                </div>
              </div>

              {/* Tomador dos Serviços */}
              <div style={{ padding: "24px", borderRadius: "14px", backgroundColor: "var(--surface-container-lowest)", border: "1px solid var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", paddingBottom: "12px", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ width: "34px", height: "34px", borderRadius: "8px", backgroundColor: "var(--secondary, #0284c7)", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>domain</span>
                  </div>
                  <div>
                    <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--on-surface-variant)" }}>Tomador dos Serviços</span>
                    <h2 style={{ fontSize: "16px", fontWeight: 700, color: "var(--primary)", margin: 0 }}>NNÓS CONSULTORIA E TREINAMENTO LTDA</h2>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", paddingTop: "14px", fontSize: "12px" }}>
                  <div>
                    <span style={{ fontSize: "11px", color: "var(--on-surface-variant)", display: "block" }}>CNPJ da Empresa</span>
                    <strong style={{ color: "var(--on-surface)" }}>36.443.716/0001-00</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: "11px", color: "var(--on-surface-variant)", display: "block" }}>Inscrição Municipal</span>
                    <strong style={{ color: "var(--on-surface)" }}>1.208.841/002-5</strong>
                  </div>
                  <div style={{ gridColumn: "span 2" }}>
                    <span style={{ fontSize: "11px", color: "var(--on-surface-variant)", display: "block" }}>Endereço da Sede</span>
                    <span style={{ color: "var(--on-surface)" }}>Rua Sergipe, nº 77 - Loja 1, Boa Viagem, Belo Horizonte - MG | CEP 30130-170</span>
                  </div>
                  <div style={{ gridColumn: "span 2" }}>
                    <span style={{ fontSize: "11px", color: "var(--on-surface-variant)", display: "block" }}>Financeiro</span>
                    <a href="mailto:leonardo.campos@nnos.com.br" style={{ color: "var(--secondary)", textDecoration: "none" }}>leonardo.campos@nnos.com.br</a>
                  </div>
                </div>
              </div>
            </div>

            {/* Detalhamento Operacional de Horas (Print 2) */}
            <div style={{ borderRadius: "14px", backgroundColor: "var(--surface-container-lowest)", border: "1px solid var(--border)", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
              <div style={{ padding: "16px 20px", backgroundColor: "var(--surface-container-low)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", borderBottom: "1px solid var(--border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{ width: "36px", height: "36px", borderRadius: "8px", backgroundColor: "var(--primary)", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>table_rows</span>
                  </div>
                  <div>
                    <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--secondary)" }}>Detalhamento Operacional de Horas</span>
                    <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--primary)", margin: 0 }}>Atividades Apuradas no Mês ({bmVisualizando.mesReferencia})</h3>
                  </div>
                </div>
                <span style={{ padding: "4px 12px", borderRadius: "999px", backgroundColor: "var(--surface-container)", fontSize: "12px", fontWeight: 600, color: "var(--on-surface-variant)" }}>
                  {(bmVisualizando.atividades || []).length} Lançamentos Registrados
                </span>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "12px" }}>
                  <thead>
                    <tr style={{ backgroundColor: "var(--primary)", color: "#ffffff", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      <th style={{ padding: "12px 16px" }}>Projeto</th>
                      <th style={{ padding: "12px 16px", minWidth: "260px" }}>Atividade / Escopo</th>
                      <th style={{ padding: "12px 16px", textAlign: "center" }}>Período</th>
                      <th style={{ padding: "12px 16px", textAlign: "right" }}>CH (Horas)</th>
                      <th style={{ padding: "12px 16px", textAlign: "right" }}>Valor / Hora</th>
                      <th style={{ padding: "12px 16px", textAlign: "right" }}>Valor Total</th>
                      <th style={{ padding: "12px 16px", textAlign: "right" }}>Rateio Interno</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(bmVisualizando.atividades || []).map((at: any, idx: number) => (
                      <tr key={idx} style={{ borderBottom: "1px solid var(--border)", backgroundColor: idx % 2 === 1 ? "var(--surface-container-low)" : "transparent" }}>
                        <td style={{ padding: "12px 16px", fontWeight: 700, color: "var(--primary)" }}>{at.projeto}</td>
                        <td style={{ padding: "12px 16px" }}>{at.atividade}</td>
                        <td style={{ padding: "12px 16px", textAlign: "center", color: "var(--on-surface-variant)", whiteSpace: "nowrap" }}>{at.periodo}</td>
                        <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 600 }}>{Number(at.horas || 0).toFixed(1)} h</td>
                        <td style={{ padding: "12px 16px", textAlign: "right", color: "var(--on-surface-variant)" }}>R$ {Number(at.valorHora || 0).toFixed(2)}</td>
                        <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 700, color: "var(--primary)" }}>R$ {Number(at.valorTotal || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                        <td style={{ padding: "12px 16px", textAlign: "right", color: at.rateioInterno !== "0,00%" ? "var(--secondary)" : "var(--on-surface-variant)", fontWeight: at.rateioInterno !== "0,00%" ? 700 : 400 }}>{at.rateioInterno}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ backgroundColor: "var(--primary)", color: "#ffffff", fontWeight: 700, fontSize: "13px" }}>
                      <td style={{ padding: "14px 16px" }} colSpan={3}>TOTAL CONSOLIDADO DA MEDIÇÃO</td>
                      <td style={{ padding: "14px 16px", textAlign: "right" }}>{Number(bmVisualizando.totalHoras || bmVisualizando.horasTotal || 0).toFixed(1)} h</td>
                      <td style={{ padding: "14px 16px", textAlign: "right", opacity: 0.85, fontSize: "11px" }}>(Média R$ {Number(bmVisualizando.mediaHora || 0).toFixed(2)})</td>
                      <td style={{ padding: "14px 16px", textAlign: "right", color: "#87ddff", fontSize: "15px", fontWeight: 800 }}>R$ {Number(bmVisualizando.valorTotal || bmVisualizando.valorLiquidoTotal || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                      <td style={{ padding: "14px 16px", textAlign: "right", opacity: 0.85, fontSize: "11px" }}>100,00%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Rateio por Projeto */}
              <div style={{ padding: "14px 20px", backgroundColor: "var(--surface-container-low)", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", fontSize: "11px" }}>
                  <strong style={{ color: "var(--primary)" }}>Rateio por Projeto:</strong>
                  {Array.from(new Set((bmVisualizando.atividades || []).map((a: any) => a.projeto))).map((proj: any, pIdx: number) => {
                    const sub = (bmVisualizando.atividades || [])
                      .filter((a: any) => a.projeto === proj)
                      .reduce((acc: number, a: any) => acc + (a.valorTotal || 0), 0);
                    const totalVal = Number(bmVisualizando.valorTotal || bmVisualizando.valorLiquidoTotal || 1);
                    const pct = totalVal > 0 ? ((sub / totalVal) * 100).toFixed(1) : "0,0";
                    const cores = ["var(--secondary)", "#0f2a4a", "#dd7436", "#485f82", "#10b981"];
                    return (
                      <span key={proj} style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                        <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: cores[pIdx % cores.length] }}></span>
                        {proj} ({pct}%)
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Dados Obrigatórios para Emissão & Cronograma de Pagamento (Print 2) */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(460px, 1fr))", gap: "16px" }}>
              {/* Discriminação da NF */}
              <div style={{ padding: "22px", borderRadius: "14px", backgroundColor: "var(--surface-container-lowest)", border: "1px solid var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.03)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "12px", borderBottom: "1px solid var(--border)", marginBottom: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div style={{ width: "34px", height: "34px", borderRadius: "8px", backgroundColor: "rgba(0,103,129,0.1)", color: "var(--secondary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>receipt_long</span>
                      </div>
                      <div>
                        <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--secondary)" }}>Dados Obrigatórios para Emissão</span>
                        <h3 style={{ fontSize: "15px", fontWeight: 700, color: "var(--primary)", margin: 0 }}>Discriminação dos Serviços na Nota Fiscal</h3>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyNfTexto(bmVisualizando)}
                      className="btn-primary"
                      style={{ padding: "6px 12px", fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>content_copy</span>
                      <span>Copiar Discriminação</span>
                    </button>
                  </div>

                  <p style={{ fontSize: "12px", color: "var(--on-surface-variant)", marginBottom: "10px" }}>
                    Copie exatamente o bloco textual abaixo e cole no campo <strong>&quot;Descrição dos Serviços / Dados Adicionais&quot;</strong> do seu emissor de Nota Fiscal:
                  </p>

                  <div style={{ backgroundColor: "var(--surface-container-low)", padding: "14px", borderRadius: "10px", border: "1px solid var(--border)", fontFamily: "monospace", fontSize: "12px", lineHeight: "1.6", color: "var(--on-surface)" }}>
                    <div style={{ fontWeight: 700, color: "var(--primary)" }}>BM: {bmVisualizando.codigo} | CONTRATO: {String(bmVisualizando.contrato || "").replace(/•\s*NNÓS/g, "").trim()}</div>
                    {Array.from(new Set((bmVisualizando.atividades || []).map((a: any) => a.projeto))).map((proj: any) => {
                      const subtotal = (bmVisualizando.atividades || [])
                        .filter((a: any) => a.projeto === proj)
                        .reduce((acc: number, a: any) => acc + (a.valorTotal || 0), 0);
                      return (
                        <div key={proj}>
                          {proj}: R$ {subtotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </div>
                      );
                    })}
                    <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px solid var(--border)", fontSize: "11px", color: "var(--on-surface-variant)" }}>
                      <strong style={{ color: "var(--primary)" }}>Código CTISS:</strong> 0802-0/01-88 (Instrução e treinamento)<br />
                      <strong style={{ color: "var(--primary)" }}>Subitem LC 116/03:</strong> 8.02 (Instrução, treinamento, orientação pedagógica).
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: "14px", padding: "10px 14px", backgroundColor: "rgba(0,103,129,0.06)", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px", color: "var(--on-surface-variant)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "15px", color: "var(--secondary)" }}>email</span>
                    <span>Enviar XML e PDF da NF emitida para: <strong style={{ color: "var(--primary)" }}>leonardo.campos@nnos.com.br</strong></span>
                  </div>
                  <strong style={{ color: "var(--secondary)" }}>Ref: BM {bmVisualizando.codigo}</strong>
                </div>
              </div>

              {/* Cronograma de Envio e Pagamento */}
              <div style={{ padding: "22px", borderRadius: "14px", backgroundColor: "var(--surface-container-lowest)", border: "1px solid var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.03)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", paddingBottom: "12px", borderBottom: "1px solid var(--border)", marginBottom: "14px" }}>
                    <div style={{ width: "34px", height: "34px", borderRadius: "8px", backgroundColor: "var(--primary)", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>calendar_clock</span>
                    </div>
                    <div>
                      <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--secondary)" }}>Fluxo de Caixa &amp; Regras</span>
                      <h3 style={{ fontSize: "15px", fontWeight: 700, color: "var(--primary)", margin: 0 }}>Cronograma de Envio e Pagamento</h3>
                    </div>
                  </div>

                  {(() => {
                    const isQuinzena1 = (bmVisualizando.periodoTipo || "").includes("1ª");
                    const mesesNomes = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
                    let mesNum = 10;
                    let anoNum = 2026;
                    const mesMatch = (bmVisualizando.mesReferencia || "").match(/(\d{4})/);
                    if (mesMatch) anoNum = Number(mesMatch[1]);
                    mesesNomes.forEach((m, idx) => {
                      if ((bmVisualizando.mesReferencia || "").toLowerCase().includes(m.toLowerCase())) mesNum = idx + 1;
                    });
                    const mesStr = String(mesNum).padStart(2, "0");
                    const proxMesNum = mesNum === 12 ? 1 : mesNum + 1;
                    const proxAnoNum = mesNum === 12 ? anoNum + 1 : anoNum;
                    const proxMesStr = String(proxMesNum).padStart(2, "0");

                    const dataBmTimeline = isQuinzena1 ? `18/${mesStr}` : `01/${proxMesStr}`;
                    const dataPrazoTimeline = isQuinzena1 ? `25/${mesStr}` : `10/${proxMesStr}`;
                    const dataCreditoTimeline = isQuinzena1 ? `10/${proxMesStr}/${proxAnoNum}` : `25/${proxMesStr}/${proxAnoNum}`;

                    return (
                      <>
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                          <div style={{
                            padding: "12px",
                            borderRadius: "10px",
                            backgroundColor: isQuinzena1 ? "rgba(0,103,129,0.06)" : "var(--surface-container-low)",
                            border: isQuinzena1 ? "1.5px solid var(--secondary)" : "1px solid var(--border)",
                            display: "flex",
                            gap: "12px",
                            alignItems: "flex-start"
                          }}>
                            <div style={{
                              width: "32px",
                              height: "32px",
                              borderRadius: "8px",
                              backgroundColor: isQuinzena1 ? "var(--primary)" : "var(--surface-container)",
                              color: isQuinzena1 ? "#ffffff" : "var(--primary)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: 800,
                              fontSize: "13px"
                            }}>
                              1ª
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "2px", fontSize: "12px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <strong style={{ color: "var(--primary)" }}>Atividades da 1ª Quinzena</strong>
                              </div>
                              <span style={{ color: "var(--on-surface-variant)" }}>Envio da nota fiscal até o <strong>dia 25 do mês vigente</strong>.</span>
                              <div style={{ display: "flex", alignItems: "center", gap: "4px", color: "var(--secondary)", fontWeight: 700, fontSize: "11px", marginTop: "4px" }}>
                                <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>event_available</span>
                                <span>Pagamento creditado no dia 10 subsequente</span>
                              </div>
                            </div>
                          </div>

                          <div style={{
                            padding: "12px",
                            borderRadius: "10px",
                            backgroundColor: !isQuinzena1 ? "rgba(0,21,47,0.06)" : "rgba(0,21,47,0.02)",
                            border: !isQuinzena1 ? "1.5px solid var(--primary)" : "1px solid var(--border)",
                            display: "flex",
                            gap: "12px",
                            alignItems: "flex-start"
                          }}>
                            <div style={{
                              width: "32px",
                              height: "32px",
                              borderRadius: "8px",
                              backgroundColor: !isQuinzena1 ? "var(--primary)" : "var(--surface-container)",
                              color: !isQuinzena1 ? "#ffffff" : "var(--primary)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: 800,
                              fontSize: "13px"
                            }}>
                              2ª
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "2px", fontSize: "12px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <strong style={{ color: "var(--primary)" }}>Atividades da 2ª Quinzena/Integral</strong>
                              </div>
                              <span style={{ color: "var(--on-surface-variant)" }}>Envio da nota fiscal até o <strong>dia 10 após recebimento do BM</strong>.</span>
                              <div style={{ display: "flex", alignItems: "center", gap: "4px", color: "#059669", fontWeight: 800, fontSize: "11px", marginTop: "4px" }}>
                                <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>payments</span>
                                <span>Previsão de Liquidação: Dia 25 de {bmVisualizando.mesReferencia || "Outubro de 2026"}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div style={{ marginTop: "14px", padding: "10px 14px", backgroundColor: "var(--surface-container-low)", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px" }}>
                          <span><span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#10b981", display: "inline-block", marginRight: "4px" }}></span>BM: <strong>{dataBmTimeline}</strong></span>
                          <span style={{ color: "var(--outline)" }}>→</span>
                          <span><span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "var(--secondary)", display: "inline-block", marginRight: "4px" }}></span>Prazo NF: <strong>{dataPrazoTimeline}</strong></span>
                          <span style={{ color: "var(--outline)" }}>→</span>
                          <span style={{ color: "#059669", fontWeight: 700 }}><span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "var(--primary)", display: "inline-block", marginRight: "4px" }}></span>Crédito: <strong>{dataCreditoTimeline}</strong></span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Declaração de Concordância e Aceite Operacional & Assinaturas com Validade Jurídica (Print 2) */}
            <div style={{ padding: "24px", borderRadius: "14px", backgroundColor: "var(--surface-container-lowest)", border: "1px solid var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
              <div style={{ padding: "14px 18px", borderRadius: "10px", backgroundColor: "var(--surface-container-low)", display: "flex", gap: "12px", alignItems: "flex-start", marginBottom: "20px" }}>
                <div style={{ width: "32px", height: "32px", borderRadius: "8px", backgroundColor: "#d1fae5", color: "#065f46", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>task_alt</span>
                </div>
                <div>
                  <h4 style={{ fontSize: "14px", fontWeight: 700, color: "var(--primary)", margin: 0 }}>Declaração de Concordância e Aceite Operacional</h4>
                  <p style={{ fontSize: "12px", color: "var(--on-surface-variant)", margin: "4px 0 0 0" }}>
                    &quot;Declaro concordar integralmente com os valores, horas e quantidades constantes nesta medição de serviços de {bmVisualizando.mesReferencia} para fins de emissão de faturamento.&quot;
                  </p>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "20px" }}>
                {/* Assinatura do Prestador */}
                <div style={{ padding: "20px", borderRadius: "12px", backgroundColor: "var(--surface-container-low)", border: "1px solid var(--border)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                      <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--secondary)" }}>Assinatura do Prestador</span>
                      <span style={{ padding: "2px 8px", borderRadius: "999px", backgroundColor: "#d1fae5", color: "#065f46", fontSize: "11px", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                        <span className="material-symbols-outlined" style={{ fontSize: "12px" }}>done_all</span>
                        Assinado Eletronicamente
                      </span>
                    </div>

                    <div style={{ height: "60px", display: "flex", alignItems: "center", justifyContent: "center", borderBottom: "1px solid var(--border)", margin: "8px 0" }}>
                      <span style={{ fontFamily: "cursive", fontSize: "28px", color: "var(--primary)", fontStyle: "italic", letterSpacing: "2px" }}>
                        {formatarNomeAssinatura(bmVisualizando.consultorNome)}
                      </span>
                    </div>

                    <div style={{ textAlign: "center", marginTop: "10px" }}>
                      <strong style={{ fontSize: "13px", color: "var(--primary)", display: "block" }}>{bmVisualizando.consultorNome}</strong>
                      <span style={{ fontSize: "11px", color: "var(--on-surface-variant)" }}>
                        Razão Social: {bmVisualizando.consultorRazaoSocial || bmVisualizando.consultorNome} • CNPJ: {bmVisualizando.consultorCnpj || "Não informado"}
                      </span>
                    </div>
                  </div>

                  {(() => {
                    const prestadorLog = bmVisualizando.logs?.find((l: any) => l.papel?.toLowerCase().includes("prestador")) || bmVisualizando.logs?.[0];
                    const ipPrestador = prestadorLog?.detalhe?.includes("IP:")
                      ? prestadorLog.detalhe.split("•")[0].replace("IP:", "").trim()
                      : "191.187.11.168";
                    const dataPrestador = prestadorLog?.dataHora || (prestadorLog?.status === "Assinado" ? "29/09/2026 15:35:17 (Assinado)" : "Status: Pendente");

                    return (
                      <div style={{ marginTop: "16px", paddingTop: "10px", borderTop: "1px dashed var(--border)", display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--on-surface-variant)" }}>
                        <span>IP: {ipPrestador}</span>
                        <span>Data: {dataPrestador}</span>
                      </div>
                    );
                  })()}
                </div>

                {/* Validação da Coordenação */}
                <div style={{ padding: "20px", borderRadius: "12px", backgroundColor: "var(--surface-container-low)", border: "1px solid var(--border)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                      <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--primary)" }}>
                        Validação da Coordenação
                      </span>
                      <span style={{ padding: "2px 8px", borderRadius: "999px", backgroundColor: "#d1fae5", color: "#065f46", fontSize: "11px", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                        <span className="material-symbols-outlined" style={{ fontSize: "12px" }}>done_all</span>
                        Validação Operacional
                      </span>
                    </div>

                    <div style={{ height: "60px", display: "flex", alignItems: "center", justifyContent: "center", borderBottom: "1px solid var(--border)", margin: "8px 0" }}>
                      <span style={{ fontFamily: "cursive", fontSize: "28px", color: "var(--secondary, #0284c7)", fontStyle: "italic", letterSpacing: "2px" }}>
                        {formatarNomeAssinatura(bmVisualizando.responsavelNnosNome || "Marcelo Lara da Silva")}
                      </span>
                    </div>

                    <div style={{ textAlign: "center", marginTop: "10px" }}>
                      <strong style={{ fontSize: "13px", color: "var(--primary)", display: "block" }}>
                        {String(bmVisualizando.responsavelNnosNome || "Marcelo Lara da Silva").toUpperCase()}
                      </strong>
                      <span style={{ fontSize: "11px", color: "var(--on-surface-variant)" }}>
                        Coordenação Geral &amp; Validação Financeira • NNÓS
                      </span>
                    </div>
                  </div>

                  <div style={{ marginTop: "16px", paddingTop: "10px", borderTop: "1px dashed var(--border)", display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--on-surface-variant)" }}>
                    <span>Zoho Doc ID: 2EEBEA08...</span>
                    <span>Data: {bmVisualizando.dataEnvio || "29/09/2026 15:35:17"} (Homologado)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ========================================================= */
          /* CASO 2: LISTAGEM OFICIAL DE BMS DO CONSULTOR (PRINT 5)   */
          /* ========================================================= */
          <>
            <div>
              <h1 style={{ fontSize: "22px", fontWeight: 800, margin: 0, color: "var(--primary)" }}>
                Meus Boletins de Medição (BMs)
              </h1>
              <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "var(--on-surface-variant)" }}>
                Acompanhe o status do workflow de aprovação, trilha de assinaturas eletrônicas com validade jurídica e dados para emissão de Notas Fiscais de <strong>{consultorAtivo?.nome}</strong>.
              </p>
            </div>

            {/* CARDS DE INDICADORES CONSOLIDADOS DE 2026 (Idêntico ao Print 5) */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", width: "100%" }}>
              {/* Card 1: BMS Emitidos */}
              <div style={{ backgroundColor: "var(--surface-container-lowest)", padding: "18px 20px", borderRadius: "12px", border: "1px solid var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.03)", display: "flex", alignItems: "center", gap: "14px" }}>
                <div style={{ width: "42px", height: "42px", borderRadius: "10px", backgroundColor: "rgba(0,21,47,0.08)", color: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>receipt_long</span>
                </div>
                <div>
                  <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--on-surface-variant)" }}>BMs Emitidos (2026)</span>
                  <h3 style={{ fontSize: "20px", fontWeight: 800, color: "var(--primary)", margin: "2px 0 0 0" }}>{bmsOriginais.length}</h3>
                  <span style={{ fontSize: "10px", color: "var(--secondary)" }}>Ano 2026 consolidado</span>
                </div>
              </div>

              {/* Card 2: Total Faturado */}
              <div style={{ backgroundColor: "var(--surface-container-lowest)", padding: "18px 20px", borderRadius: "12px", border: "1px solid var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.03)", display: "flex", alignItems: "center", gap: "14px" }}>
                <div style={{ width: "42px", height: "42px", borderRadius: "10px", backgroundColor: "rgba(0,103,129,0.1)", color: "var(--secondary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>payments</span>
                </div>
                <div>
                  <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--on-surface-variant)" }}>Total Faturado (2026)</span>
                  <h3 style={{ fontSize: "20px", fontWeight: 800, color: "var(--secondary)", margin: "2px 0 0 0" }}>
                    R$ {bmsOriginais.reduce((acc: number, b: any) => acc + (b.valorTotal || b.valorLiquidoTotal || 0), 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </h3>
                  <span style={{ fontSize: "10px", color: "#059669", fontWeight: 600 }}>{bmsOriginais.length} Medições Faturadas</span>
                </div>
              </div>

              {/* Card 3: Carga Horária Medida */}
              <div style={{ backgroundColor: "var(--surface-container-lowest)", padding: "18px 20px", borderRadius: "12px", border: "1px solid var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.03)", display: "flex", alignItems: "center", gap: "14px" }}>
                <div style={{ width: "42px", height: "42px", borderRadius: "10px", backgroundColor: "rgba(16,185,129,0.1)", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>schedule</span>
                </div>
                <div>
                  <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--on-surface-variant)" }}>Carga Horária Medida</span>
                  <h3 style={{ fontSize: "20px", fontWeight: 800, color: "var(--primary)", margin: "2px 0 0 0" }}>
                    {bmsOriginais.reduce((acc: number, b: any) => acc + (b.totalHoras || b.horasTotal || 0), 0).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} h
                  </h3>
                  <span style={{ fontSize: "10px", color: "var(--on-surface-variant)" }}>Horas técnicas aprovadas</span>
                </div>
              </div>

              {/* Card 4: Prestador Ativo */}
              <div style={{ backgroundColor: "var(--surface-container-lowest)", padding: "18px 20px", borderRadius: "12px", border: "1px solid var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.03)", display: "flex", alignItems: "center", gap: "14px" }}>
                <div style={{ width: "42px", height: "42px", borderRadius: "10px", backgroundColor: "rgba(245,158,11,0.1)", color: "#d97706", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>group</span>
                </div>
                <div>
                  <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--on-surface-variant)" }}>Prestador Ativo</span>
                  <h3 style={{ fontSize: "20px", fontWeight: 800, color: "var(--primary)", margin: "2px 0 0 0" }}>
                    1
                  </h3>
                  <span style={{ fontSize: "10px", color: "var(--on-surface-variant)" }}>Profissional c/ BM em 2026</span>
                </div>
              </div>
            </div>

            {/* Barra de Pesquisa e Filtros (Sem o botão Sincronizar Zoho) */}
            <div
              style={{
                backgroundColor: "var(--surface-container-lowest)",
                padding: "12px 18px",
                borderRadius: "12px",
                border: "1px solid var(--border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "12px",
                width: "100%",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, minWidth: "300px" }}>
                <span className="material-symbols-outlined" style={{ color: "var(--on-surface-variant)", fontSize: "18px" }}>
                  search
                </span>
                <input
                  type="text"
                  placeholder="Pesquisar por BM (0884), contrato ou período..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  style={{
                    width: "100%",
                    border: "none",
                    outline: "none",
                    fontSize: "13px",
                    background: "transparent",
                    color: "var(--on-surface)",
                  }}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--on-surface-variant)", textTransform: "uppercase" }}>
                  Workflow:
                </span>
                <ModernDropdown
                  value={filtroStatus}
                  onChange={(val) => setFiltroStatus(String(val))}
                  options={[
                    { value: "Todos", label: `Todos os Status (${bmsOriginais.length})` },
                    { value: "Pendente de Assinatura", label: "Pendente de Assinatura" },
                    { value: "Assinado pelo Prestador", label: "Assinado pelo Prestador" },
                    { value: "Aprovado pelo Líder", label: "Aprovado pelo Líder" },
                    { value: "Aprovado & Pronto p/ Faturamento", label: "Aprovado & Pronto p/ Faturamento" },
                  ]}
                  icon="filter_list"
                  searchable={false}
                  minWidth={240}
                />
              </div>
            </div>

            {/* Tabela de BMs (Idêntica ao Print 5) */}
            <div
              style={{
                backgroundColor: "var(--surface-container-lowest)",
                borderRadius: "14px",
                border: "1px solid var(--border)",
                overflow: "hidden",
                boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                width: "100%",
              }}
            >
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "12px" }}>
                <thead>
                  <tr
                    style={{
                      backgroundColor: "var(--surface-container-low)",
                      borderBottom: "1px solid var(--border)",
                      color: "var(--on-surface-variant)",
                      fontSize: "11px",
                      textTransform: "uppercase",
                    }}
                  >
                    <th style={{ padding: "12px 16px", width: "80px", whiteSpace: "nowrap" }}>Código</th>
                    <th style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>Consultor / Prestador</th>
                    <th style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>Período &amp; Quinzena</th>
                    <th style={{ padding: "12px 16px", textAlign: "right", whiteSpace: "nowrap", width: "90px" }}>Horas</th>
                    <th style={{ padding: "12px 16px", textAlign: "right", whiteSpace: "nowrap", width: "130px" }}>Valor Apurado</th>
                    <th style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>Status do Workflow</th>
                    <th style={{ padding: "12px 16px" }}>Log de Informações &amp; Assinaturas</th>
                    <th style={{ padding: "12px 16px", textAlign: "center", whiteSpace: "nowrap", width: "120px" }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {bmsFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: "36px", textAlign: "center", color: "var(--on-surface-variant)" }}>
                        Nenhum Boletim de Medição encontrado para este consultor.
                      </td>
                    </tr>
                  ) : (
                    bmsFiltrados.map((bm: any) => {
                      const isAprovado = bm.status === "Aprovado & Pronto p/ Faturamento";
                      const isAssinado = bm.status === "Assinado pelo Prestador" || bm.status === "Aprovado pelo Líder";

                      return (
                        <tr key={bm.id || bm.codigo} style={{ borderBottom: "1px solid var(--border)" }}>
                          <td style={{ padding: "14px 16px", fontWeight: 800, color: "var(--primary)", whiteSpace: "nowrap" }}>
                            {bm.codigo}
                          </td>
                          <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                            <div style={{ fontWeight: 700, color: "var(--primary)", fontSize: "13px" }}>
                              {bm.consultorNome}
                            </div>
                            <div style={{ fontSize: "11px", color: "var(--on-surface-variant)", marginTop: "2px" }}>
                              CNPJ: {bm.consultorCnpj || "Não informado"}
                            </div>
                          </td>
                          <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                            <div style={{ fontWeight: 600, color: "var(--on-surface)" }}>
                              {bm.mesReferencia}
                            </div>
                            <div style={{ fontSize: "11px", color: "var(--on-surface-variant)", marginTop: "2px" }}>
                              {bm.periodoTipo || "Integral"} • Corte: {bm.dataCorte || "20/09/2026"}
                            </div>
                          </td>
                          <td style={{ padding: "14px 16px", textAlign: "right", fontWeight: 700, whiteSpace: "nowrap" }}>
                            {Number(bm.totalHoras || bm.horasTotal || 0).toFixed(1)}&nbsp;h
                          </td>
                          <td style={{ padding: "14px 16px", textAlign: "right", fontWeight: 800, color: "#059669", fontSize: "13px", whiteSpace: "nowrap" }}>
                            {brl(bm.valorTotal || bm.valorLiquidoTotal)}
                          </td>
                          <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                                padding: "4px 10px",
                                borderRadius: "999px",
                                fontSize: "11px",
                                fontWeight: 700,
                                backgroundColor: isAprovado ? "#dcfce7" : isAssinado ? "#e0f2fe" : "#ffedd5",
                                color: isAprovado ? "#15803d" : isAssinado ? "#0369a1" : "#c2410c",
                              }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
                                {isAprovado ? "verified" : isAssinado ? "draw" : "hourglass_top"}
                              </span>
                              {bm.status}
                            </span>
                          </td>
                          <td style={{ padding: "14px 16px", fontSize: "11px", color: "var(--on-surface-variant)" }}>
                            <div style={{ marginBottom: "3px" }}>
                              <span style={{ fontWeight: 600 }}>Envio:</span> {bm.dataEnvio || "20/09/2026 15:59:13"}
                            </div>
                            {Array.isArray(bm.logs) && bm.logs.length > 0 ? (
                              bm.logs.map((l: any, idx: number) => {
                                let dataLimpa = l.dataHora
                                  ? l.dataHora
                                      .replace(/[()]/g, "")
                                      .replace(/\b(Assinado|Homologado|Aprovado|Concluído)\b/gi, "")
                                      .trim()
                                  : "";

                                let papelExibicao = l.papel;
                                if (papelExibicao === "Consultor") papelExibicao = "Prestador de Serviços";
                                if (papelExibicao === "Lider") papelExibicao = "Aprovador Técnico";
                                if (papelExibicao === "ValidacaoFinal") papelExibicao = "Responsável NNÓS (Coordenação Geral)";

                                const isConcluido = l.status === "Assinado" || l.status === "Aprovado" || l.status === "Homologado" || l.status === "Concluído";

                                return (
                                  <div key={idx} style={{ fontSize: "10.5px", marginTop: "3px", display: "flex", alignItems: "center", gap: "4px", flexWrap: "wrap" }}>
                                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: isConcluido ? "#10b981" : "#f59e0b", display: "inline-block", flexShrink: 0 }}></span>
                                    <span style={{ fontWeight: 600, color: "var(--on-surface)" }}>{papelExibicao}:</span>
                                    <span style={{ color: isConcluido ? "#059669" : "#d97706", fontWeight: 700 }}>{l.status}</span>
                                    {dataLimpa && (
                                      <span style={{ color: "var(--on-surface-variant)", fontSize: "9.5px", opacity: 0.85 }}>• {dataLimpa}</span>
                                    )}
                                  </div>
                                );
                              })
                            ) : (
                              <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginTop: "3px" }}>
                                <div style={{ fontSize: "10.5px", display: "flex", alignItems: "center", gap: "4px" }}>
                                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#10b981", display: "inline-block", flexShrink: 0 }}></span>
                                  <span style={{ fontWeight: 600, color: "var(--on-surface)" }}>Prestador de Serviços:</span>
                                  <span style={{ color: "#059669", fontWeight: 700 }}>Assinado</span>
                                  <span style={{ color: "var(--on-surface-variant)", fontSize: "9.5px", opacity: 0.85 }}>• {bm.dataEnvio || "20/09/2026 15:59:13"}</span>
                                </div>
                                <div style={{ fontSize: "10.5px", display: "flex", alignItems: "center", gap: "4px" }}>
                                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#10b981", display: "inline-block", flexShrink: 0 }}></span>
                                  <span style={{ fontWeight: 600, color: "var(--on-surface)" }}>Aprovador Técnico:</span>
                                  <span style={{ color: "#059669", fontWeight: 700 }}>Aprovado</span>
                                  <span style={{ color: "var(--on-surface-variant)", fontSize: "9.5px", opacity: 0.85 }}>• {bm.dataEnvio || "20/09/2026 15:59:13"}</span>
                                </div>
                                <div style={{ fontSize: "10.5px", display: "flex", alignItems: "center", gap: "4px" }}>
                                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#10b981", display: "inline-block", flexShrink: 0 }}></span>
                                  <span style={{ fontWeight: 600, color: "var(--on-surface)" }}>Responsável NNÓS (Coordenação Geral):</span>
                                  <span style={{ color: "#059669", fontWeight: 700 }}>Homologado</span>
                                  <span style={{ color: "var(--on-surface-variant)", fontSize: "9.5px", opacity: 0.85 }}>• {bm.dataEnvio || "20/09/2026 15:59:13"}</span>
                                </div>
                              </div>
                            )}
                          </td>
                          <td style={{ padding: "14px 16px", textAlign: "center", whiteSpace: "nowrap" }}>
                            <button
                              type="button"
                              onClick={() => setBmVisualizando(bm)}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                                padding: "6px 14px",
                                borderRadius: "8px",
                                backgroundColor: "#00152f",
                                color: "#ffffff",
                                fontSize: "12px",
                                fontWeight: 700,
                                border: "none",
                                cursor: "pointer",
                                transition: "all 0.15s ease",
                              }}
                              title="Visualizar Boletim de Medição completo"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                                visibility
                              </span>
                              <span>Visualizar</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>

      {/* Folha Oficial A4 Renderizada Exclusivamente para Exportar PDF (Print 3 e 5) */}
      {bmVisualizando && <BmExportPdfSheet bm={bmVisualizando} />}
    </>
  );
}
