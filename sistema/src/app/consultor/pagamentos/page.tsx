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
] as const;

const ESTILOS_CATEGORIA_DOC: Record<
  string,
  { bg: string; text: string; border: string; chipActiveBg: string; chipActiveText: string; chipInactiveBg: string; chipInactiveText: string; chipInactiveBorder: string; badgeBg: string; badgeText: string; badgeBorder: string; }
> = {
  "NF": {
    bg: "#e0f2fe",
    text: "#0369a1",
    border: "#bae6fd",
    chipActiveBg: "#0284c7",
    chipActiveText: "#ffffff",
    chipInactiveBg: "#f0f9ff",
    chipInactiveText: "#0369a1",
    chipInactiveBorder: "#bae6fd",
    badgeBg: "#e0f2fe",
    badgeText: "#0369a1",
    badgeBorder: "#bae6fd",
  },
  "RDV": {
    bg: "#fef3c7",
    text: "#92400e",
    border: "#fde68a",
    chipActiveBg: "#d97706",
    chipActiveText: "#ffffff",
    chipInactiveBg: "#fffbeb",
    chipInactiveText: "#92400e",
    chipInactiveBorder: "#fde68a",
    badgeBg: "#fef3c7",
    badgeText: "#92400e",
    badgeBorder: "#fde68a",
  },
};

function classificarCategoriaDocumento(p: { numeroNota?: string; tipoDespesa?: string; categoriaDoc?: string }): "NF" | "RDV" {
  if (p.categoriaDoc === "RDV") return "RDV";
  const nota = String(p.numeroNota || "").trim().toUpperCase();
  const despesa = String(p.tipoDespesa || "").trim().toUpperCase();
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

  // Contagem dinâmica por categoria para os chips (Apenas NF e RDV)
  const contagemCategorias = useMemo(() => {
    const counts: Record<string, number> = {
      "TODAS": pagamentosDoConsultor.length,
      "NF": 0,
      "RDV": 0,
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

          {/* Seletor de Competência com ModernDropdown de Ano */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              backgroundColor: "var(--surface-container-lowest)",
              padding: "4px 8px",
              borderRadius: "12px",
              border: "1px solid var(--border)",
              boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
            }}
          >
            <ModernDropdown
              value={anoSelecionado}
              onChange={(val) => setAnoSelecionado(String(val))}
              options={[
                { value: "TODOS", label: "Todos os Anos" },
                { value: "2024", label: "2024" },
                { value: "2025", label: "2025" },
                { value: "2026", label: "2026" },
                { value: "2027", label: "2027" },
              ]}
              icon="calendar_today"
              searchable={false}
              minWidth={115}
              buttonStyle={{ padding: "3px 8px", fontSize: "12px", height: "28px", border: "none", backgroundColor: "transparent" }}
            />

            <div style={{ height: "18px", width: "1px", backgroundColor: "var(--border)", margin: "0 2px" }} />

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

        {/* 4 Cards de Indicadores Financeiros (KPIs Idênticos ao Oficial) */}
        {/* 3 Cards de Indicadores Financeiros (Idêntico ao Print 1 - Sem Cartão Corporativo) */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "14px" }}>
          {/* Card 1: Total Lançamentos */}
          <div style={{ padding: "18px 20px", borderRadius: "14px", backgroundColor: "var(--surface-container-lowest)", border: "1px solid var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--on-surface-variant)", letterSpacing: "0.04em" }}>
              TOTAL LANÇAMENTOS
            </span>
            <div style={{ fontSize: "22px", fontWeight: 800, color: "var(--primary)", marginTop: "4px" }}>
              {brl(kpis.totalValor)}
            </div>
            <span style={{ fontSize: "11px", color: "var(--on-surface-variant)" }}>
              {kpis.countTotal} registros no filtro
            </span>
          </div>

          {/* Card 2: Efetivamente Pago */}
          <div style={{ padding: "18px 20px", borderRadius: "14px", backgroundColor: "var(--surface-container-lowest)", border: "1px solid var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.02)", position: "relative" }}>
            <span style={{ position: "absolute", top: "18px", right: "20px", width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#16a34a" }} />
            <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#16a34a", letterSpacing: "0.04em" }}>
              EFETIVAMENTE PAGO
            </span>
            <div style={{ fontSize: "22px", fontWeight: 800, color: "#16a34a", marginTop: "4px" }}>
              {brl(kpis.totalPago)}
            </div>
            <span style={{ fontSize: "11px", color: "var(--on-surface-variant)" }}>
              Liquidado em conta corrente
            </span>
          </div>

          {/* Card 3: A Pagar */}
          <div style={{ padding: "18px 20px", borderRadius: "14px", backgroundColor: "var(--surface-container-lowest)", border: "1px solid var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.02)", position: "relative" }}>
            <span style={{ position: "absolute", top: "18px", right: "20px", width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#ea580c" }} />
            <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#ea580c", letterSpacing: "0.04em" }}>
              A PAGAR
            </span>
            <div style={{ fontSize: "22px", fontWeight: 800, color: "#ea580c", marginTop: "4px" }}>
              {brl(kpis.totalAPagar)}
            </div>
            <span style={{ fontSize: "11px", color: "var(--on-surface-variant)" }}>
              BMs e despesas em fluxo
            </span>
          </div>
        </div>

        {/* Barra de Busca e Filtros Dropdowns (Idêntico ao Print 1) */}
        <div
          style={{
            backgroundColor: "var(--surface-container-lowest)",
            padding: "16px 20px",
            borderRadius: "14px",
            border: "1px solid var(--border)",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
          }}
        >
          {/* Linha 1: Input de Busca + Dropdowns */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, minWidth: "260px", backgroundColor: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", padding: "6px 12px" }}>
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
              {busca && (
                <button
                  type="button"
                  onClick={() => setBusca("")}
                  style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--on-surface-variant)", padding: 0 }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>close</span>
                </button>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
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
                minWidth={170}
              />

              <ModernDropdown
                value={filtroStatus}
                onChange={(val) => setFiltroStatus(String(val))}
                options={[
                  { value: "TODOS", label: "Todos os Status" },
                  { value: "Pago", label: "Pago" },
                  { value: "A Pagar", label: "A Pagar" },
                ]}
                icon="filter_list"
                searchable={false}
                minWidth={170}
              />
            </div>
          </div>

          {/* Linha 2: Chips de Documentos (Apenas NF e RDV conforme solicitado) */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--on-surface-variant)", letterSpacing: "0.04em" }}>
              DOCUMENTO:
            </span>
            <button
              type="button"
              onClick={() => setFiltroCategoria("TODAS")}
              style={{
                padding: "4px 12px",
                borderRadius: "20px",
                fontSize: "11px",
                fontWeight: 700,
                cursor: "pointer",
                border: "1px solid var(--border)",
                backgroundColor: filtroCategoria === "TODAS" ? "#002b49" : "var(--surface-container-low, #f8fafc)",
                color: filtroCategoria === "TODAS" ? "#ffffff" : "var(--on-surface)",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span>TODOS</span>
              <span style={{ fontSize: "10px", padding: "1px 6px", borderRadius: "10px", backgroundColor: filtroCategoria === "TODAS" ? "rgba(255,255,255,0.25)" : "var(--surface-container)" }}>
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
                    padding: "4px 12px",
                    borderRadius: "20px",
                    fontSize: "11px",
                    fontWeight: 700,
                    cursor: "pointer",
                    border: isAtiva ? `1px solid ${estilo.chipActiveBg}` : `1px solid ${estilo.chipInactiveBorder}`,
                    backgroundColor: isAtiva ? estilo.chipActiveBg : estilo.chipInactiveBg,
                    color: isAtiva ? estilo.chipActiveText : estilo.chipInactiveText,
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
                      borderRadius: "10px",
                      backgroundColor: isAtiva ? "rgba(255,255,255,0.25)" : estilo.bg,
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
        </div>

        {/* Tabela de Pagamentos (Layout Idêntico ao Print 1) */}
        <div
          style={{
            backgroundColor: "var(--surface-container-lowest)",
            borderRadius: "12px",
            border: "1px solid var(--border)",
            overflow: "hidden",
            boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
            width: "100%",
          }}
        >
          {/* Header Superior da Tabela Turquesa (Idêntico ao Print 1) */}
          <div
            style={{
              padding: "12px 18px",
              backgroundColor: "#00a3ad",
              color: "#ffffff",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "12px",
              fontWeight: 700,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>table_chart</span>
              <span style={{ letterSpacing: "0.5px", textTransform: "uppercase" }}>PAGAMENTOS &amp; REPASSES OPERACIONAIS</span>
            </div>
            <span style={{ fontSize: "11px", backgroundColor: "rgba(255,255,255,0.2)", padding: "3px 10px", borderRadius: "999px", fontWeight: 700 }}>
              {pagamentosFiltrados.length} Lançamentos Registrados
            </span>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11.5px", textAlign: "left" }}>
              <thead>
                <tr
                  style={{
                    backgroundColor: "#f8fafc",
                    borderBottom: "1px solid #e2e8f0",
                    color: "#475569",
                    textTransform: "uppercase",
                    fontSize: "10px",
                    fontWeight: 700,
                    letterSpacing: "0.04em",
                    whiteSpace: "nowrap",
                  }}
                >
                  <th style={{ padding: "10px 14px", width: "85px" }}>Realizado</th>
                  <th style={{ padding: "10px 12px", width: "90px" }}>Data Pgto</th>
                  <th style={{ padding: "10px 14px", minWidth: "160px" }}>Consultor / Beneficiário</th>
                  <th style={{ padding: "10px 12px", width: "100px", textAlign: "center" }}>Tipo</th>
                  <th style={{ padding: "10px 14px", minWidth: "180px" }}>Projeto</th>
                  <th style={{ padding: "10px 12px", width: "135px", textAlign: "center" }}>Nº Nota / RDV</th>
                  <th style={{ padding: "10px 14px", textAlign: "right", width: "110px" }}>Valor</th>
                  <th style={{ padding: "10px 12px", width: "105px" }}>Status</th>
                  <th style={{ padding: "10px 10px", textAlign: "center", width: "65px" }}>BM</th>
                  <th style={{ padding: "10px 14px", minWidth: "100px" }}>Obs.</th>
                </tr>
              </thead>
              <tbody>
                {pagamentosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ padding: "36px", textAlign: "center", color: "var(--on-surface-variant)" }}>
                      Nenhum registro de pagamento encontrado para os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  pagamentosFiltrados.map((item, idx) => {
                    const rawNota = (item.numeroNota || "").trim();
                    const isNFBM = rawNota.toUpperCase().startsWith("NF BM") || rawNota.toUpperCase().startsWith("NF-BM");
                    const notaLimpa = (!rawNota || isNFBM || rawNota === "—") ? "—" : rawNota;
                    const isVazio = notaLimpa === "—";
                    const catDoc = classificarCategoriaDocumento(item);
                    const estilo = ESTILOS_CATEGORIA_DOC[catDoc] || ESTILOS_CATEGORIA_DOC["NF"];
                    const isPago = item.status === "Pago";

                    return (
                      <tr
                        key={item.id || idx}
                        style={{
                          borderBottom: "1px solid #f1f5f9",
                          backgroundColor: idx % 2 === 0 ? "#ffffff" : "#fcfcfd",
                          transition: "background-color 0.15s ease",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f8fafc")}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = idx % 2 === 0 ? "#ffffff" : "#fcfcfd")}
                      >
                        {/* Realizado */}
                        <td style={{ padding: "10px 14px", fontWeight: 700, color: "#64748b", fontSize: "11px", whiteSpace: "nowrap" }}>
                          {item.realizado}
                        </td>

                        {/* Data Pgto */}
                        <td style={{ padding: "10px 12px", fontWeight: 600, color: "#0f172a", whiteSpace: "nowrap" }}>
                          {item.dataPagto}
                        </td>

                        {/* Consultor / Beneficiário */}
                        <td style={{ padding: "10px 14px", fontWeight: 700, color: "#0f2a4a", whiteSpace: "nowrap" }}>
                          {item.consultor}
                        </td>

                        {/* Tipo (Centralizado) */}
                        <td style={{ padding: "10px 12px", textAlign: "center", whiteSpace: "nowrap" }}>
                          <span
                            style={{
                              display: "inline-block",
                              textAlign: "center",
                              padding: "2px 8px",
                              borderRadius: "4px",
                              fontSize: "10px",
                              fontWeight: 700,
                              backgroundColor:
                                item.tipo === "SÓCIO"
                                  ? "#f3e8ff"
                                  : item.tipo === "FUNCIONÁRIO"
                                  ? "#dcfce7"
                                  : "#e0f2fe",
                              color:
                                item.tipo === "SÓCIO"
                                  ? "#6b21a8"
                                  : item.tipo === "FUNCIONÁRIO"
                                  ? "#166534"
                                  : "#0369a1",
                            }}
                          >
                            {item.tipo || "PARCEIRO"}
                          </span>
                        </td>

                        {/* Projeto */}
                        <td style={{ padding: "10px 14px", fontWeight: 600, color: "#1e293b", whiteSpace: "nowrap" }}>
                          {item.projeto}
                        </td>

                        {/* Nº Nota / RDV com Cor Correspondente ao Tipo */}
                        <td style={{ padding: "10px 12px", textAlign: "center", whiteSpace: "nowrap" }}>
                          <span
                            title={`Documento: ${catDoc} - ${notaLimpa}`}
                            style={{
                              display: "inline-block",
                              minWidth: "75px",
                              maxWidth: "140px",
                              textAlign: "center",
                              padding: "3px 10px",
                              borderRadius: "6px",
                              fontSize: "11px",
                              fontWeight: 700,
                              backgroundColor: isVazio ? "transparent" : estilo.badgeBg,
                              color: isVazio ? "#94a3b8" : estilo.badgeText,
                              border: isVazio ? "1px dashed #cbd5e1" : `1px solid ${estilo.badgeBorder}`,
                              whiteSpace: "nowrap",
                              textOverflow: "ellipsis",
                              overflow: "hidden",
                            }}
                          >
                            {notaLimpa}
                          </span>
                        </td>

                        {/* Valor */}
                        <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 800, color: "#0f172a", whiteSpace: "nowrap", fontSize: "12px" }}>
                          R$ {Number(item.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </td>

                        {/* Status */}
                        <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                          <span
                            style={{
                              padding: "3px 8px",
                              borderRadius: "4px",
                              fontSize: "10.5px",
                              fontWeight: 700,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "3px",
                              backgroundColor: isPago ? "#dcfce7" : "#fee2e2",
                              color: isPago ? "#166534" : "#991b1b",
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: "12px" }}>
                              {isPago ? "check_circle" : "pending"}
                            </span>
                            {item.status}
                          </span>
                        </td>

                        {/* BM */}
                        <td style={{ padding: "10px 10px", textAlign: "center", whiteSpace: "nowrap" }}>
                          {item.bm ? (
                            <span
                              style={{
                                display: "inline-block",
                                backgroundColor: "#00152f",
                                color: "#ffffff",
                                padding: "2px 8px",
                                borderRadius: "4px",
                                fontWeight: 800,
                                fontSize: "10.5px",
                              }}
                            >
                              {item.bm}
                            </span>
                          ) : (
                            <span style={{ color: "#94a3b8" }}>—</span>
                          )}
                        </td>

                        {/* Obs */}
                        <td style={{ padding: "10px 14px", color: "#64748b", fontSize: "11px", whiteSpace: "nowrap" }}>
                          {item.observacoes || "—"}
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
