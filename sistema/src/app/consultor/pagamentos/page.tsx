"use client";

import React, { useState, useMemo, useEffect } from "react";
import ConsultorHeader from "@/components/ConsultorHeader";
import { useConsultor } from "@/contexts/ConsultorContext";
import ModernDropdown from "@/components/ModernDropdown";
import pagamentosBase from "@/lib/pagamentos-base.json";

export interface PagamentoItem {
  id: string;
  realizado: string;
  dataPagto: string;
  consultor: string;
  tipo: string;
  projeto: string;
  numeroNota: string;
  tipoDespesa: string;
  valor: number;
  status: "Pago" | "A Pagar" | "Cartão Corporativo";
  bm?: string;
  centroCusto: string;
  observacoes?: string;
  categoriaDoc?: string;
}

const CATEGORIAS_DOCUMENTO = [
  "NF",
  "RDV",
  "NNÓS MONEY",
  "PRÓ-LABORE",
  "AJUDA DE CUSTO",
  "APORTE",
] as const;

const ESTILOS_CATEGORIA_DOC: Record<
  string,
  { bg: string; text: string; border: string; chipActiveBg: string }
> = {
  "NF": { bg: "#e0f2fe", text: "#0369a1", border: "#bae6fd", chipActiveBg: "#0284c7" },
  "RDV": { bg: "#fef3c7", text: "#92400e", border: "#fde68a", chipActiveBg: "#d97706" },
  "NNÓS MONEY": { bg: "#d1fae5", text: "#065f46", border: "#a7f3d0", chipActiveBg: "#059669" },
  "PRÓ-LABORE": { bg: "#ede9fe", text: "#5b21b6", border: "#ddd6fe", chipActiveBg: "#7c3aed" },
  "AJUDA DE CUSTO": { bg: "#cffafe", text: "#155e75", border: "#a5f3fc", chipActiveBg: "#0891b2" },
  "APORTE": { bg: "#ffe4e6", text: "#9f1239", border: "#fecdd3", chipActiveBg: "#e11d48" },
};

function classificarCategoriaDocumento(p: { numeroNota?: string; tipoDespesa?: string; categoriaDoc?: string }): string {
  if (p.categoriaDoc && (CATEGORIAS_DOCUMENTO as readonly string[]).includes(p.categoriaDoc)) {
    return p.categoriaDoc;
  }
  const nota = String(p.numeroNota || "").trim().toUpperCase();
  const despesa = String(p.tipoDespesa || "").trim().toUpperCase();

  if (nota.includes("NNÓS MONEY") || nota.includes("NNOS MONEY")) return "NNÓS MONEY";
  if (nota.includes("PRÓ-LABORE") || nota.includes("PRO-LABORE") || nota.includes("PRÓ LABORE") || nota.includes("PRO LABORE")) return "PRÓ-LABORE";
  if (nota.includes("AJUDA DE CUSTO") || despesa.includes("AJUDA DE CUSTO")) return "AJUDA DE CUSTO";
  if (nota.includes("APORTE") || despesa.includes("APORTE")) return "APORTE";
  if (nota.includes("RDV") || despesa.includes("RDV") || despesa.includes("RELATÓRIO DE VIAGEM")) return "RDV";
  return "NF";
}

export default function ConsultorPagamentosPage() {
  const { consultorAtivo } = useConsultor();

  const [todosPagamentos, setTodosPagamentos] = useState<PagamentoItem[]>(pagamentosBase as any[]);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("TODOS");
  const [filtroTipo, setFiltroTipo] = useState("TODOS");
  const [filtroCategoria, setFiltroCategoria] = useState<string>("TODAS");
  const [anoSelecionado, setAnoSelecionado] = useState("2026");
  const [mesSelecionado, setMesSelecionado] = useState<string | null>(null);

  // Carregar dados frescos da API caso disponível
  useEffect(() => {
    fetch("/api/pagamentos")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setTodosPagamentos(data);
        }
      })
      .catch((e) => console.warn("Aviso ao carregar /api/pagamentos:", e));
  }, []);

  const brl = (val: number | null | undefined) =>
    (val || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const mesesChips = [
    { num: "01", rotulo: "Jan", nomeMes: "JANEIRO" },
    { num: "02", rotulo: "Fev", nomeMes: "FEVEREIRO" },
    { num: "03", rotulo: "Mar", nomeMes: "MARÇO" },
    { num: "04", rotulo: "Abr", nomeMes: "ABRIL" },
    { num: "05", rotulo: "Mai", nomeMes: "MAIO" },
    { num: "06", rotulo: "Jun", nomeMes: "JUNHO" },
    { num: "07", rotulo: "Jul", nomeMes: "JULHO" },
    { num: "08", rotulo: "Ago", nomeMes: "AGOSTO" },
    { num: "09", rotulo: "Set", nomeMes: "SETEMBRO" },
    { num: "10", rotulo: "Out", nomeMes: "OUTUBRO" },
    { num: "11", rotulo: "Nov", nomeMes: "NOVEMBRO" },
    { num: "12", rotulo: "Dez", nomeMes: "DEZEMBRO" },
  ];

  // Filtro do consultor logado
  const pagamentosDoConsultor = useMemo(() => {
    const nomeAtivo = (consultorAtivo?.nome || "").trim().toUpperCase();
    const clean = (s: string) => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
    const nomeLimpo = clean(nomeAtivo);

    return todosPagamentos.filter((p) => {
      const c = clean(p.consultor);
      if (!c) return false;
      return c === nomeLimpo || c.includes(nomeLimpo) || nomeLimpo.includes(c);
    });
  }, [todosPagamentos, consultorAtivo]);

  // Contagem dinâmica por categoria para os chips
  const contagemCategorias = useMemo(() => {
    const counts: Record<string, number> = {
      "TODAS": pagamentosDoConsultor.length,
      "NF": 0,
      "RDV": 0,
      "NNÓS MONEY": 0,
      "PRÓ-LABORE": 0,
      "AJUDA DE CUSTO": 0,
      "APORTE": 0,
    };
    pagamentosDoConsultor.forEach((p) => {
      const cat = classificarCategoriaDocumento(p);
      if (counts[cat] !== undefined) counts[cat]++;
    });
    return counts;
  }, [pagamentosDoConsultor]);

  // Filtragem completa com competência, categoria, status e busca
  const pagamentosFiltrados = useMemo(() => {
    return pagamentosDoConsultor.filter((p) => {
      // Filtro de ano
      if (anoSelecionado) {
        const anoData = (p.dataPagto || "").split("/")[2];
        if (anoData && anoData !== anoSelecionado) return false;
      }

      // Filtro de mês
      if (mesSelecionado !== null) {
        const mesData = (p.dataPagto || "").split("/")[1];
        const mesRealizado = (p.realizado || "").toUpperCase();
        const objMes = mesesChips.find((m) => m.num === mesSelecionado);
        const matchNum = mesData === mesSelecionado;
        const matchNome = objMes && mesRealizado.includes(objMes.nomeMes);
        if (!matchNum && !matchNome) return false;
      }

      // Filtro de Categoria
      if (filtroCategoria !== "TODAS") {
        const cat = classificarCategoriaDocumento(p);
        if (cat !== filtroCategoria) return false;
      }

      // Filtro de Status
      if (filtroStatus !== "TODOS" && p.status !== filtroStatus) return false;

      // Filtro de Tipo
      if (filtroTipo !== "TODOS" && String(p.tipo || "").toUpperCase() !== filtroTipo) return false;

      // Filtro de Busca
      if (busca.trim()) {
        const q = busca.toLowerCase();
        const proj = String(p.projeto || "").toLowerCase();
        const nota = String(p.numeroNota || "").toLowerCase();
        const desp = String(p.tipoDespesa || "").toLowerCase();
        const bm = String(p.bm || "").toLowerCase();
        const cc = String(p.centroCusto || "").toLowerCase();
        return proj.includes(q) || nota.includes(q) || desp.includes(q) || bm.includes(q) || cc.includes(q);
      }

      return true;
    });
  }, [pagamentosDoConsultor, anoSelecionado, mesSelecionado, filtroCategoria, filtroStatus, filtroTipo, busca]);

  // Indicadores KPIs oficiais
  const kpis = useMemo(() => {
    const totalValor = pagamentosFiltrados.reduce((acc, p) => acc + (p.valor || 0), 0);
    const countTotal = pagamentosFiltrados.length;

    const pagos = pagamentosFiltrados.filter((p) => p.status === "Pago");
    const totalPago = pagos.reduce((acc, p) => acc + (p.valor || 0), 0);
    const countPago = pagos.length;

    const aPagar = pagamentosFiltrados.filter((p) => p.status === "A Pagar");
    const totalAPagar = aPagar.reduce((acc, p) => acc + (p.valor || 0), 0);
    const countAPagar = aPagar.length;

    const cartao = pagamentosFiltrados.filter((p) => p.status === "Cartão Corporativo");
    const totalCartao = cartao.reduce((acc, p) => acc + (p.valor || 0), 0);
    const countCartao = cartao.length;

    return {
      totalValor,
      countTotal,
      totalPago,
      countPago,
      totalAPagar,
      countAPagar,
      totalCartao,
      countCartao,
    };
  }, [pagamentosFiltrados]);

  return (
    <>
      <ConsultorHeader tituloPagina="Meus Pagamentos" />

      <main className="content-container" style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: "20px" }}>
        {/* Topo: Título & Seletor de Competência (Idêntico a /pagamentos) */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span className="material-symbols-outlined" style={{ color: "var(--primary)", fontSize: "26px" }}>
                payments
              </span>
              <h1 style={{ fontSize: "22px", fontWeight: 800, margin: 0, color: "var(--primary)" }}>
                Meus Pagamentos &amp; Repasses Financeiros
              </h1>
            </div>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "var(--on-surface-variant)" }}>
              Acompanhamento de liquidações financeiras, extrato de NFs, RDVs e previsão de pagamentos de <strong>{consultorAtivo?.nome}</strong>.
            </p>
          </div>

          {/* Seletor de Competência */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              backgroundColor: "var(--surface-container-lowest)",
              padding: "6px 10px",
              borderRadius: "12px",
              border: "1px solid var(--border)",
              boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", fontWeight: 700, color: "var(--on-surface)" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "var(--primary)" }}>calendar_today</span>
              <span>{anoSelecionado}</span>
            </div>

            <div style={{ height: "18px", width: "1px", backgroundColor: "var(--border)", margin: "0 4px" }} />

            <div style={{ display: "flex", gap: "2px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setMesSelecionado(null)}
                style={{
                  padding: "4px 8px",
                  borderRadius: "6px",
                  fontSize: "11px",
                  fontWeight: 700,
                  border: "none",
                  cursor: "pointer",
                  backgroundColor: mesSelecionado === null ? "var(--primary)" : "transparent",
                  color: mesSelecionado === null ? "#ffffff" : "var(--on-surface-variant)",
                }}
              >
                Todos
              </button>
              {mesesChips.map((m) => {
                const isAtivo = mesSelecionado === m.num;
                return (
                  <button
                    key={m.num}
                    type="button"
                    onClick={() => setMesSelecionado(m.num)}
                    style={{
                      padding: "4px 8px",
                      borderRadius: "6px",
                      fontSize: "11px",
                      fontWeight: 700,
                      border: "none",
                      cursor: "pointer",
                      backgroundColor: isAtivo ? "var(--primary)" : "transparent",
                      color: isAtivo ? "#ffffff" : "var(--on-surface-variant)",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {m.rotulo}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Chips de Categorias Documentais (Idêntico ao padrão oficial) */}
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setFiltroCategoria("TODAS")}
            style={{
              padding: "6px 14px",
              borderRadius: "999px",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
              border: "1px solid var(--border)",
              backgroundColor: filtroCategoria === "TODAS" ? "var(--primary)" : "var(--surface-container-lowest)",
              color: filtroCategoria === "TODAS" ? "#ffffff" : "var(--on-surface)",
              boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span>Todas as Categorias</span>
            <span style={{ fontSize: "10px", padding: "1px 6px", borderRadius: "999px", backgroundColor: filtroCategoria === "TODAS" ? "rgba(255,255,255,0.25)" : "var(--surface-container)" }}>
              {contagemCategorias["TODAS"]}
            </span>
          </button>

          {CATEGORIAS_DOCUMENTO.map((cat) => {
            const estilo = ESTILOS_CATEGORIA_DOC[cat];
            const isAtiva = filtroCategoria === cat;
            const count = contagemCategorias[cat] || 0;

            return (
              <button
                key={cat}
                type="button"
                onClick={() => setFiltroCategoria(cat)}
                style={{
                  padding: "6px 12px",
                  borderRadius: "999px",
                  fontSize: "11px",
                  fontWeight: 700,
                  cursor: "pointer",
                  border: isAtiva ? `1px solid ${estilo.chipActiveBg}` : `1px solid ${estilo.border}`,
                  backgroundColor: isAtiva ? estilo.chipActiveBg : estilo.bg,
                  color: isAtiva ? "#ffffff" : estilo.text,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  transition: "all 0.15s ease",
                }}
              >
                <span>{cat}</span>
                <span
                  style={{
                    fontSize: "10px",
                    padding: "1px 6px",
                    borderRadius: "999px",
                    backgroundColor: isAtiva ? "rgba(255,255,255,0.25)" : "#ffffff",
                    color: isAtiva ? "#ffffff" : estilo.text,
                    fontWeight: 800,
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* 4 Cards de Indicadores Financeiros (KPIs Idênticos ao Oficial) */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px" }}>
          {/* Card 1: Total Geral */}
          <div style={{ padding: "18px 20px", borderRadius: "14px", backgroundColor: "var(--surface-container-lowest)", border: "1px solid var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.02)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--on-surface-variant)" }}>TOTAL GERAL</span>
              <div style={{ fontSize: "22px", fontWeight: 800, color: "var(--primary)", marginTop: "4px" }}>
                {brl(kpis.totalValor)}
              </div>
              <span style={{ fontSize: "11px", color: "var(--on-surface-variant)" }}>
                {kpis.countTotal} lançamentos
              </span>
            </div>
            <div style={{ width: "40px", height: "40px", borderRadius: "10px", backgroundColor: "rgba(0,21,47,0.06)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary)" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>account_balance_wallet</span>
            </div>
          </div>

          {/* Card 2: Pago */}
          <div style={{ padding: "18px 20px", borderRadius: "14px", backgroundColor: "var(--surface-container-lowest)", border: "1px solid var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.02)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#16a34a" }}>PAGO</span>
              <div style={{ fontSize: "22px", fontWeight: 800, color: "#16a34a", marginTop: "4px" }}>
                {brl(kpis.totalPago)}
              </div>
              <span style={{ fontSize: "11px", color: "var(--on-surface-variant)" }}>
                {kpis.countPago} liquidados
              </span>
            </div>
            <div style={{ width: "40px", height: "40px", borderRadius: "10px", backgroundColor: "#dcfce7", display: "flex", alignItems: "center", justifyContent: "center", color: "#16a34a" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>check_circle</span>
            </div>
          </div>

          {/* Card 3: A Pagar */}
          <div style={{ padding: "18px 20px", borderRadius: "14px", backgroundColor: "var(--surface-container-lowest)", border: "1px solid var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.02)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#ea580c" }}>A PAGAR</span>
              <div style={{ fontSize: "22px", fontWeight: 800, color: "#ea580c", marginTop: "4px" }}>
                {brl(kpis.totalAPagar)}
              </div>
              <span style={{ fontSize: "11px", color: "var(--on-surface-variant)" }}>
                {kpis.countAPagar} pendentes
              </span>
            </div>
            <div style={{ width: "40px", height: "40px", borderRadius: "10px", backgroundColor: "#ffedd5", display: "flex", alignItems: "center", justifyContent: "center", color: "#ea580c" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>schedule</span>
            </div>
          </div>

          {/* Card 4: Cartão Corporativo */}
          <div style={{ padding: "18px 20px", borderRadius: "14px", backgroundColor: "var(--surface-container-lowest)", border: "1px solid var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.02)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--secondary)" }}>CARTÃO CORPORATIVO</span>
              <div style={{ fontSize: "22px", fontWeight: 800, color: "var(--secondary)", marginTop: "4px" }}>
                {brl(kpis.totalCartao)}
              </div>
              <span style={{ fontSize: "11px", color: "var(--on-surface-variant)" }}>
                {kpis.countCartao} faturados
              </span>
            </div>
            <div style={{ width: "40px", height: "40px", borderRadius: "10px", backgroundColor: "rgba(0,103,129,0.08)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--secondary)" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>credit_card</span>
            </div>
          </div>
        </div>

        {/* Barra de Busca e Filtros Dropdowns (Idêntico ao Oficial) */}
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
            boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, minWidth: "280px" }}>
            <span className="material-symbols-outlined" style={{ color: "var(--on-surface-variant)", fontSize: "18px" }}>
              search
            </span>
            <input
              type="text"
              placeholder="Buscar por projeto, nota/recibo, despesa ou BM..."
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

          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <ModernDropdown
              value={filtroStatus}
              onChange={(val) => setFiltroStatus(String(val))}
              options={[
                { value: "TODOS", label: "Todos os Status" },
                { value: "Pago", label: "Pago" },
                { value: "A Pagar", label: "A Pagar" },
                { value: "Cartão Corporativo", label: "Cartão Corporativo" },
              ]}
              icon="filter_list"
              searchable={false}
              minWidth={170}
            />

            <ModernDropdown
              value={filtroTipo}
              onChange={(val) => setFiltroTipo(String(val))}
              options={[
                { value: "TODOS", label: "Todos os Tipos" },
                { value: "PARCEIRO", label: "PARCEIRO" },
                { value: "SÓCIO", label: "SÓCIO" },
                { value: "FUNCIONÁRIO", label: "FUNCIONÁRIO" },
                { value: "FORNECEDOR", label: "FORNECEDOR" },
              ]}
              icon="badge"
              searchable={false}
              minWidth={160}
            />
          </div>
        </div>

        {/* Tabela Completa de Pagamentos (Layout Idêntico a /pagamentos) */}
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
          <div style={{ overflowX: "auto" }}>
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
                  <th style={{ padding: "12px 16px" }}>Realizado</th>
                  <th style={{ padding: "12px 16px" }}>Data Pagto</th>
                  <th style={{ padding: "12px 16px" }}>Favorecido / Consultor</th>
                  <th style={{ padding: "12px 16px" }}>Projeto / Centro de Custo</th>
                  <th style={{ padding: "12px 16px" }}>Número da Nota / Doc</th>
                  <th style={{ padding: "12px 16px" }}>Categoria</th>
                  <th style={{ padding: "12px 16px" }}>Tipo de Despesa</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>Valor (R$)</th>
                  <th style={{ padding: "12px 16px", textAlign: "center" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {pagamentosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ padding: "36px", textAlign: "center", color: "var(--on-surface-variant)" }}>
                      Nenhum registro de pagamento encontrado para os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  pagamentosFiltrados.map((p, idx) => {
                    const catDoc = classificarCategoriaDocumento(p);
                    const estiloCat = ESTILOS_CATEGORIA_DOC[catDoc] || ESTILOS_CATEGORIA_DOC["NF"];
                    const isPago = p.status === "Pago";
                    const isCartao = p.status === "Cartão Corporativo";

                    return (
                      <tr
                        key={p.id || idx}
                        style={{
                          borderBottom: "1px solid var(--border)",
                          backgroundColor: idx % 2 === 1 ? "var(--surface-container-low)" : "transparent",
                        }}
                      >
                        <td style={{ padding: "12px 16px", fontWeight: 700, color: "var(--primary)" }}>
                          {p.realizado}
                        </td>
                        <td style={{ padding: "12px 16px", color: "var(--on-surface)" }}>
                          {p.dataPagto}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <div style={{ fontWeight: 700, color: "var(--primary)" }}>{p.consultor}</div>
                          <span
                            style={{
                              fontSize: "10px",
                              fontWeight: 700,
                              padding: "1px 6px",
                              borderRadius: "4px",
                              backgroundColor: "var(--surface-container)",
                              color: "var(--on-surface-variant)",
                              display: "inline-block",
                              marginTop: "2px",
                            }}
                          >
                            {p.tipo || "PARCEIRO"}
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <div style={{ fontWeight: 600, color: "var(--on-surface)" }}>{p.projeto}</div>
                          {p.centroCusto && (
                            <div style={{ fontSize: "11px", color: "var(--on-surface-variant)", marginTop: "2px" }}>
                              CC: {p.centroCusto}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: "12px 16px", fontFamily: "monospace", fontSize: "12px", color: "var(--on-surface)" }}>
                          {p.numeroNota}
                          {p.bm && (
                            <span style={{ display: "block", fontSize: "10px", color: "var(--secondary)", fontWeight: 700 }}>
                              BM {p.bm}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <span
                            style={{
                              fontSize: "10px",
                              fontWeight: 800,
                              padding: "2px 8px",
                              borderRadius: "999px",
                              backgroundColor: estiloCat.bg,
                              color: estiloCat.text,
                              border: `1px solid ${estiloCat.border}`,
                              display: "inline-block",
                            }}
                          >
                            {catDoc}
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px", color: "var(--on-surface-variant)" }}>
                          {p.tipoDespesa}
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 800, color: isPago ? "#059669" : "var(--primary)", fontSize: "13px" }}>
                          {brl(p.valor)}
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "center" }}>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              padding: "3px 10px",
                              borderRadius: "999px",
                              fontSize: "11px",
                              fontWeight: 700,
                              backgroundColor: isPago ? "#dcfce7" : isCartao ? "#e0f2fe" : "#ffedd5",
                              color: isPago ? "#15803d" : isCartao ? "#0369a1" : "#c2410c",
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: "13px" }}>
                              {isPago ? "check_circle" : isCartao ? "credit_card" : "pending"}
                            </span>
                            {p.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </>
  );
}
