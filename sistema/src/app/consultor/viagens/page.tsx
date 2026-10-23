"use client";

import React, { useState, useMemo } from "react";
import ConsultorHeader from "@/components/ConsultorHeader";
import { useConsultor } from "@/contexts/ConsultorContext";
import ModernDropdown from "@/components/ModernDropdown";
import { formatarPeriodoBR } from "@/lib/date-utils";

export default function ConsultorViagensPage() {
  const { consultorAtivo, dadosConsultor } = useConsultor();

  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("TODOS");
  const [anoSelecionado, setAnoSelecionado] = useState(2026);
  const [mesSelecionado, setMesSelecionado] = useState<number | null>(null);
  const [cardsExpandidos, setCardsExpandidos] = useState<Set<string>>(new Set());

  const alternarCard = (id: string) => {
    setCardsExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const brl = (val: number | null | undefined) =>
    (val || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const mesesChips = [
    { num: 1, rotulo: "Jan" },
    { num: 2, rotulo: "Fev" },
    { num: 3, rotulo: "Mar" },
    { num: 4, rotulo: "Abr" },
    { num: 5, rotulo: "Mai" },
    { num: 6, rotulo: "Jun" },
    { num: 7, rotulo: "Jul" },
    { num: 8, rotulo: "Ago" },
    { num: 9, rotulo: "Set" },
    { num: 10, rotulo: "Out" },
    { num: 11, rotulo: "Nov" },
    { num: 12, rotulo: "Dez" },
  ];

  const viagensOriginais = dadosConsultor?.viagens || [];

  // Filtragem
  const viagensFiltradas = useMemo(() => {
    return viagensOriginais.filter((v: any) => {
      // Filtro de mês/ano
      if (v.dataInicial || v.data_inicial) {
        const dStr = v.dataInicial || v.data_inicial;
        let anoItem = 2026;
        let mesItem = 1;
        if (dStr.includes("-")) {
          const parts = dStr.split("-");
          anoItem = parseInt(parts[0], 10);
          mesItem = parseInt(parts[1], 10);
        } else if (dStr.includes("/")) {
          const parts = dStr.split("/");
          anoItem = parseInt(parts[2], 10);
          mesItem = parseInt(parts[1], 10);
        }
        if (anoSelecionado && anoItem !== anoSelecionado) return false;
        if (mesSelecionado !== null && mesItem !== mesSelecionado) return false;
      }

      // Filtro de status
      if (filtroStatus !== "TODOS") {
        const st = (v.status || "").toUpperCase();
        if (filtroStatus === "CONCLUIDO" && !st.includes("CONCLU")) return false;
        if (filtroStatus === "VOUCHERS_ENVIADOS" && !st.includes("VOUCHER")) return false;
        if (filtroStatus === "EM_COTACAO" && !st.includes("COTAC")) return false;
        if (filtroStatus === "APROVADO" && !st.includes("APROV")) return false;
      }

      // Filtro de busca
      if (busca.trim()) {
        const q = busca.toLowerCase();
        const proj = String(v.projeto || "").toLowerCase();
        const ativ = String(v.atividade || "").toLowerCase();
        const dest = String(v.destino || "").toLowerCase();
        const cons = String(v.consultor || v.viajante || "").toLowerCase();
        return proj.includes(q) || ativ.includes(q) || dest.includes(q) || cons.includes(q);
      }

      return true;
    });
  }, [viagensOriginais, anoSelecionado, mesSelecionado, filtroStatus, busca]);

  // Contadores KPIs (Print 5)
  const kpis = useMemo(() => {
    const total = viagensFiltradas.length;
    const emCotacao = viagensFiltradas.filter((v: any) => (v.status || "").toUpperCase().includes("COTAC")).length;
    const paraAprovar = viagensFiltradas.filter((v: any) => (v.status || "").toUpperCase().includes("AGUARDANDO_APROVACAO")).length;
    const paraComprar = viagensFiltradas.filter((v: any) => (v.status || "").toUpperCase().includes("COMPRA") || (v.status || "").toUpperCase().includes("CONTRATACAO")).length;
    const vouchersEnviados = viagensFiltradas.filter((v: any) => (v.status || "").toUpperCase().includes("VOUCHER")).length;
    const concluidas = viagensFiltradas.filter((v: any) => (v.status || "").toUpperCase().includes("CONCLU")).length;

    return { total, emCotacao, paraAprovar, paraComprar, vouchersEnviados, concluidas };
  }, [viagensFiltradas]);

  const politicas = [
    {
      nome: "NNÓS Consultoria (Geral)",
      desc: "Oficial / Regra Geral",
      arquivo: "/politicas/politica-nnos.pdf",
      img: "/politicas/politica-nnos.jpg",
      tipo: "Regra Padrão",
      badgeCor: "#e0f2fe",
      badgeTexto: "#0369a1",
    },
    {
      nome: "CNH Training",
      desc: "Cliente Específico",
      arquivo: "/politicas/politica-cnh.pdf",
      img: "/politicas/politica-cnh.jpg",
      tipo: "Específica",
      badgeCor: "#fef3c7",
      badgeTexto: "#92400e",
    },
    {
      nome: "Iveco Group",
      desc: "Cliente Específico",
      arquivo: "/politicas/politica-iveco.pdf",
      img: "/politicas/politica-iveco.jpg",
      tipo: "Específica",
      badgeCor: "#fef3c7",
      badgeTexto: "#92400e",
    },
    {
      nome: "Reembolso Vexpenses",
      desc: "Prestação de Contas",
      arquivo: "/politicas/politica-reembolso-nnos.pdf",
      img: "/politicas/politica-reembolso-nnos.jpg",
      tipo: "Prestação Contas",
      badgeCor: "#dcfce7",
      badgeTexto: "#15803d",
    },
  ];

  return (
    <>
      <ConsultorHeader tituloPagina="Minhas Viagens" />

      <main className="content-container" style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: "20px" }}>
        {/* Título & Competência (Print 5) */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span className="material-symbols-outlined" style={{ color: "var(--primary)", fontSize: "26px" }}>
                flight_takeoff
              </span>
              <h1 style={{ fontSize: "22px", fontWeight: 800, margin: 0, color: "var(--primary)" }}>
                Viagens &amp; Logística Integrada
              </h1>
            </div>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "var(--on-surface-variant)" }}>
              Central de cotações, passagens, hospedagens e prestação de contas vinculada a Projetos de <strong>{consultorAtivo?.nome}</strong>.
            </p>
          </div>

          {/* Seletor de Competência (Ano e Meses) */}
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

        {/* 6 Cards de Indicadores Operacionais (Idêntico ao Print 5) */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "12px" }}>
          {/* Todas Demandas */}
          <div style={{ padding: "16px", borderRadius: "12px", backgroundColor: "var(--surface-container-lowest)", border: "1px solid var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
            <span style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", color: "var(--on-surface-variant)", letterSpacing: "0.04em" }}>TODAS DEMANDAS</span>
            <div style={{ fontSize: "22px", fontWeight: 800, color: "var(--primary)", marginTop: "4px" }}>{kpis.total}</div>
            <span style={{ fontSize: "10px", color: "var(--on-surface-variant)" }}>Competência ativa</span>
          </div>

          {/* 1. Em Cotação */}
          <div style={{ padding: "16px", borderRadius: "12px", backgroundColor: "var(--surface-container-lowest)", border: "1px solid var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
            <span style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", color: "#d97706", letterSpacing: "0.04em" }}>1. EM COTAÇÃO</span>
            <div style={{ fontSize: "22px", fontWeight: 800, color: "#d97706", marginTop: "4px" }}>{kpis.emCotacao}</div>
            <span style={{ fontSize: "10px", color: "var(--on-surface-variant)" }}>Agência cotando</span>
          </div>

          {/* 2. Para Aprovar */}
          <div style={{ padding: "16px", borderRadius: "12px", backgroundColor: "var(--surface-container-lowest)", border: "1px solid var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
            <span style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", color: "var(--primary)", letterSpacing: "0.04em" }}>2. PARA APROVAR</span>
            <div style={{ fontSize: "22px", fontWeight: 800, color: "var(--primary)", marginTop: "4px" }}>{kpis.paraAprovar}</div>
            <span style={{ fontSize: "10px", color: "var(--on-surface-variant)" }}>Líder de Projeto</span>
          </div>

          {/* 3. Para Comprar */}
          <div style={{ padding: "16px", borderRadius: "12px", backgroundColor: "var(--surface-container-lowest)", border: "1px solid var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
            <span style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", color: "#0284c7", letterSpacing: "0.04em" }}>3. PARA COMPRAR</span>
            <div style={{ fontSize: "22px", fontWeight: 800, color: "#0284c7", marginTop: "4px" }}>{kpis.paraComprar}</div>
            <span style={{ fontSize: "10px", color: "var(--on-surface-variant)" }}>Agência emitindo</span>
          </div>

          {/* 4. Vouchers Enviados */}
          <div style={{ padding: "16px", borderRadius: "12px", backgroundColor: "var(--surface-container-lowest)", border: "1px solid var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
            <span style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", color: "#0d9488", letterSpacing: "0.04em" }}>4. VOUCHERS ENVIADOS</span>
            <div style={{ fontSize: "22px", fontWeight: 800, color: "#0d9488", marginTop: "4px" }}>{kpis.vouchersEnviados}</div>
            <span style={{ fontSize: "10px", color: "var(--on-surface-variant)" }}>Viajante informado</span>
          </div>

          {/* 5. Concluídas */}
          <div style={{ padding: "16px", borderRadius: "12px", backgroundColor: "var(--surface-container-lowest)", border: "1px solid var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
            <span style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", color: "#16a34a", letterSpacing: "0.04em" }}>5. CONCLUÍDAS</span>
            <div style={{ fontSize: "22px", fontWeight: 800, color: "#16a34a", marginTop: "4px" }}>{kpis.concluidas}</div>
            <span style={{ fontSize: "10px", color: "var(--on-surface-variant)" }}>Prestação finalizada</span>
          </div>
        </div>

        {/* Políticas de Viagem em Miniaturas Oficiais */}
        <section
          style={{
            backgroundColor: "#fffbeb",
            border: "1px solid #fde68a",
            borderRadius: "14px",
            padding: "18px 22px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
            <span className="material-symbols-outlined" style={{ color: "#d97706", fontSize: "20px" }}>
              info
            </span>
            <h3 style={{ fontSize: "14px", fontWeight: 700, margin: 0, color: "#92400e" }}>
              Orientações para Prestação de Contas &amp; Políticas de Viagem
            </h3>
          </div>
          <p style={{ margin: "0 0 14px 0", fontSize: "12px", color: "#78350f", lineHeight: 1.5 }}>
            <strong>Atenção viajante:</strong> Verifique com antecedência para qual empresa e projeto você estará viajando. Se a empresa contratante não possuir política própria homologada, a política oficial adotada como regra geral é a da <strong>NNÓS Consultoria</strong>. Clique nas miniaturas abaixo para abrir o PDF oficial em nova guia.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
              gap: "12px",
            }}
          >
            {politicas.map((pol) => (
              <a
                key={pol.nome}
                href={pol.arquivo}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  borderRadius: "10px",
                  overflow: "hidden",
                  border: "1px solid #fef08a",
                  backgroundColor: "#ffffff",
                  textDecoration: "none",
                  transition: "transform 0.15s ease, box-shadow 0.15s ease",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-2px)")}
                onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
              >
                <div style={{ height: "90px", width: "100%", overflow: "hidden", position: "relative" }}>
                  <img
                    src={pol.img}
                    alt={pol.nome}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      top: "6px",
                      right: "6px",
                      backgroundColor: "rgba(0,0,0,0.65)",
                      color: "#ffffff",
                      padding: "2px 6px",
                      borderRadius: "4px",
                      fontSize: "10px",
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      gap: "3px",
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "11px" }}>picture_as_pdf</span>
                    PDF
                  </div>
                </div>
                <div style={{ padding: "8px 12px" }}>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--primary)" }}>
                    {pol.nome}
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--on-surface-variant)", marginTop: "2px" }}>
                    {pol.desc}
                  </div>
                </div>
              </a>
            ))}
          </div>
        </section>

        {/* Barra de Busca e Filtro de Status (Print 5) */}
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
              placeholder="Buscar por Projeto, Atividade, Consultor ou Destino..."
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
            <ModernDropdown
              value={filtroStatus}
              onChange={(val) => setFiltroStatus(String(val))}
              options={[
                { value: "TODOS", label: "Todos os Status" },
                { value: "EM_COTACAO", label: "Em Cotação" },
                { value: "APROVADO", label: "Aprovado / Para Comprar" },
                { value: "VOUCHERS_ENVIADOS", label: "Vouchers Enviados" },
                { value: "CONCLUIDO", label: "Concluído 100%" },
              ]}
              icon="filter_list"
              searchable={false}
              minWidth={200}
            />
          </div>
        </div>

        {/* LISTA EXPANSÍVEL DE VIAGENS (Idêntica ao Print 5) */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {viagensFiltradas.length === 0 ? (
            <div
              style={{
                padding: "40px",
                textAlign: "center",
                backgroundColor: "var(--surface-container-lowest)",
                borderRadius: "12px",
                border: "1px solid var(--border)",
                color: "var(--on-surface-variant)",
                fontSize: "13px",
              }}
            >
              Nenhuma solicitação de viagem encontrada para os filtros selecionados.
            </div>
          ) : (
            viagensFiltradas.map((v: any, idx: number) => {
              const cardId = String(v.id || idx);
              const isExpandido = cardsExpandidos.has(cardId);
              const totalViagem = Number(v.totalViagem || v.custoTotal || v.totalContratado || v.totalAprovado || 0);

              const statusStr = String(v.status || "CONCLUIDO").toUpperCase();
              const isConcluido = statusStr.includes("CONCLU");
              const isVouchers = statusStr.includes("VOUCHER");

              return (
                <div
                  key={cardId}
                  style={{
                    backgroundColor: "var(--surface-container-lowest)",
                    borderRadius: "12px",
                    border: "1px solid var(--border)",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                    overflow: "hidden",
                    transition: "all 0.15s ease",
                  }}
                >
                  {/* Linha Resumida do Accordion (Print 5) */}
                  <div
                    onClick={() => alternarCard(cardId)}
                    style={{
                      padding: "16px 20px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: "14px",
                      cursor: "pointer",
                      backgroundColor: isExpandido ? "var(--surface-container-low)" : "transparent",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: "220px" }}>
                      <span
                        className="material-symbols-outlined"
                        style={{
                          fontSize: "20px",
                          color: "var(--on-surface-variant)",
                          transition: "transform 0.2s ease",
                          transform: isExpandido ? "rotate(180deg)" : "rotate(0deg)",
                        }}
                      >
                        expand_more
                      </span>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <strong style={{ fontSize: "14px", color: "var(--primary)" }}>
                            {v.projeto || "PROJETO"}
                          </strong>
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: 700,
                              padding: "2px 8px",
                              borderRadius: "999px",
                              backgroundColor: isConcluido ? "#dcfce7" : isVouchers ? "rgba(0, 168, 150, 0.12)" : "#fef3c7",
                              color: isConcluido ? "#15803d" : isVouchers ? "#00a896" : "#b45309",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: "12px" }}>
                              {isConcluido ? "check_circle" : "info"}
                            </span>
                            {isConcluido ? "Concluído 100%" : isVouchers ? "Vouchers Enviados" : v.status}
                          </span>
                        </div>
                        <div style={{ fontSize: "12px", color: "var(--on-surface-variant)", marginTop: "2px" }}>
                          {v.atividade || "Execução Técnica"}
                        </div>
                      </div>
                    </div>

                    <div style={{ minWidth: "140px" }}>
                      <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--on-surface-variant)", textTransform: "uppercase" }}>VIAJANTE</span>
                      <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--on-surface)" }}>
                        {v.viajante || v.consultor || consultorAtivo?.nome}
                      </div>
                    </div>

                    <div style={{ minWidth: "140px" }}>
                      <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--on-surface-variant)", textTransform: "uppercase" }}>DESTINO</span>
                      <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--on-surface)" }}>
                        {v.destino || "Localidade da Operação"}
                      </div>
                    </div>

                    <div style={{ minWidth: "150px" }}>
                      <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--on-surface-variant)", textTransform: "uppercase" }}>PERÍODO</span>
                      <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", color: "var(--on-surface)" }}>
                        <span className="material-symbols-outlined" style={{ fontSize: "14px", color: "var(--secondary)" }}>calendar_month</span>
                        <span>{formatarPeriodoBR(v.dataInicial || v.data_inicial, v.dataFinal || v.data_final)}</span>
                      </div>
                    </div>

                    <div style={{ textAlign: "right", minWidth: "120px" }}>
                      <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--on-surface-variant)", textTransform: "uppercase" }}>TOTAL VIAGEM</span>
                      <div style={{ fontSize: "15px", fontWeight: 800, color: "var(--primary)" }}>
                        {brl(totalViagem)}
                      </div>
                    </div>

                    <div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          alternarCard(cardId);
                        }}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "6px 12px",
                          borderRadius: "8px",
                          backgroundColor: "#00152f",
                          color: "#ffffff",
                          fontSize: "12px",
                          fontWeight: 700,
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: "15px" }}>
                          visibility
                        </span>
                        <span>Ver Detalhes</span>
                      </button>
                    </div>
                  </div>

                  {/* Conteúdo Expandido do Accordion (Print 5) */}
                  {isExpandido && (
                    <div
                      style={{
                        padding: "16px 20px 20px 20px",
                        borderTop: "1px solid var(--border)",
                        backgroundColor: "var(--surface-container-lowest)",
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                        gap: "12px",
                      }}
                    >
                      {/* Passagem Aérea */}
                      <div style={{ padding: "12px", borderRadius: "10px", border: "1px solid var(--border)", backgroundColor: "var(--surface-container-low)" }}>
                        <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--on-surface-variant)", textTransform: "uppercase" }}>Passagem Aérea</span>
                        <div style={{ fontSize: "14px", fontWeight: 800, color: "var(--on-surface)", marginTop: "4px" }}>
                          {brl(v.custoAereo || v.aereo || 0)}
                        </div>
                        <span style={{ fontSize: "10px", color: "var(--on-surface-variant)" }}>
                          {(v.custoAereo || v.aereo) ? "Contratado" : "Não aplicável"}
                        </span>
                      </div>

                      {/* Hotel / Estadia */}
                      <div style={{ padding: "12px", borderRadius: "10px", border: "1px solid var(--border)", backgroundColor: "var(--surface-container-low)" }}>
                        <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--on-surface-variant)", textTransform: "uppercase" }}>Hotel / Estadia</span>
                        <div style={{ fontSize: "14px", fontWeight: 800, color: "var(--on-surface)", marginTop: "4px" }}>
                          {brl(v.custoHotel || v.hotel || 0)}
                        </div>
                        <span style={{ fontSize: "10px", color: "var(--on-surface-variant)" }}>
                          {(v.custoHotel || v.hotel) ? "Contratado" : "Sem estadia"}
                        </span>
                      </div>

                      {/* Carro / Traslado */}
                      <div style={{ padding: "12px", borderRadius: "10px", border: "1px solid var(--border)", backgroundColor: "var(--surface-container-low)" }}>
                        <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--on-surface-variant)", textTransform: "uppercase" }}>Carro / Traslado</span>
                        <div style={{ fontSize: "14px", fontWeight: 800, color: "var(--on-surface)", marginTop: "4px" }}>
                          {brl(v.custoCarro || v.carro || 0)}
                        </div>
                        <span style={{ fontSize: "10px", color: "var(--on-surface-variant)" }}>
                          {(v.custoCarro || v.carro) ? "Contratado" : "Não aplicável"}
                        </span>
                      </div>

                      {/* Seguro / Outros */}
                      <div style={{ padding: "12px", borderRadius: "10px", border: "1px solid var(--border)", backgroundColor: "var(--surface-container-low)" }}>
                        <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--on-surface-variant)", textTransform: "uppercase" }}>Seguro / Outros</span>
                        <div style={{ fontSize: "14px", fontWeight: 800, color: "var(--on-surface)", marginTop: "4px" }}>
                          {brl(v.custoOutros || v.seguro || 0)}
                        </div>
                        <span style={{ fontSize: "10px", color: "var(--on-surface-variant)" }}>
                          {(v.custoOutros || v.seguro) ? "Contratado" : "Não aplicável"}
                        </span>
                      </div>

                      {/* Alimentação / Diária */}
                      <div style={{ padding: "12px", borderRadius: "10px", border: "1.5px solid #fed7aa", backgroundColor: "#fffaf5" }}>
                        <span style={{ fontSize: "10px", fontWeight: 700, color: "#c2410c", textTransform: "uppercase" }}>Alimentação / Diária</span>
                        <div style={{ fontSize: "14px", fontWeight: 800, color: "#ea580c", marginTop: "4px" }}>
                          {brl(v.custoAlimentacao || v.alimentacao || v.diaria || 0)}
                        </div>
                        <span style={{ fontSize: "10px", color: "var(--on-surface-variant)" }}>
                          Despesa Financeiro
                        </span>
                      </div>

                      {/* Total Viagem (Destaque Marinho) */}
                      <div style={{ padding: "12px", borderRadius: "10px", backgroundColor: "#00152f", color: "#ffffff", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                        <span style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", color: "#93c5fd" }}>TOTAL VIAGEM</span>
                        <div style={{ fontSize: "15px", fontWeight: 800, color: "#ffffff", marginTop: "4px" }}>
                          {brl(totalViagem)}
                        </div>
                        <span style={{ fontSize: "10px", color: "#93c5fd" }}>
                          100% Sincronizado
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </main>
    </>
  );
}
