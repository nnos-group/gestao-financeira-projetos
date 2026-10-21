"use client";

import React, { useEffect, useState } from "react";
import RelatorioShell from "@/components/RelatorioShell";
import {
  BarraFiltros,
  MESES,
  brl0,
  brl2,
  pct,
  fmtDRE,
  InputMoedaBR,
  useRelatorioFinanceiro,
} from "@/components/relatorios/RelatorioFinanceiroBase";
import {
  UNIDADES,
  NOMES_UNIDADE,
  type ColunaFA,
  type ParametrosAno,
  type ParametrosMes,
  type ResultadoDRE,
} from "@/lib/dre-engine";

type LinhaFA = {
  label: string;
  campo: keyof ColunaFA;
  tipo?: "total" | "sub" | "normal";
  temPct?: boolean;
};

const LINHAS_FA: LinhaFA[] = [
  { label: "Receita Bruta", campo: "receita", tipo: "total", temPct: true },
  { label: "(-) Impostos", campo: "impostos", temPct: true },
  { label: "Receitas Líquidas", campo: "receitaLiquida", tipo: "total", temPct: true },
  { label: "(-) Custo Consultoria", campo: "custoConsultoria", temPct: true },
  { label: "(-) Comissões", campo: "comissoes", temPct: true },
  { label: "Margem de Contribuição", campo: "margemContribuicao", tipo: "total", temPct: true },
  { label: "(-) Salários", campo: "salarios", temPct: true },
  { label: "(-) Despesas de Logística", campo: "logistica", temPct: true },
  { label: "(+) Repasse Desp. Logística", campo: "repasse", temPct: true },
  { label: "(-) Publicidade & MKT", campo: "publicidade", temPct: true },
  { label: "(-) Despesas Operacionais", campo: "despesasOperacionais", temPct: true },
  { label: "Gastos Fixos", campo: "gastosFixos", tipo: "sub", temPct: true },
  { label: "Lucro Operacional", campo: "lucroOperacional", tipo: "total", temPct: true },
  { label: "(-) Rateio ADM", campo: "rateioAdm", temPct: false },
  { label: "LOP Gerencial (pós rateio)", campo: "lopGerencial", tipo: "total", temPct: true },
];

type LinhaDRE = {
  label: string;
  campo: keyof ResultadoDRE;
  destaque?: boolean;
  sinal?: -1 | 1;
};

const LINHAS_DRE: LinhaDRE[] = [
  { label: "RECEITA BRUTA", campo: "receita", destaque: true },
  { label: "(-) Impostos", campo: "impostos", sinal: -1 },
  { label: "RECEITAS LÍQUIDAS", campo: "receitaLiquida", destaque: true },
  { label: "(-) Custo Consultoria", campo: "custoConsultoria", sinal: -1 },
  { label: "(-) Comissões", campo: "comissoes", sinal: -1 },
  { label: "LUCRO BRUTO", campo: "lucroBruto", destaque: true },
  { label: "(-) Despesas de Logística", campo: "despesasLogistica", sinal: -1 },
  { label: "(+) Repasse Desp. Logística", campo: "repasseLogistica", sinal: -1 },
  { label: "MARGEM DE CONTRIBUIÇÃO", campo: "margemContribuicao", destaque: true },
  { label: "(-) Custo Fixo", campo: "custoFixo", sinal: -1 },
  { label: "(+/-) Resultado Financeiro", campo: "resultadoFinanceiro" },
  { label: "(-) Provisão IRPJ / CSLL", campo: "provisaoIr", sinal: -1 },
  { label: "LUCRO LÍQUIDO", campo: "lucroLiquido", destaque: true },
];

const CAMPOS_PARAM: { k: keyof ParametrosMes; l: string }[] = [
  { k: "salarios", l: "Salários" },
  { k: "despesasOperacionais", l: "Desp. Operacionais" },
  { k: "publicidade", l: "Publicidade & MKT" },
  { k: "outras", l: "Outras despesas" },
  { k: "resultadoFinanceiro", l: "Resultado Financeiro" },
];

export default function FinancialAnalysisDrePage() {
  const f = useRelatorioFinanceiro();
  const [verAdminMensal, setVerAdminMensal] = useState(false);
  const [edit, setEdit] = useState<ParametrosAno | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (f.dados) setEdit(JSON.parse(JSON.stringify(f.dados.parametros)));
  }, [f.dados]);

  const salvar = async () => {
    if (!edit) return;
    const r = await fetch("/api/relatorios/financeiro", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ano: f.ano, parametros: edit }),
    });
    const j = await r.json();
    setMsg(j.ok ? "Parâmetros salvos com sucesso." : `Erro: ${j.error}`);
    if (j.ok) f.recarregar();
    setTimeout(() => setMsg(""), 3500);
  };

  const fa = f.dados?.financialAnalysis;
  const dre = f.dados?.dre;

  const periodo = `${MESES[f.mesInicial - 1]}${
    f.mesInicial !== f.mesFinal ? ` a ${MESES[f.mesFinal - 1]}` : ""
  } de ${f.ano}`;

  // Unidades da grade (com exceção de Administration que tem coluna % dedicada no final)
  const UNIDADES_OPERACIONAIS = UNIDADES.filter((u) => u !== "ADMINISTRATION");

  return (
    <RelatorioShell titulo="Financial Analysis & DRE Gerencial">
      {/* Topo Executivo com Seletor de FATURADO vs PREVISTO */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
          paddingBottom: "14px",
          borderBottom: "2px solid #0083ca",
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: "var(--font-jakarta), Inter, sans-serif",
              fontSize: "24px",
              fontWeight: 800,
              color: "#1b365d",
              margin: "0 0 4px",
              letterSpacing: "-0.01em",
            }}
          >
            Financial Analysis &amp; DRE Gerencial
          </h1>
          <p style={{ margin: 0, fontSize: "12.5px", color: "var(--on-surface-variant)" }}>
            Visão consolidada por unidades · {periodo} ·{" "}
            {f.dados ? `${f.dados.totalLancamentos} lançamentos` : "Carregando..."}
          </p>
        </div>

        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "flex-end" }}>
          {/* BOTÃO SELETOR: PREVISTO vs FATURADO */}
          <div>
            <span
              style={{
                fontSize: "10.5px",
                fontWeight: 800,
                color: "var(--on-surface-variant)",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                display: "block",
                marginBottom: "4px",
              }}
            >
              Regime de Receita
            </span>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                background: "var(--surface-container-low)",
                padding: "3px",
                borderRadius: "10px",
                border: "1px solid var(--border)",
              }}
            >
              <button
                type="button"
                onClick={() => f.setTipoReceita("previsto")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 12px",
                  borderRadius: "8px",
                  border: "none",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                  background: f.tipoReceita === "previsto" ? "#1b365d" : "transparent",
                  color: f.tipoReceita === "previsto" ? "#ffffff" : "var(--on-surface-variant)",
                  transition: "all 0.15s ease",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>event_note</span>
                <span>PREVISTO (Competência)</span>
              </button>
              <button
                type="button"
                onClick={() => f.setTipoReceita("faturado")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 12px",
                  borderRadius: "8px",
                  border: "none",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                  background: f.tipoReceita === "faturado" ? "#0083ca" : "transparent",
                  color: f.tipoReceita === "faturado" ? "#ffffff" : "var(--on-surface-variant)",
                  transition: "all 0.15s ease",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>receipt</span>
                <span>FATURADO (Emissão NF)</span>
              </button>
            </div>
          </div>

          {/* Barra de Filtros (Ano fixo 2026 e Período Customizado De/Até funcional) */}
          <BarraFiltros {...f} />
        </div>
      </div>

      {f.erro && (
        <div style={{ padding: 14, borderRadius: 10, background: "#fee2e2", color: "#b91c1c", fontSize: 13 }}>
          {f.erro}
        </div>
      )}

      {/* Mini-KPIs Executivos */}
      {fa && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "14px",
          }}
        >
          {[
            {
              t: f.tipoReceita === "faturado" ? "Receita Faturada (NFs)" : "Receita Prevista",
              v: fa.total.receita,
              c: "#1b365d",
            },
            {
              t: "Margem de Contribuição",
              v: fa.total.margemContribuicao,
              c: "#059669",
              sub: pct(fa.total.margemContribuicao, fa.total.receita),
            },
            {
              t: "Lucro Bruto (DRE)",
              v: dre?.lucroBruto ?? 0,
              c: "#0284c7",
              sub: pct(dre?.lucroBruto ?? 0, fa.total.receita),
            },
            {
              t: "LOP Gerencial",
              v: fa.total.lopGerencial,
              c: fa.total.lopGerencial < 0 ? "#dc2626" : "#059669",
            },
            {
              t: "Lucro Líquido",
              v: fa.lucroLiquido,
              c: fa.lucroLiquido < 0 ? "#dc2626" : "#059669",
              sub: pct(fa.lucroLiquido, fa.total.receita),
            },
          ].map((k) => (
            <div
              key={k.t}
              style={{
                padding: "16px 18px",
                borderRadius: "14px",
                border: "1px solid #dbe5ef",
                background: "var(--surface-container-lowest)",
                boxShadow: "0 4px 12px rgba(27, 54, 93, 0.05)",
              }}
            >
              <div
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  color: "var(--on-surface-variant)",
                  letterSpacing: "0.03em",
                }}
              >
                {k.t}
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: k.c, marginTop: 4 }}>
                R$ {brl0(k.v)}
              </div>
              {k.sub && (
                <div style={{ fontSize: 11, color: "var(--on-surface-variant)", marginTop: 2 }}>
                  {k.sub} da receita
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* TABELA FINANCIAL ANALYSIS COM PERCENTUAIS EM COLUNAS PRÓPRIAS (Estilo Planilha Original) */}
      <div
        style={{
          border: "1px solid #dbe5ef",
          borderRadius: "14px",
          background: "var(--surface-container-lowest)",
          boxShadow: "0 6px 18px rgba(27, 54, 93, 0.06)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "14px 18px",
            background: "linear-gradient(90deg, #1b365d 0%, #0083ca 100%)",
            color: "#ffffff",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: "#ffffff" }}>
              Financial Analysis por Unidade de Negócio
            </h3>
            <span style={{ fontSize: "11px", opacity: 0.9, color: "#e0f2fe" }}>
              Visão analítica com percentuais em colunas dedicadas · {f.tipoReceita === "faturado" ? "Base: Faturamento Emitido" : "Base: Competência Prevista"}
            </span>
          </div>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 800,
              padding: "4px 12px",
              borderRadius: "999px",
              background: "rgba(255,255,255,0.2)",
              color: "#ffffff",
            }}
          >
            {f.tipoReceita === "faturado" ? "FATURADO" : "PREVISTO"}
          </span>
        </div>

        <div style={{ overflowX: "auto" }}>
          {f.carregando || !fa ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--on-surface-variant)" }}>
              Calculando unidades a partir dos lançamentos...
            </div>
          ) : (
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "12px",
                fontFamily: "var(--font-jakarta), Inter, sans-serif",
              }}
            >
              <thead>
                <tr style={{ background: "#f1f5f9", borderBottom: "2px solid #0083ca" }}>
                  <th
                    rowSpan={2}
                    style={{
                      padding: "10px 14px",
                      textAlign: "left",
                      fontSize: "11px",
                      fontWeight: 800,
                      color: "#1b365d",
                      minWidth: 200,
                      position: "sticky",
                      left: 0,
                      background: "#f1f5f9",
                      zIndex: 2,
                      borderRight: "1px solid #dbe5ef",
                    }}
                  >
                    FINANCIAL ANALYSIS
                  </th>
                  {/* TOTAL com 2 colunas: % e R$ */}
                  <th
                    colSpan={2}
                    style={{
                      padding: "8px 10px",
                      textAlign: "center",
                      fontSize: "11px",
                      fontWeight: 800,
                      color: "#0083ca",
                      background: "#e8f2fa",
                      borderRight: "1px solid #cbd5e1",
                    }}
                  >
                    TOTAL
                  </th>
                  {/* Unidades Operacionais (% e Valores R$) */}
                  {UNIDADES_OPERACIONAIS.map((u) => (
                    <th
                      key={u}
                      colSpan={2}
                      style={{
                        padding: "8px 10px",
                        textAlign: "center",
                        fontSize: "11px",
                        fontWeight: 800,
                        color: "#1b365d",
                        borderRight: "1px solid #cbd5e1",
                      }}
                    >
                      {NOMES_UNIDADE[u].toUpperCase()}
                    </th>
                  ))}
                  {/* ADMINISTRATION com 2 colunas: % e R$ (idêntico à planilha original) */}
                  <th
                    colSpan={2}
                    style={{
                      padding: "8px 10px",
                      textAlign: "center",
                      fontSize: "11px",
                      fontWeight: 800,
                      color: "#ea580c",
                      background: "#fff7ed",
                    }}
                  >
                    ADMINISTRATION
                  </th>
                </tr>
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #dbe5ef" }}>
                  {/* Subcolunas do TOTAL */}
                  <th style={{ padding: "6px 8px", textAlign: "right", fontSize: "10px", fontWeight: 700, color: "#64748b", width: 65, background: "#e8f2fa" }}>%</th>
                  <th style={{ padding: "6px 10px", textAlign: "right", fontSize: "10px", fontWeight: 700, color: "#0083ca", width: 110, background: "#e8f2fa", borderRight: "1px solid #cbd5e1" }}>VALOR</th>
                  {/* Subcolunas das Unidades Operacionais */}
                  {UNIDADES_OPERACIONAIS.map((u) => (
                    <React.Fragment key={`sub-${u}`}>
                      <th style={{ padding: "6px 8px", textAlign: "right", fontSize: "10px", fontWeight: 700, color: "#64748b", width: 60 }}>%</th>
                      <th style={{ padding: "6px 10px", textAlign: "right", fontSize: "10px", fontWeight: 700, color: "#1b365d", width: 100, borderRight: "1px solid #cbd5e1" }}>VALOR</th>
                    </React.Fragment>
                  ))}
                  {/* Subcolunas de ADMINISTRATION */}
                  <th style={{ padding: "6px 8px", textAlign: "right", fontSize: "10px", fontWeight: 700, color: "#ea580c", width: 65, background: "#fff7ed" }}>%</th>
                  <th style={{ padding: "6px 10px", textAlign: "right", fontSize: "10px", fontWeight: 700, color: "#ea580c", width: 110, background: "#fff7ed" }}>VALOR</th>
                </tr>
              </thead>
              <tbody>
                {/* Linha Qtde dias */}
                <tr style={{ borderTop: "1px solid #e2e8f0" }}>
                  <td style={{ padding: "8px 14px", fontWeight: 600, position: "sticky", left: 0, background: "var(--surface-container-lowest)", zIndex: 1, borderRight: "1px solid #dbe5ef" }}>
                    Qtde dias
                  </td>
                  <td style={{ padding: "8px 8px", textAlign: "right", background: "#f8fafc", color: "var(--on-surface-variant)" }}>—</td>
                  <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, background: "#f8fafc", borderRight: "1px solid #cbd5e1" }}>{brl0(fa.total.dias)}</td>
                  {UNIDADES_OPERACIONAIS.map((u) => (
                    <React.Fragment key={`dias-${u}`}>
                      <td style={{ padding: "8px 8px", textAlign: "right", color: "var(--on-surface-variant)", fontSize: "11px" }}>—</td>
                      <td style={{ padding: "8px 10px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>
                        {brl0(fa.unidades[u].dias)}
                      </td>
                    </React.Fragment>
                  ))}
                  <td style={{ padding: "8px 8px", textAlign: "right", background: "#fff7ed", color: "var(--on-surface-variant)" }}>—</td>
                  <td style={{ padding: "8px 10px", textAlign: "right", background: "#fff7ed" }}>{brl0(fa.unidades.ADMINISTRATION.dias)}</td>
                </tr>

                {/* Linha Ticket Médio */}
                <tr style={{ borderTop: "1px solid #e2e8f0" }}>
                  <td style={{ padding: "8px 14px", fontWeight: 600, position: "sticky", left: 0, background: "var(--surface-container-lowest)", zIndex: 1, borderRight: "1px solid #dbe5ef" }}>
                    Ticket Médio
                  </td>
                  <td style={{ padding: "8px 8px", textAlign: "right", background: "#f8fafc", color: "var(--on-surface-variant)" }}>100%</td>
                  <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, background: "#f8fafc", borderRight: "1px solid #cbd5e1" }}>
                    {fa.total.dias ? brl0(fa.total.receita / fa.total.dias) : "—"}
                  </td>
                  {UNIDADES_OPERACIONAIS.map((u) => {
                    const c = fa.unidades[u];
                    const tm = c.dias ? c.receita / c.dias : 0;
                    const tmTotal = fa.total.dias ? fa.total.receita / fa.total.dias : 0;
                    const tmPct = tmTotal > 0 && c.dias ? pct(tm, tmTotal) : "—";
                    return (
                      <React.Fragment key={`tm-${u}`}>
                        <td style={{ padding: "8px 8px", textAlign: "right", color: "var(--on-surface-variant)", fontSize: "11px" }}>
                          {tmPct}
                        </td>
                        <td style={{ padding: "8px 10px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>
                          {c.dias ? brl0(tm) : "—"}
                        </td>
                      </React.Fragment>
                    );
                  })}
                  <td style={{ padding: "8px 8px", textAlign: "right", background: "#fff7ed", color: "var(--on-surface-variant)" }}>0%</td>
                  <td style={{ padding: "8px 10px", textAlign: "right", background: "#fff7ed" }}>—</td>
                </tr>

                {/* Linhas da Cascata Financeira com % em coluna própria */}
                {LINHAS_FA.map((l) => {
                  const totalV = fa.total[l.campo];
                  const totalPct = l.temPct && fa.total.receita > 0 ? pct(totalV, fa.total.receita) : "—";
                  const adm = fa.unidades.ADMINISTRATION;
                  const admV = adm[l.campo];
                  const admPct = l.temPct && totalV !== 0 ? pct(admV, totalV) : "0,0%";

                  return (
                    <tr
                      key={l.label}
                      style={{
                        borderTop: "1px solid #e2e8f0",
                        background: l.tipo === "total" ? "#e8f2fa" : "transparent",
                        fontWeight: l.tipo ? 800 : 500,
                      }}
                    >
                      <td
                        style={{
                          padding: "8px 14px",
                          whiteSpace: "nowrap",
                          color: l.tipo === "total" ? "#1b365d" : undefined,
                          position: "sticky",
                          left: 0,
                          background: l.tipo === "total" ? "#e8f2fa" : "var(--surface-container-lowest)",
                          zIndex: 1,
                          borderRight: "1px solid #dbe5ef",
                        }}
                      >
                        {l.label}
                      </td>

                      {/* Coluna % do TOTAL */}
                      <td
                        style={{
                          padding: "8px 8px",
                          textAlign: "right",
                          fontSize: "11px",
                          color: "var(--on-surface-variant)",
                          background: l.tipo === "total" ? "#e0f2fe" : "#f8fafc",
                          fontWeight: 600,
                        }}
                      >
                        {totalPct}
                      </td>

                      {/* Coluna VALOR R$ do TOTAL */}
                      <td
                        style={{
                          padding: "8px 10px",
                          textAlign: "right",
                          fontWeight: l.tipo ? 800 : 700,
                          color: totalV < -0.5 ? "#dc2626" : l.tipo === "total" ? "#0083ca" : undefined,
                          background: l.tipo === "total" ? "#e0f2fe" : "#f8fafc",
                          borderRight: "1px solid #cbd5e1",
                        }}
                      >
                        {l.campo === "rateioAdm" ? "—" : brl0(totalV)}
                      </td>

                      {/* Unidades Operacionais (% e Valores) */}
                      {UNIDADES_OPERACIONAIS.map((u) => {
                        const recUnidade = fa.unidades[u].receita;
                        const val = fa.unidades[u][l.campo];
                        const uPct = l.temPct && recUnidade > 0 ? pct(val, recUnidade) : "—";

                        return (
                          <React.Fragment key={`${l.label}-${u}`}>
                            <td
                              style={{
                                padding: "8px 8px",
                                textAlign: "right",
                                fontSize: "11px",
                                color: "var(--on-surface-variant)",
                                background: l.tipo === "total" ? "#f0f7fc" : undefined,
                                fontWeight: 600,
                              }}
                            >
                              {uPct}
                            </td>
                            <td
                              style={{
                                padding: "8px 10px",
                                textAlign: "right",
                                color: val < -0.5 ? "#dc2626" : undefined,
                                background: l.tipo === "total" ? "#f0f7fc" : undefined,
                                fontWeight: l.tipo ? 800 : 500,
                                borderRight: "1px solid #cbd5e1",
                              }}
                            >
                              {brl0(val)}
                            </td>
                          </React.Fragment>
                        );
                      })}

                      {/* Coluna % de ADMINISTRATION */}
                      <td
                        style={{
                          padding: "8px 8px",
                          textAlign: "right",
                          fontSize: "11px",
                          color: "#c2410c",
                          background: "#fff7ed",
                          fontWeight: 600,
                        }}
                      >
                        {l.label.includes("Salários") || l.label.includes("Despesas Operacionais") ? "0,00%" : admPct}
                      </td>

                      {/* Coluna VALOR R$ de ADMINISTRATION */}
                      <td
                        style={{
                          padding: "8px 10px",
                          textAlign: "right",
                          color: admV < -0.5 ? "#dc2626" : undefined,
                          background: "#fff7ed",
                          fontWeight: l.tipo ? 800 : 600,
                        }}
                      >
                        {brl0(admV)}
                      </td>
                    </tr>
                  );
                })}

                {/* (+/-) Resultado Financeiro */}
                <tr style={{ borderTop: "1px solid #e2e8f0" }}>
                  <td style={{ padding: "8px 14px", fontWeight: 600, position: "sticky", left: 0, background: "var(--surface-container-lowest)", zIndex: 1, borderRight: "1px solid #dbe5ef" }}>
                    (+/-) Resultado Financeiro
                  </td>
                  <td style={{ padding: "8px 8px", textAlign: "right", fontSize: "11px", color: "var(--on-surface-variant)", background: "#f8fafc" }}>
                    {pct(fa.resultadoFinanceiro, fa.total.receita)}
                  </td>
                  <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, background: "#f8fafc", borderRight: "1px solid #cbd5e1" }}>
                    {brl0(fa.resultadoFinanceiro)}
                  </td>
                  <td colSpan={UNIDADES_OPERACIONAIS.length * 2} style={{ borderRight: "1px solid #cbd5e1" }} />
                  <td style={{ padding: "8px 8px", textAlign: "right", background: "#fff7ed", color: "#c2410c" }}>—</td>
                  <td style={{ padding: "8px 10px", textAlign: "right", background: "#fff7ed" }}>—</td>
                </tr>

                {/* LAIR */}
                <tr style={{ borderTop: "1px solid #e2e8f0" }}>
                  <td style={{ padding: "8px 14px", fontWeight: 600, position: "sticky", left: 0, background: "var(--surface-container-lowest)", zIndex: 1, borderRight: "1px solid #dbe5ef" }}>
                    Lucro Antes do IR (LAIR)
                  </td>
                  <td style={{ padding: "8px 8px", textAlign: "right", fontSize: "11px", color: "var(--on-surface-variant)", background: "#f8fafc" }}>
                    {pct(fa.lair, fa.total.receita)}
                  </td>
                  <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: fa.lair < 0 ? "#dc2626" : undefined, background: "#f8fafc", borderRight: "1px solid #cbd5e1" }}>
                    {brl0(fa.lair)}
                  </td>
                  <td colSpan={UNIDADES_OPERACIONAIS.length * 2} style={{ borderRight: "1px solid #cbd5e1" }} />
                  <td style={{ padding: "8px 8px", textAlign: "right", background: "#fff7ed", color: "#c2410c" }}>—</td>
                  <td style={{ padding: "8px 10px", textAlign: "right", background: "#fff7ed" }}>—</td>
                </tr>

                {/* Provisão IRPJ / CSLL */}
                <tr style={{ borderTop: "1px solid #e2e8f0" }}>
                  <td style={{ padding: "8px 14px", fontWeight: 600, position: "sticky", left: 0, background: "var(--surface-container-lowest)", zIndex: 1, borderRight: "1px solid #dbe5ef" }}>
                    (-) Provisão IRPJ / CSLL
                  </td>
                  <td style={{ padding: "8px 8px", textAlign: "right", fontSize: "11px", color: "var(--on-surface-variant)", background: "#f8fafc" }}>0,0%</td>
                  <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, background: "#f8fafc", borderRight: "1px solid #cbd5e1" }}>
                    {brl0(fa.provisaoIr)}
                  </td>
                  <td colSpan={UNIDADES_OPERACIONAIS.length * 2} style={{ borderRight: "1px solid #cbd5e1" }} />
                  <td style={{ padding: "8px 8px", textAlign: "right", background: "#fff7ed", color: "#c2410c" }}>—</td>
                  <td style={{ padding: "8px 10px", textAlign: "right", background: "#fff7ed" }}>—</td>
                </tr>

                {/* Lucro Líquido Final */}
                <tr style={{ borderTop: "2px solid #0083ca", background: "#f1f6fb", fontWeight: 800 }}>
                  <td style={{ padding: "10px 14px", color: "#1b365d", position: "sticky", left: 0, background: "#f1f6fb", zIndex: 1, borderRight: "1px solid #dbe5ef" }}>
                    Lucro Líquido
                  </td>
                  <td style={{ padding: "10px 8px", textAlign: "right", fontSize: "11.5px", color: fa.lucroLiquido < 0 ? "#dc2626" : "#059669", background: "#e0f2fe" }}>
                    {pct(fa.lucroLiquido, fa.total.receita)}
                  </td>
                  <td style={{ padding: "10px 10px", textAlign: "right", fontSize: "13px", color: fa.lucroLiquido < 0 ? "#dc2626" : "#059669", background: "#e0f2fe", borderRight: "1px solid #cbd5e1" }}>
                    {brl0(fa.lucroLiquido)}
                  </td>
                  <td colSpan={UNIDADES_OPERACIONAIS.length * 2} style={{ borderRight: "1px solid #cbd5e1" }} />
                  <td style={{ padding: "10px 8px", textAlign: "right", background: "#fff7ed", color: "#c2410c" }}>—</td>
                  <td style={{ padding: "10px 10px", textAlign: "right", background: "#fff7ed" }}>—</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* DRE GERENCIAL CONSOLIDADA ABAIXO DO FINANCIAL EM FORMATO COMPACTO (Print 1) */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <div
          style={{
            width: "440px",
            maxWidth: "100%",
            border: "1px solid #dbe5ef",
            borderRadius: "14px",
            background: "var(--surface-container-lowest)",
            boxShadow: "0 6px 18px rgba(27, 54, 93, 0.06)",
            overflow: "hidden",
          }}
        >
          {/* Cabeçalho da DRE */}
          <div
            style={{
              padding: "14px 18px",
              background: "linear-gradient(90deg, #1b365d 0%, #0083ca 100%)",
              color: "#ffffff",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: "#ffffff" }}>
                DRE Gerencial
              </h3>
              <span style={{ fontSize: "11px", opacity: 0.9, color: "#e0f2fe" }}>
                Demonstração consolidada do período ({periodo})
              </span>
            </div>
            <span
              style={{
                fontSize: "10.5px",
                fontWeight: 800,
                padding: "3px 9px",
                borderRadius: "999px",
                background: "rgba(255,255,255,0.2)",
                color: "#ffffff",
              }}
            >
              {f.tipoReceita === "faturado" ? "FATURADO" : "PREVISTO"}
            </span>
          </div>

          {f.carregando || !dre ? (
            <div style={{ padding: 30, textAlign: "center", color: "var(--on-surface-variant)" }}>
              Calculando DRE...
            </div>
          ) : (
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "12.5px",
                fontFamily: "var(--font-jakarta), Inter, sans-serif",
              }}
            >
              <thead>
                <tr style={{ background: "#f1f5f9", borderBottom: "2px solid #dbe5ef" }}>
                  <th
                    style={{
                      padding: "10px 14px",
                      textAlign: "left",
                      fontSize: "11px",
                      fontWeight: 800,
                      color: "#1b365d",
                    }}
                  >
                    DRE · {f.ano}
                  </th>
                  <th
                    style={{
                      padding: "10px 12px",
                      textAlign: "right",
                      fontSize: "11px",
                      fontWeight: 800,
                      color: "#1b365d",
                      width: 110,
                    }}
                  >
                    R$
                  </th>
                  <th
                    style={{
                      padding: "10px 14px",
                      textAlign: "right",
                      fontSize: "11px",
                      fontWeight: 800,
                      color: "#1b365d",
                      width: 80,
                    }}
                  >
                    % RECEITA
                  </th>
                </tr>
              </thead>
              <tbody>
                {LINHAS_DRE.map((l) => {
                  const v = dre[l.campo];
                  const isTotal = l.destaque;
                  const isLucroLiquido = l.campo === "lucroLiquido";
                  const isNegativo = v < -0.5;

                  return (
                    <tr
                      key={l.label}
                      style={{
                        borderTop: "1px solid #e2e8f0",
                        background: isLucroLiquido ? "#f8fafc" : isTotal ? "#f1f6fb" : "transparent",
                        fontWeight: isTotal ? 800 : 500,
                      }}
                    >
                      <td
                        style={{
                          padding: "9px 14px",
                          color: isLucroLiquido ? "#1b365d" : isTotal ? "#1b365d" : "var(--on-surface)",
                        }}
                      >
                        {l.label}
                      </td>
                      <td
                        style={{
                          padding: "9px 12px",
                          textAlign: "right",
                          fontWeight: isTotal ? 800 : 600,
                          color: isLucroLiquido ? (isNegativo ? "#dc2626" : "#059669") : undefined,
                        }}
                      >
                        {fmtDRE(v, l.sinal)}
                      </td>
                      <td
                        style={{
                          padding: "9px 14px",
                          textAlign: "right",
                          fontSize: "11.5px",
                          fontWeight: isTotal ? 700 : 500,
                          color: isLucroLiquido && isNegativo ? "#dc2626" : "var(--on-surface-variant)",
                        }}
                      >
                        {pct(v, dre.receita)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* CARD DISCRETO: ADMINISTRATION (OCULTO POR PADRÃO, VISÍVEL AO CLICAR EM EDITAR) */}
      <div
        style={{
          border: "1px solid #fed7aa",
          borderRadius: 14,
          background: "var(--surface-container-lowest)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "14px 18px",
            background: "linear-gradient(90deg, rgba(234, 88, 12, 0.08) 0%, rgba(234, 88, 12, 0.02) 100%)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span
              style={{
                background: "#ea580c",
                color: "#ffffff",
                fontSize: "11px",
                fontWeight: 800,
                padding: "4px 10px",
                borderRadius: "6px",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              ADMINISTRATION
            </span>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "#1b365d" }}>
              Lançamentos Manuais &amp; Custos Fixos de Sede ({f.ano})
            </span>
          </div>

          <button
            type="button"
            onClick={() => setVerAdminMensal(!verAdminMensal)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "7px 16px",
              borderRadius: "8px",
              border: "1px solid #ea580c",
              background: verAdminMensal ? "#ea580c" : "#ffffff",
              color: verAdminMensal ? "#ffffff" : "#ea580c",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
              {verAdminMensal ? "expand_less" : "edit"}
            </span>
            <span>{verAdminMensal ? "Ocultar Lançamentos" : "Editar Lançamentos Mensais"}</span>
          </button>
        </div>

        {/* Matriz Mensal e Formulário de Edição (Apenas aberto quando solicitado) */}
        {verAdminMensal && (
          <div style={{ borderTop: "2px solid #ea580c", padding: "16px", display: "flex", flexDirection: "column", gap: "18px" }}>
            {/* Tabela dos 12 meses da Administration (Print 1) */}
            <div style={{ overflowX: "auto", border: "1px solid #fed7aa", borderRadius: "10px" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 12,
                  fontFamily: "var(--font-jakarta), Inter, sans-serif",
                }}
              >
                <thead>
                  <tr style={{ background: "#334155", color: "#ffffff" }}>
                    <th
                      style={{
                        padding: "10px 14px",
                        textAlign: "left",
                        fontSize: "11px",
                        fontWeight: 800,
                        borderRight: "2px solid #ea580c",
                        minWidth: 200,
                        position: "sticky",
                        left: 0,
                        background: "#1e293b",
                        zIndex: 2,
                      }}
                    >
                      ADMINISTRATION / LINHA
                    </th>
                    {MESES.map((m, idx) => {
                      const mesNum = idx + 1;
                      const isSel = f.mesInicial === f.mesFinal && f.mesInicial === mesNum;
                      return (
                        <th
                          key={m}
                          style={{
                            padding: "10px 10px",
                            textAlign: "right",
                            fontSize: "11px",
                            fontWeight: 800,
                            minWidth: 105,
                            background: isSel ? "#ea580c" : undefined,
                            color: "#ffffff",
                          }}
                        >
                          {m.toUpperCase()}
                          {isSel && <span style={{ display: "block", fontSize: "9px" }}>ATIVO</span>}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {/* Gastos Fixos */}
                  <tr style={{ borderTop: "1px solid var(--border)", background: "rgba(234, 88, 12, 0.05)", fontWeight: 800 }}>
                    <td style={{ padding: "8px 14px", color: "#ea580c", borderRight: "2px solid #ea580c", position: "sticky", left: 0, background: "var(--surface-container-lowest)", zIndex: 1 }}>
                      Gastos Fixos
                    </td>
                    {(f.dados?.administracaoMensal ?? []).map((adm) => (
                      <td key={adm.mes} style={{ padding: "8px 10px", textAlign: "right" }}>
                        {brl2(adm.gastosFixos)}
                      </td>
                    ))}
                  </tr>
                  {/* Salários */}
                  <tr style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "8px 14px", borderRight: "2px solid #ea580c", position: "sticky", left: 0, background: "var(--surface-container-lowest)", zIndex: 1 }}>
                      (-) Salários
                    </td>
                    {(f.dados?.administracaoMensal ?? []).map((adm) => (
                      <td key={adm.mes} style={{ padding: "8px 10px", textAlign: "right" }}>
                        {brl2(adm.salarios)}
                      </td>
                    ))}
                  </tr>
                  {/* Despesas de Logística */}
                  <tr style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "8px 14px", borderRight: "2px solid #ea580c", position: "sticky", left: 0, background: "var(--surface-container-lowest)", zIndex: 1 }}>
                      (-) Despesas de Logística
                    </td>
                    {(f.dados?.administracaoMensal ?? []).map((adm) => (
                      <td key={adm.mes} style={{ padding: "8px 10px", textAlign: "right" }}>
                        {brl2(adm.logistica)}
                      </td>
                    ))}
                  </tr>
                  {/* Repasse Logística */}
                  <tr style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "8px 14px", borderRight: "2px solid #ea580c", position: "sticky", left: 0, background: "var(--surface-container-lowest)", zIndex: 1 }}>
                      (+) Repasse Desp. Logística
                    </td>
                    {(f.dados?.administracaoMensal ?? []).map((adm) => (
                      <td key={adm.mes} style={{ padding: "8px 10px", textAlign: "right" }}>
                        {brl2(adm.repasse)}
                      </td>
                    ))}
                  </tr>
                  {/* Despesas Operacionais */}
                  <tr style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "8px 14px", borderRight: "2px solid #ea580c", position: "sticky", left: 0, background: "var(--surface-container-lowest)", zIndex: 1 }}>
                      (-) Despesas Operacionais
                    </td>
                    {(f.dados?.administracaoMensal ?? []).map((adm) => (
                      <td key={adm.mes} style={{ padding: "8px 10px", textAlign: "right" }}>
                        {brl2(adm.despesasOperacionais)}
                      </td>
                    ))}
                  </tr>
                  {/* LUCRO OPERACIONAL */}
                  <tr style={{ borderTop: "1px solid var(--border)", background: "#0284c7", color: "#ffffff", fontWeight: 800 }}>
                    <td style={{ padding: "9px 14px", borderRight: "2px solid #ea580c", position: "sticky", left: 0, background: "#0284c7", zIndex: 1 }}>
                      LUCRO OPERACIONAL
                    </td>
                    {(f.dados?.administracaoMensal ?? []).map((adm) => (
                      <td key={adm.mes} style={{ padding: "9px 10px", textAlign: "right" }}>
                        {brl2(adm.lucroOperacional)}
                      </td>
                    ))}
                  </tr>
                  {/* Resultado Financeiro */}
                  <tr style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "8px 14px", fontWeight: 600, borderRight: "2px solid #ea580c", position: "sticky", left: 0, background: "var(--surface-container-lowest)", zIndex: 1 }}>
                      (+/-) Resultado Financeiro
                    </td>
                    {(f.dados?.administracaoMensal ?? []).map((adm) => (
                      <td key={adm.mes} style={{ padding: "8px 10px", textAlign: "right" }}>
                        {brl2(adm.resultadoFinanceiro)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Painel de Edição dos Lançamentos com InputMoedaBR (sem spinners e formato 0.000,00) */}
            {edit && (
              <div
                style={{
                  padding: "16px",
                  background: "#fff7ed",
                  borderRadius: "10px",
                  border: "1px solid #fed7aa",
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: "#ea580c" }}>
                    Editar Lançamentos de Sede de {f.ano} (Valores no formato 0.000,00)
                  </span>
                  <span style={{ fontSize: 11, color: "var(--on-surface-variant)" }}>
                    Valores salvos nativamente no sistema. Logística e Repasse calculados dos lançamentos.
                  </span>
                </div>

                <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                  <label style={{ fontSize: 11, fontWeight: 700 }}>
                    ALÍQUOTA DE IMPOSTOS (%)
                    <div style={{ marginTop: 4 }}>
                      <InputMoedaBR
                        valor={edit.aliquotaImpostos}
                        onChange={(v) => setEdit({ ...edit, aliquotaImpostos: v })}
                        width={110}
                      />
                    </div>
                  </label>
                  <label style={{ fontSize: 11, fontWeight: 700 }}>
                    COMISSÃO (%)
                    <div style={{ marginTop: 4 }}>
                      <InputMoedaBR
                        valor={edit.percentualComissao}
                        onChange={(v) => setEdit({ ...edit, percentualComissao: v })}
                        width={110}
                      />
                    </div>
                  </label>
                </div>

                <div
                  style={{
                    overflowX: "auto",
                    background: "#ffffff",
                    borderRadius: 8,
                    border: "1px solid #fed7aa",
                  }}
                >
                  <table style={{ borderCollapse: "collapse", fontSize: 11.5, width: "100%" }}>
                    <thead>
                      <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                        <th style={{ textAlign: "left", padding: "8px 10px", minWidth: 160 }}>Item Manual</th>
                        {MESES.map((m) => (
                          <th key={m} style={{ padding: "8px 6px", fontSize: 10, textAlign: "right", minWidth: 95 }}>
                            {m.slice(0, 3).toUpperCase()}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {CAMPOS_PARAM.map((cp) => (
                        <tr key={cp.k} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "6px 10px", fontWeight: 700, whiteSpace: "nowrap", color: "#1b365d" }}>
                            {cp.l}
                          </td>
                          {MESES.map((_, i) => (
                            <td key={i} style={{ padding: "4px 4px", textAlign: "right" }}>
                              <InputMoedaBR
                                valor={edit.meses[String(i + 1)]?.[cp.k] ?? 0}
                                onChange={(num) =>
                                  setEdit({
                                    ...edit,
                                    meses: {
                                      ...edit.meses,
                                      [String(i + 1)]: {
                                        ...edit.meses[String(i + 1)],
                                        [cp.k]: num,
                                      } as ParametrosMes,
                                    },
                                  })
                                }
                                width="100%"
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <button
                    type="button"
                    onClick={salvar}
                    style={{
                      padding: "9px 20px",
                      fontSize: 13,
                      fontWeight: 700,
                      borderRadius: 8,
                      background: "#ea580c",
                      color: "#ffffff",
                      border: "none",
                      cursor: "pointer",
                      boxShadow: "0 2px 8px rgba(234, 88, 12, 0.25)",
                    }}
                  >
                    Salvar Lançamentos da Administration
                  </button>
                  {msg && <span style={{ fontSize: 12, color: "#16a34a", fontWeight: 700 }}>{msg}</span>}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <span style={{ fontSize: 11, color: "var(--on-surface-variant)" }}>
        Valores calculados em tempo real a partir dos lançamentos do banco de dados 2026. Receita bruta exata com centavos:{" "}
        <b>{brl2(fa?.total.receita ?? 0)}</b>.
      </span>
    </RelatorioShell>
  );
}
