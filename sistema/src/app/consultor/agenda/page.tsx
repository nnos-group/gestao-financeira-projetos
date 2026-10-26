"use client";

import React, { useEffect, useMemo, useState } from "react";
import ConsultorHeader from "@/components/ConsultorHeader";
import ModernDropdown from "@/components/ModernDropdown";
import AgendaCalendarioView from "@/components/consultor/AgendaCalendarioView";
import BloquearAgendaModal from "@/components/consultor/BloquearAgendaModal";
import { AgendaBloqueio } from "@/lib/agenda-bloqueios";
import { useConsultor } from "@/contexts/ConsultorContext";
import { formatarDataBR, formatarPeriodoBR, calcularPrazoPrestacaoContas } from "@/lib/date-utils";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MESES_NOMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const brl = (v: number | null | undefined) =>
  (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const iniciais = (nome: string) =>
  (nome || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

function diasEntre(ini?: string | null, fim?: string | null): number {
  if (!ini) return 0;
  const a = new Date(`${ini.slice(0, 10)}T12:00:00`);
  const b = new Date(`${(fim || ini).slice(0, 10)}T12:00:00`);
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return 0;
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86400000) + 1);
}

function corStatus(status: string) {
  const s = (status || "").toUpperCase();
  if (s.includes("CANCEL")) return { bg: "#fee2e2", fg: "#b91c1c" };
  if (s.includes("CONFIRM") || s.includes("REALIZ") || s.includes("CONCLU")) return { bg: "#dcfce7", fg: "#15803d" };
  return { bg: "#e0f2fe", fg: "#0369a1" };
}

export default function ConsultorAgendaPage() {
  const { consultorAtivo, dadosConsultor, carregando } = useConsultor();
  const todas: any[] = dadosConsultor?.lancamentos || [];

  const hoje = new Date();
  const anosDisponiveis = useMemo(() => {
    const set = new Set<number>();
    todas.forEach((l) => {
      const a = Number(String(l.competencia || l.data_inicial || "").slice(0, 4));
      if (a >= 2020) set.add(a);
    });
    if (set.size === 0) set.add(hoje.getFullYear());
    return Array.from(set).sort((a, b) => a - b);
  }, [todas]);

  const [ano, setAno] = useState<number>(hoje.getFullYear());
  const [mes, setMes] = useState<number>(hoje.getMonth() + 1); // 0 = todos
  const [busca, setBusca] = useState("");
  const [cidade, setCidade] = useState("todas");
  const [modalidade, setModalidade] = useState("todas");
  const [status, setStatus] = useState("todos");
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  // Visualização e Bloqueios de Agenda
  const [modoVisualizacao, setModoVisualizacao] = useState<"lista" | "calendario">("lista");
  const [modalBloqueioAberto, setModalBloqueioAberto] = useState(false);
  const [bloqueios, setBloqueios] = useState<AgendaBloqueio[]>([]);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const carregarBloqueios = async () => {
    if (!consultorAtivo?.nome) return;
    try {
      const res = await fetch(`/api/consultor/bloqueios?consultor=${encodeURIComponent(consultorAtivo.nome)}`);
      const data = await res.json();
      if (data.ok) {
        setBloqueios(data.bloqueios || []);
      }
    } catch (err) {
      console.error("Erro ao carregar bloqueios de agenda:", err);
    }
  };

  useEffect(() => {
    carregarBloqueios();
  }, [consultorAtivo?.nome]);

  useEffect(() => {
    if (!anosDisponiveis.includes(ano)) setAno(anosDisponiveis[anosDisponiveis.length - 1]);
  }, [anosDisponiveis, ano]);

  const doAno = todas.filter((l) => String(l.competencia || l.data_inicial || "").startsWith(String(ano)));
  const daCompetencia = mes === 0 ? doAno : doAno.filter((l) => Number(String(l.competencia || l.data_inicial).slice(5, 7)) === mes);

  const opcoes = (campo: (l: any) => string) =>
    Array.from(new Set(daCompetencia.map(campo).filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR"));

  const cidades = opcoes((l) => (l.local || "").trim());
  const modalidades = opcoes((l) => (l.modalidade || "").trim());
  const statusLista = opcoes((l) => (l.status || "").trim().toUpperCase());

  const filtradas = daCompetencia.filter((l) => {
    if (cidade !== "todas" && (l.local || "").trim() !== cidade) return false;
    if (modalidade !== "todas" && (l.modalidade || "").trim() !== modalidade) return false;
    if (status !== "todos" && (l.status || "").trim().toUpperCase() !== status) return false;
    if (busca.trim()) {
      const q = busca.toLowerCase();
      const alvo = [
        l.projetos?.nome, l.atividade, l.local, l.regiao, l.modalidade,
        l.projetos?.centros_custo?.codigo, l.projetos?.centros_custo?.contrato,
      ].join(" ").toLowerCase();
      if (!alvo.includes(q)) return false;
    }
    return true;
  });

  const totalConsultor = filtradas
    .filter((l) => !(l.status || "").toUpperCase().includes("CANCEL"))
    .reduce((s, l) => s + Number(l.custo_consultor || 0), 0);
  const totalHoras = filtradas.reduce((s, l) => s + Number(l.horas || 0), 0);
  const canceladas = filtradas.filter((l) => (l.status || "").toUpperCase().includes("CANCEL")).length;

  // Prestação de contas em atraso
  const prestacoesEmAtraso = useMemo(() => {
    return filtradas.filter((l) => {
      const v = Array.isArray(l.viagens) ? l.viagens[0] : l.viagens;
      const info = calcularPrazoPrestacaoContas(l.precisa_logistica, l.data_final, v?.custo_5, l.status);
      return info.status === "EM_ATRASO";
    }).length;
  }, [filtradas]);

  const alternarItem = (id: string) => {
    setExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandirTodos = () => {
    setExpandidos(new Set(filtradas.map((l) => l.id)));
  };

  const recolherTodos = () => {
    setExpandidos(new Set());
  };

  const limpar = () => {
    setBusca("");
    setCidade("todas");
    setModalidade("todas");
    setStatus("todos");
  };

  const th: React.CSSProperties = {
    padding: "12px 16px",
    fontSize: "11px",
    fontWeight: 700,
    color: "var(--on-surface-variant)",
    textTransform: "uppercase",
    letterSpacing: "0.03em",
    textAlign: "left",
  };

  return (
    <>
      <ConsultorHeader tituloPagina="Minha Agenda" />

      <main className="content-container" style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: "18px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
          <h1 className="page-title" style={{ margin: 0 }}>
            <span>Minha Agenda</span>
            <span className="badge-cycle">
              Ciclo {ano} · {mes === 0 ? "Ano Todo (Consolidado)" : MESES_NOMES[mes - 1]}
            </span>
          </h1>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            {/* Seletor de Modo: Lista vs Calendário */}
            <div
              style={{
                display: "inline-flex",
                background: "var(--surface-container-high)",
                borderRadius: "10px",
                padding: "3px",
                border: "1px solid var(--border)",
              }}
            >
              <button
                type="button"
                onClick={() => setModoVisualizacao("lista")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 14px",
                  borderRadius: "8px",
                  border: "none",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                  backgroundColor: modoVisualizacao === "lista" ? "var(--primary)" : "transparent",
                  color: modoVisualizacao === "lista" ? "#fff" : "var(--on-surface-variant)",
                  transition: "all 0.15s ease",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>view_list</span>
                Lista
              </button>
              <button
                type="button"
                onClick={() => setModoVisualizacao("calendario")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 14px",
                  borderRadius: "8px",
                  border: "none",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                  backgroundColor: modoVisualizacao === "calendario" ? "var(--primary)" : "transparent",
                  color: modoVisualizacao === "calendario" ? "#fff" : "var(--on-surface-variant)",
                  transition: "all 0.15s ease",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>calendar_month</span>
                Calendário
              </button>
            </div>

            {/* Botão Bloquear Agenda */}
            <button
              type="button"
              onClick={() => setModalBloqueioAberto(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "7px 16px",
                borderRadius: "10px",
                border: "1px solid #f59e0b",
                backgroundColor: "#fffbeb",
                color: "#b45309",
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                transition: "all 0.15s ease",
              }}
              title="Bloquear período para Momento OFF, Férias ou outra atividade"
            >
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>event_busy</span>
              Bloquear Agenda {bloqueios.length > 0 && `(${bloqueios.length})`}
            </button>
          </div>
        </div>

        {/* 5 Cards de KPIs Operacionais (com Prestações em Atraso) */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "14px",
          }}
          aria-label="Indicadores do Consultor"
        >
          {/* Card 1: A Receber */}
          <div className="kpi-card">
            <div className="kpi-content">
              <span className="kpi-label">A RECEBER (CONSULTOR)</span>
              <div className="kpi-value-row">
                <span className="kpi-value medium" style={{ color: "#059669" }}>{brl(totalConsultor)}</span>
              </div>
            </div>
            <div className="kpi-icon-box success-bg">
              <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>payments</span>
            </div>
          </div>

          {/* Card 2: Horas */}
          <div className="kpi-card">
            <div className="kpi-content">
              <span className="kpi-label">HORAS NA COMPETÊNCIA</span>
              <div className="kpi-value-row">
                <span className="kpi-value medium">{totalHoras.toFixed(0)} h</span>
              </div>
            </div>
            <div className="kpi-icon-box">
              <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>schedule</span>
            </div>
          </div>

          {/* Card 3: Atividades */}
          <div className="kpi-card">
            <div className="kpi-content">
              <span className="kpi-label">ATIVIDADES</span>
              <div className="kpi-value-row">
                <span className="kpi-value medium">{filtradas.length}</span>
              </div>
            </div>
            <div className="kpi-icon-box secondary-bg">
              <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>event_note</span>
            </div>
          </div>

          {/* Card 4: Prestações de Contas em Atraso (Print 2 & 3) */}
          <div className="kpi-card" style={{ borderColor: prestacoesEmAtraso > 0 ? "#fca5a5" : "var(--border)" }}>
            <div className="kpi-content">
              <span className="kpi-label" style={{ color: prestacoesEmAtraso > 0 ? "#dc2626" : "var(--on-surface-variant)" }}>
                PRESTAÇÕES EM ATRASO
              </span>
              <div className="kpi-value-row">
                <span className="kpi-value medium" style={{ color: prestacoesEmAtraso > 0 ? "#dc2626" : "var(--primary)" }}>
                  {prestacoesEmAtraso} {prestacoesEmAtraso === 1 ? "viagem" : "viagens"}
                </span>
              </div>
            </div>
            <div
              className="kpi-icon-box"
              style={{
                backgroundColor: prestacoesEmAtraso > 0 ? "#fee2e2" : "var(--surface-container)",
                color: prestacoesEmAtraso > 0 ? "#dc2626" : "var(--on-surface-variant)",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>
                {prestacoesEmAtraso > 0 ? "warning" : "task_alt"}
              </span>
            </div>
          </div>

          {/* Card 5: Canceladas */}
          <div className="kpi-card">
            <div className="kpi-content">
              <span className="kpi-label">CANCELADAS</span>
              <div className="kpi-value-row">
                <span className="kpi-value medium" style={{ color: "#b91c1c" }}>{canceladas} turmas</span>
              </div>
            </div>
            <div className="kpi-icon-box cancel-bg">
              <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>event_busy</span>
            </div>
          </div>
        </section>

        {modoVisualizacao === "calendario" ? (
          <AgendaCalendarioView
            atividades={todas}
            bloqueios={bloqueios}
            anoInicial={ano}
            mesInicial={mes === 0 ? 1 : mes}
          />
        ) : (
          <section style={{ backgroundColor: "var(--surface-container-lowest)", border: "1px solid var(--border)", borderRadius: "14px", overflow: "hidden" }}>
          {/* Competência: Ano e Chips de Meses */}
          <nav className="month-strip" aria-label="Seleção de Competência" style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "var(--primary)" }}>calendar_month</span>
            <span className="month-label" style={{ fontWeight: 700, margin: 0 }}>COMPETÊNCIA:</span>
            <ModernDropdown
              value={ano}
              onChange={(v) => setAno(Number(v))}
              options={anosDisponiveis.map((a) => ({ value: a, label: String(a) }))}
              minWidth={110}
            />
            <div className="month-chips" style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginLeft: "8px" }}>
              <button
                type="button"
                onClick={() => setMes(0)}
                className={`chip-month${mes === 0 ? " active" : ""}`}
                style={{ padding: "5px 12px", borderRadius: "999px", fontSize: "12px", fontWeight: 700, border: "none", cursor: "pointer", background: mes === 0 ? "var(--primary)" : "transparent", color: mes === 0 ? "#fff" : "var(--on-surface-variant)" }}
              >
                Todos
              </button>
              {MESES.map((nome, idx) => {
                const num = idx + 1;
                const ativo = mes === num;
                return (
                  <button
                    key={nome}
                    type="button"
                    onClick={() => setMes(num)}
                    className={`chip-month${ativo ? " active" : ""}`}
                    style={{ padding: "5px 12px", borderRadius: "999px", fontSize: "12px", fontWeight: 700, border: "none", cursor: "pointer", background: ativo ? "var(--primary)" : "transparent", color: ativo ? "#fff" : "var(--on-surface-variant)" }}
                  >
                    {nome}
                  </button>
                );
              })}
            </div>
          </nav>

          {/* Barra de Filtros com Atalhos de Expandir/Recolher (Print 3) */}
          <div style={{ display: "flex", gap: "10px", padding: "12px 16px", alignItems: "center", flexWrap: "wrap", borderBottom: "1px solid var(--border)", backgroundColor: "var(--surface-container-low)" }}>
            <div style={{ flex: 1, minWidth: "240px", display: "flex", alignItems: "center", gap: "8px", background: "var(--surface-container-lowest)", border: "1px solid var(--border)", borderRadius: "8px", padding: "6px 12px" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "var(--on-surface-variant)" }}>search</span>
              <input
                type="text"
                placeholder="Filtrar por CC, Projeto, Atividade, Concessionária ou Cidade..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                style={{ border: "none", outline: "none", background: "transparent", fontSize: "12px", width: "100%", color: "var(--on-surface)" }}
              />
            </div>

            <ModernDropdown value={cidade} onChange={(v) => setCidade(String(v))} options={[{ value: "todas", label: "Todas as Cidades" }, ...cidades.map((c) => ({ value: c, label: c }))]} />
            <ModernDropdown value={modalidade} onChange={(v) => setModalidade(String(v))} options={[{ value: "todas", label: "Modalidade" }, ...modalidades.map((c) => ({ value: c, label: c }))]} />
            <ModernDropdown value={status} onChange={(v) => setStatus(String(v))} options={[{ value: "todos", label: "Status da Atividade" }, ...statusLista.map((c) => ({ value: c, label: c }))]} />

            {/* Botões de Expandir e Recolher Todos (Print 3) */}
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <button
                type="button"
                onClick={expandirTodos}
                title="Expandir todas as atividades"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "34px",
                  height: "34px",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  backgroundColor: "var(--surface-container-lowest)",
                  color: "var(--primary)",
                  cursor: "pointer",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>unfold_more</span>
              </button>

              <button
                type="button"
                onClick={recolherTodos}
                title="Recolher todas as atividades"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "34px",
                  height: "34px",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  backgroundColor: "var(--surface-container-lowest)",
                  color: "var(--primary)",
                  cursor: "pointer",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>unfold_less</span>
              </button>
            </div>

            <button type="button" onClick={limpar} className="btn-secondary" style={{ padding: "8px 14px", fontSize: "12px" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>restart_alt</span>
              <span>Limpar</span>
            </button>
          </div>

          {/* Guia de Colunas Oficial (Idêntico ao Print 4) */}
          <div
            className="table-labels-guide"
            style={{
              display: "grid",
              gridTemplateColumns: "3.2fr 1.8fr 1.8fr 1.8fr 1.2fr",
              padding: "10px 20px",
              gap: "14px",
              alignItems: "center",
              fontSize: "11px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              color: "var(--on-surface-variant)",
            }}
          >
            <div>Projeto &amp; Atividade</div>
            <div>Local / Concessionária</div>
            <div>Período &amp; Horas</div>
            <div>Instrutor / Perfil</div>
            <div style={{ textAlign: "right" }}>Consultor</div>
          </div>

          {/* Pilha de Cards Suspensos Flutuantes (Idêntico ao Print 4) */}
          <div className="cards-stack" style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "4px 0" }}>
            {carregando ? (
              <div style={{ padding: "48px 24px", textAlign: "center", backgroundColor: "var(--surface-container-lowest)", borderRadius: "12px", border: "1px dashed var(--border)", color: "var(--on-surface-variant)" }}>
                Carregando agenda...
              </div>
            ) : filtradas.length === 0 ? (
              <div
                style={{
                  padding: "48px 24px",
                  textAlign: "center",
                  backgroundColor: "var(--surface-container-lowest)",
                  borderRadius: "12px",
                  border: "1px dashed var(--border)",
                  color: "var(--on-surface-variant)",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "36px", color: "var(--outline)", marginBottom: "8px" }}>
                  search_off
                </span>
                <p style={{ fontWeight: 600, fontSize: "13px", margin: 0 }}>Nenhuma atividade encontrada para a competência e filtros selecionados.</p>
              </div>
            ) : (
              filtradas.map((l) => {
                const cor = corStatus(l.status);
                const dias = diasEntre(l.data_inicial, l.data_final);
                const aberto = expandidos.has(l.id);
                const remoto = (l.modalidade || "").toLowerCase().match(/remot|online|ead|virtual/);
                const cc = l.projetos?.centros_custo;
                const v = Array.isArray(l.viagens) ? l.viagens[0] : l.viagens;
                const infoPrazo = calcularPrazoPrestacaoContas(l.precisa_logistica, l.data_final, v?.custo_5, l.status);

                const custo1 = Number(v?.custo_1 || 0);
                const custo2 = Number(v?.custo_2 || 0);
                const custo3 = Number(v?.custo_3 || 0);
                const custo4 = Number(v?.custo_4 || 0);
                const custo5 = Number(v?.custo_5 || 0);
                const custoTotalViagem = Number(v?.total || (custo1 + custo2 + custo3 + custo4 + custo5));

                return (
                  <div
                    key={l.id}
                    className={`floating-card-row ${aberto ? "expanded" : ""}`}
                    style={{
                      backgroundColor: "var(--surface-container-lowest)",
                      borderRadius: "12px",
                      border: aberto ? "1.5px solid var(--primary-container, #bae6fd)" : "1px solid var(--border)",
                      boxShadow: aberto ? "0 4px 14px rgba(0,0,0,0.06)" : "0 1px 3px rgba(0,0,0,0.03)",
                      transition: "all 0.18s ease",
                      overflow: "hidden",
                    }}
                  >
                    {/* Linha Principal da Atividade (Card Main Bar) */}
                    <div
                      className="card-main-bar"
                      style={{
                        padding: "14px 20px",
                        display: "grid",
                        gridTemplateColumns: "3.2fr 1.8fr 1.8fr 1.8fr 1.2fr",
                        alignItems: "center",
                        gap: "14px",
                      }}
                    >
                      {/* Col 1: Toggle + Projeto & Atividade + Status */}
                      <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
                        <button
                          type="button"
                          onClick={() => alternarItem(l.id)}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: "28px",
                            height: "28px",
                            borderRadius: "6px",
                            border: "none",
                            backgroundColor: aberto ? "var(--primary)" : "#e0f2fe",
                            color: aberto ? "#ffffff" : "#0369a1",
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                            flexShrink: 0,
                          }}
                          title={aberto ? "Recolher detalhes logísticos" : "Expandir detalhes logísticos"}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                            {aberto ? "expand_less" : "expand_more"}
                          </span>
                        </button>
                        <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                            <strong style={{ color: "var(--primary)", textTransform: "uppercase", fontSize: "13px" }}>
                              {l.projetos?.nome || "Projeto"}
                            </strong>
                            {l.status && (
                              <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 7px", borderRadius: "4px", background: cor.bg, color: cor.fg, textTransform: "uppercase" }}>
                                {l.status}
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: "12px", color: "#b45309", marginTop: "2px", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={l.atividade}>
                            {l.atividade || "—"}
                          </span>
                        </div>
                      </div>

                      {/* Col 2: Local / Concessionária */}
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div
                          style={{
                            width: "32px",
                            height: "32px",
                            borderRadius: "8px",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: remoto ? "rgba(14, 165, 233, 0.12)" : "rgba(15, 42, 74, 0.08)",
                            color: remoto ? "#0284c7" : "var(--primary)",
                            flexShrink: 0,
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                            {remoto ? "laptop_chromebook" : "apartment"}
                          </span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
                          <strong style={{ fontSize: "12px", color: "var(--on-surface)", textTransform: "uppercase", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={l.local || "—"}>
                            {l.local || (remoto ? "Virtual / Online" : "Presencial")}
                          </strong>
                          <span style={{ fontSize: "11px", color: "var(--on-surface-variant)" }}>Região {l.regiao || "BRA"}</span>
                        </div>
                      </div>

                      {/* Col 3: Período e Duração */}
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div
                          style={{
                            width: "32px",
                            height: "32px",
                            borderRadius: "8px",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: "var(--surface-container)",
                            color: "var(--on-surface-variant)",
                            flexShrink: 0,
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                            date_range
                          </span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <strong style={{ fontSize: "12px", color: "var(--on-surface)", whiteSpace: "nowrap" }}>
                            {formatarDataBR(l.data_inicial)}{l.data_final && l.data_final !== l.data_inicial ? ` a ${formatarDataBR(l.data_final)}` : ""}
                          </strong>
                          <span style={{ fontSize: "11px", color: "var(--on-surface-variant)" }}>
                            {dias} {dias === 1 ? "dia" : "dias"} · {Number(l.horas || 0)}h
                          </span>
                        </div>
                      </div>

                      {/* Col 4: Instrutor / Perfil */}
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div
                          style={{
                            width: "30px",
                            height: "30px",
                            borderRadius: "50%",
                            backgroundColor: "#e0f2fe",
                            color: "#0369a1",
                            fontWeight: 700,
                            fontSize: "11px",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          {iniciais(consultorAtivo?.nome || "")}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
                          <strong style={{ fontSize: "12px", color: "var(--on-surface)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {consultorAtivo?.nome}
                          </strong>
                          <span style={{ fontSize: "11px", color: "var(--on-surface-variant)" }}>
                            Perfil {l.perfil || consultorAtivo?.perfil || "SÊNIOR"}
                          </span>
                        </div>
                      </div>

                      {/* Col 5: Consultor (Valor a Receber) */}
                      <div style={{ textAlign: "right" }}>
                        <strong style={{ fontSize: "13px", color: "var(--on-surface)" }}>
                          {brl(l.custo_consultor)}
                        </strong>
                      </div>
                    </div>

                    {/* Subpainel Expandido de Detalhamento Logístico (Print 4) */}
                    {aberto && (
                      <div style={{ padding: "0 20px 20px 20px", backgroundColor: "var(--surface-container-lowest)" }}>
                        <div style={{ border: "1px solid var(--border)", borderRadius: "12px", padding: "16px 20px", backgroundColor: "#f8fafc" }}>
                          {/* Header do Detalhamento Logístico */}
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "8px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <span className="material-symbols-outlined" style={{ color: "var(--secondary, #00a896)", fontSize: "18px" }}>
                                flight
                              </span>
                              <strong style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--primary)" }}>
                                Detalhamento Logístico &amp; Despesas de Viagem
                              </strong>
                            </div>

                            {/* Card de Prazo de Prestação de Contas Conforme Regra de Negócio Oficial */}
                            <div
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                                padding: "4px 10px",
                                borderRadius: "8px",
                                backgroundColor: infoPrazo.corBg,
                                color: infoPrazo.corTexto,
                                border: `1px solid ${infoPrazo.corTexto}33`,
                                fontSize: "11px",
                                fontWeight: 700,
                              }}
                              title="Prazo oficial: até 5 dias após o término da viagem para prestação de contas"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
                                {infoPrazo.icone}
                              </span>
                              <span>Prazo Prestação: {infoPrazo.badgeTexto}</span>
                              {infoPrazo.status === "EM_ATRASO" && (
                                <span style={{ fontWeight: 800 }}>({infoPrazo.diasAtraso}d de atraso)</span>
                              )}
                              {infoPrazo.status === "DENTRO_DO_PRAZO" && infoPrazo.diasRestantes !== undefined && infoPrazo.diasRestantes > 0 && (
                                <span style={{ fontWeight: 600 }}>({infoPrazo.diasRestantes}d restantes)</span>
                              )}
                            </div>
                          </div>

                          {/* 4 Cards de Logística (Passagem, Hotel, Carro, Alimentação/Diária) + Total */}
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "10px", marginBottom: "12px" }}>
                            <div style={{ padding: "10px", borderRadius: "8px", backgroundColor: "#ffffff", border: "1px solid var(--border)" }}>
                              <span style={{ fontSize: "10px", color: "var(--on-surface-variant)", textTransform: "uppercase", fontWeight: 700 }}>Passagem Aérea</span>
                              <div style={{ fontSize: "13px", fontWeight: 800, color: "var(--primary)", marginTop: "2px" }}>{brl(custo1)}</div>
                              <span style={{ fontSize: "9px", color: "var(--on-surface-variant)" }}>Contratado</span>
                            </div>

                            <div style={{ padding: "10px", borderRadius: "8px", backgroundColor: "#ffffff", border: "1px solid var(--border)" }}>
                              <span style={{ fontSize: "10px", color: "var(--on-surface-variant)", textTransform: "uppercase", fontWeight: 700 }}>Hotel / Estadia</span>
                              <div style={{ fontSize: "13px", fontWeight: 800, color: "var(--primary)", marginTop: "2px" }}>{brl(custo2)}</div>
                              <span style={{ fontSize: "9px", color: "var(--on-surface-variant)" }}>Contratado</span>
                            </div>

                            <div style={{ padding: "10px", borderRadius: "8px", backgroundColor: "#ffffff", border: "1px solid var(--border)" }}>
                              <span style={{ fontSize: "10px", color: "var(--on-surface-variant)", textTransform: "uppercase", fontWeight: 700 }}>Carro / Traslado</span>
                              <div style={{ fontSize: "13px", fontWeight: 800, color: "var(--primary)", marginTop: "2px" }}>{brl(custo3)}</div>
                              <span style={{ fontSize: "9px", color: "var(--on-surface-variant)" }}>Sem traslado</span>
                            </div>

                            <div style={{ padding: "10px", borderRadius: "8px", backgroundColor: "#ffffff", border: "1px solid var(--border)" }}>
                              <span style={{ fontSize: "10px", color: "var(--on-surface-variant)", textTransform: "uppercase", fontWeight: 700 }}>Seguro / Outros</span>
                              <div style={{ fontSize: "13px", fontWeight: 800, color: "var(--primary)", marginTop: "2px" }}>{brl(custo4)}</div>
                              <span style={{ fontSize: "9px", color: "var(--on-surface-variant)" }}>Não aplicável</span>
                            </div>

                            <div style={{ padding: "10px", borderRadius: "8px", backgroundColor: "#fffbeb", border: "1px solid #fde68a" }}>
                              <span style={{ fontSize: "10px", color: "#b45309", textTransform: "uppercase", fontWeight: 700 }}>Alimentação / Diária</span>
                              <div style={{ fontSize: "13px", fontWeight: 800, color: "#d97706", marginTop: "2px" }}>{brl(custo5)}</div>
                              <span style={{ fontSize: "9px", color: "#b45309" }}>Despesa Financeiro</span>
                            </div>

                            <div style={{ padding: "10px", borderRadius: "8px", backgroundColor: "#00152f", color: "#ffffff", border: "1px solid #00152f" }}>
                              <span style={{ fontSize: "10px", color: "#94a3b8", textTransform: "uppercase", fontWeight: 700 }}>Total Viagem</span>
                              <div style={{ fontSize: "13px", fontWeight: 800, color: "#38bdf8", marginTop: "2px" }}>{brl(custoTotalViagem)}</div>
                              <span style={{ fontSize: "9px", color: "#94a3b8" }}>100% Sincronizado</span>
                            </div>
                          </div>

                          {/* Observações da Agência & Informações Contratuais */}
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", paddingTop: "8px", borderTop: "1px dashed var(--border)" }}>
                            <div style={{ flex: 1, minWidth: "220px", display: "flex", flexDirection: "column" }}>
                              <span style={{ fontSize: "10px", color: "var(--on-surface-variant)" }}>
                                Observações Agência de Viagens
                              </span>
                              <span style={{ fontSize: "11px", color: "var(--on-surface)", fontStyle: "italic" }}>
                                {v?.observacao_agencia || "Nenhuma instrução adicional registrada."}
                              </span>
                            </div>

                            <div style={{ fontSize: "11px", color: "var(--on-surface-variant)", textAlign: "right" }}>
                              <span>CC: <strong>{cc?.codigo || "—"}</strong> • Contrato: <strong>{cc?.contrato || "—"}</strong></span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px", borderTop: "1px solid var(--border)", fontSize: "12px", color: "var(--on-surface-variant)" }}>
            <span>Exibindo <strong>{filtradas.length}</strong> de <strong>{todas.length}</strong> atividades cadastradas</span>
            <span>Total Consultor: <strong style={{ color: "var(--on-surface)" }}>{brl(totalConsultor)}</strong></span>
          </div>
        </section>
        )}

        {/* Modal de Bloqueio de Agenda */}
        {modalBloqueioAberto && (
          <BloquearAgendaModal
            consultorNome={consultorAtivo?.nome || ""}
            consultorId={consultorAtivo?.id}
            bloqueios={bloqueios}
            onClose={() => setModalBloqueioAberto(false)}
            onAtualizar={carregarBloqueios}
            showToast={showToast}
          />
        )}

        {/* Toast Notificação */}
        {toastMsg && (
          <div
            style={{
              position: "fixed",
              bottom: "24px",
              right: "24px",
              zIndex: 9999,
              backgroundColor: "#1e293b",
              color: "#ffffff",
              padding: "12px 20px",
              borderRadius: "10px",
              boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
              fontSize: "13px",
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <span>{toastMsg}</span>
          </div>
        )}
      </main>
    </>
  );
}
