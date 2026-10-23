"use client";

import React, { useEffect, useMemo, useState } from "react";
import ConsultorHeader from "@/components/ConsultorHeader";
import ModernDropdown from "@/components/ModernDropdown";
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
      const info = calcularPrazoPrestacaoContas(l.data_final, l.precisa_logistica, v?.custo_5, l.status);
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

          {/* Tabela de Atividades */}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ background: "var(--surface-container-low)" }}>
                  <th style={th}>Projeto &amp; Atividade</th>
                  <th style={th}>Local / Concessionária</th>
                  <th style={th}>Período &amp; Horas</th>
                  <th style={th}>Instrutor / Perfil</th>
                  <th style={{ ...th, textAlign: "right" }}>Consultor</th>
                </tr>
              </thead>
              <tbody>
                {carregando ? (
                  <tr><td colSpan={5} style={{ padding: "36px", textAlign: "center", color: "var(--on-surface-variant)" }}>Carregando agenda...</td></tr>
                ) : filtradas.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: "36px", textAlign: "center", color: "var(--on-surface-variant)" }}>Nenhuma atividade encontrada para a competência e filtros selecionados.</td></tr>
                ) : (
                  filtradas.map((l) => {
                    const cor = corStatus(l.status);
                    const dias = diasEntre(l.data_inicial, l.data_final);
                    const aberto = expandidos.has(l.id);
                    const remoto = (l.modalidade || "").toLowerCase().match(/remot|online|ead|virtual/);
                    const cc = l.projetos?.centros_custo;
                    const v = Array.isArray(l.viagens) ? l.viagens[0] : l.viagens;
                    const precisaLog = l.precisa_logistica === true || l.precisa_logistica === "SIM" || l.precisa_logistica === "true";
                    const infoPrazo = calcularPrazoPrestacaoContas(l.data_final, l.precisa_logistica, v?.custo_5, l.status);

                    const custo1 = Number(v?.custo_1 || 0);
                    const custo2 = Number(v?.custo_2 || 0);
                    const custo3 = Number(v?.custo_3 || 0);
                    const custo4 = Number(v?.custo_4 || 0);
                    const custo5 = Number(v?.custo_5 || 0);
                    const custoTotalViagem = Number(v?.total || (custo1 + custo2 + custo3 + custo4 + custo5));

                    return (
                      <React.Fragment key={l.id}>
                        <tr style={{ borderTop: "1px solid var(--border)" }}>
                          <td style={{ padding: "14px 16px" }}>
                            <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                              <button
                                type="button"
                                onClick={() => alternarItem(l.id)}
                                aria-label="Detalhes"
                                style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--on-surface-variant)", padding: 0 }}
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: "20px", transform: aberto ? "rotate(180deg)" : "none", transition: "transform .15s" }}>
                                  expand_more
                                </span>
                              </button>
                              <div>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                                  <strong style={{ color: "var(--primary)", textTransform: "uppercase" }}>{l.projetos?.nome || "Projeto"}</strong>
                                  <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "999px", background: cor.bg, color: cor.fg, textTransform: "uppercase" }}>
                                    {l.status || "Planejado"}
                                  </span>
                                </div>
                                <div style={{ fontSize: "12px", color: "#b45309", marginTop: "2px" }}>{l.atividade || "—"}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: "14px 16px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#0369a1", background: "#e0f2fe", borderRadius: "6px", padding: "3px" }}>
                                {remoto ? "laptop_mac" : "apartment"}
                              </span>
                              <div>
                                <div style={{ fontWeight: 600, textTransform: "uppercase" }}>{l.local || l.modalidade || "—"}</div>
                                <div style={{ fontSize: "11px", color: "var(--on-surface-variant)" }}>Região {l.regiao || "—"}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: "14px 16px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "var(--on-surface-variant)" }}>calendar_today</span>
                              <div>
                                <div style={{ fontWeight: 600 }}>
                                  {formatarDataBR(l.data_inicial)}{l.data_final && l.data_final !== l.data_inicial ? ` a ${formatarDataBR(l.data_final)}` : ""}
                                </div>
                                <div style={{ fontSize: "11px", color: "var(--on-surface-variant)" }}>
                                  {dias} {dias === 1 ? "dia" : "dias"} · {Number(l.horas || 0)}h
                                </div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: "14px 16px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <span style={{ width: "30px", height: "30px", borderRadius: "50%", background: "#e0f2fe", color: "#0369a1", fontWeight: 700, fontSize: "11px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                                {iniciais(consultorAtivo?.nome || "")}
                              </span>
                              <div>
                                <div style={{ fontWeight: 600 }}>{consultorAtivo?.nome}</div>
                                <div style={{ fontSize: "11px", color: "var(--on-surface-variant)" }}>Perfil {l.perfil || consultorAtivo?.perfil || "SÊNIOR"}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: "14px 16px", textAlign: "right", fontWeight: 700 }}>{brl(l.custo_consultor)}</td>
                        </tr>

                        {/* SUBSEÇÃO EXPANDIDA COM DETALHAMENTO LOGÍSTICO COMPLETO (Print 3 - SEM REPASSE) */}
                        {aberto && (
                          <tr style={{ background: "var(--surface-container-lowest)", borderBottom: "2px solid var(--border)" }}>
                            <td colSpan={5} style={{ padding: "16px 24px 20px 24px" }}>
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

                                  <div style={{ fontSize: "11px", color: "var(--on-surface-variant)" }}>
                                    Precisa Logística?{" "}
                                    <strong style={{ color: precisaLog ? "var(--secondary, #00a896)" : "var(--on-surface-variant)" }}>
                                      {precisaLog ? "SIM" : "NÃO"}
                                    </strong>
                                  </div>
                                </div>

                                {/* 6 Caixas de Custo de Viagem (Print 3) */}
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "10px", marginBottom: "14px" }}>
                                  {/* Caixa 1: Aéreo */}
                                  <div style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--border)", backgroundColor: "#ffffff" }}>
                                    <span style={{ fontSize: "10px", color: "var(--on-surface-variant)", textTransform: "uppercase", display: "block" }}>Passagem Aérea</span>
                                    <div style={{ fontSize: "14px", fontWeight: 800, color: "var(--on-surface)", marginTop: "2px" }}>
                                      {brl(custo1)}
                                    </div>
                                    <span style={{ fontSize: "10px", color: "var(--on-surface-variant)" }}>{custo1 > 0 ? "Contratado" : "Sem aéreo"}</span>
                                  </div>

                                  {/* Caixa 2: Hotel */}
                                  <div style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--border)", backgroundColor: "#ffffff" }}>
                                    <span style={{ fontSize: "10px", color: "var(--on-surface-variant)", textTransform: "uppercase", display: "block" }}>Hotel / Estadia</span>
                                    <div style={{ fontSize: "14px", fontWeight: 800, color: "var(--on-surface)", marginTop: "2px" }}>
                                      {brl(custo2)}
                                    </div>
                                    <span style={{ fontSize: "10px", color: "var(--on-surface-variant)" }}>{custo2 > 0 ? "Contratado" : "Sem diárias"}</span>
                                  </div>

                                  {/* Caixa 3: Carro */}
                                  <div style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--border)", backgroundColor: "#ffffff" }}>
                                    <span style={{ fontSize: "10px", color: "var(--on-surface-variant)", textTransform: "uppercase", display: "block" }}>Carro / Traslado</span>
                                    <div style={{ fontSize: "14px", fontWeight: 800, color: "var(--on-surface)", marginTop: "2px" }}>
                                      {brl(custo3)}
                                    </div>
                                    <span style={{ fontSize: "10px", color: "var(--on-surface-variant)" }}>{custo3 > 0 ? "Contratado" : "Sem traslado"}</span>
                                  </div>

                                  {/* Caixa 4: Seguro */}
                                  <div style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--border)", backgroundColor: "#ffffff" }}>
                                    <span style={{ fontSize: "10px", color: "var(--on-surface-variant)", textTransform: "uppercase", display: "block" }}>Seguro / Outros</span>
                                    <div style={{ fontSize: "14px", fontWeight: 800, color: "var(--on-surface)", marginTop: "2px" }}>
                                      {brl(custo4)}
                                    </div>
                                    <span style={{ fontSize: "10px", color: "var(--on-surface-variant)" }}>{custo4 > 0 ? "Apólice internacional" : "Não aplicável"}</span>
                                  </div>

                                  {/* Caixa 5: Alimentação / Diária */}
                                  <div style={{ padding: "10px 12px", borderRadius: "8px", border: "1.5px solid #fed7aa", backgroundColor: "#fffaf5" }}>
                                    <span style={{ fontSize: "10px", color: "#c2410c", textTransform: "uppercase", display: "block", fontWeight: 700 }}>Alimentação / Diária</span>
                                    <div style={{ fontSize: "14px", fontWeight: 800, color: "#ea580c", marginTop: "2px" }}>
                                      {brl(custo5)}
                                    </div>
                                    <span style={{ fontSize: "10px", color: "var(--on-surface-variant)" }}>Despesa Consultor</span>
                                  </div>

                                  {/* Caixa 6: Total Viagem (Destaque Marinho) */}
                                  <div style={{ padding: "10px 12px", borderRadius: "8px", backgroundColor: "#00152f", color: "#ffffff", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                                    <span style={{ fontSize: "10px", textTransform: "uppercase", color: "#93c5fd", fontWeight: 700 }}>TOTAL VIAGEM</span>
                                    <div style={{ fontSize: "14px", fontWeight: 800, color: "#ffffff", marginTop: "2px" }}>
                                      {brl(custoTotalViagem)}
                                    </div>
                                    <span style={{ fontSize: "10px", color: "#93c5fd" }}>Conciliado 100%</span>
                                  </div>
                                </div>

                                {/* Rodapé do Detalhamento: Prazo Prestação de Contas & Observações Agência */}
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    flexWrap: "wrap",
                                    gap: "14px",
                                    paddingTop: "12px",
                                    borderTop: "1px solid var(--border)",
                                    fontSize: "12px",
                                  }}
                                >
                                  {/* Prazo Prestação de Contas */}
                                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                    <div
                                      style={{
                                        width: "30px",
                                        height: "30px",
                                        borderRadius: "50%",
                                        backgroundColor: infoPrazo.corBg,
                                        color: infoPrazo.corTexto,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                      }}
                                    >
                                      <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                                        {infoPrazo.icone}
                                      </span>
                                    </div>
                                    <div>
                                      <span style={{ fontSize: "10px", color: "var(--on-surface-variant)", display: "block" }}>
                                        {infoPrazo.label}
                                      </span>
                                      <strong style={{ color: infoPrazo.corTexto, fontSize: "11px" }}>
                                        {infoPrazo.badgeTexto}
                                      </strong>
                                    </div>
                                  </div>

                                  {/* Observações Agência de Viagens */}
                                  <div style={{ flex: 1, minWidth: "220px", display: "flex", flexDirection: "column" }}>
                                    <span style={{ fontSize: "10px", color: "var(--on-surface-variant)" }}>
                                      Observações Agência de Viagens
                                    </span>
                                    <span style={{ fontSize: "11px", color: "var(--on-surface)", fontStyle: "italic" }}>
                                      {v?.observacao_agencia || "Nenhuma instrução adicional registrada."}
                                    </span>
                                  </div>

                                  {/* Dados Contratuais Complementares */}
                                  <div style={{ fontSize: "11px", color: "var(--on-surface-variant)", textAlign: "right" }}>
                                    <span>CC: <strong>{cc?.codigo || "—"}</strong> • Contrato: <strong>{cc?.contrato || "—"}</strong></span>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px", borderTop: "1px solid var(--border)", fontSize: "12px", color: "var(--on-surface-variant)" }}>
            <span>Exibindo <strong>{filtradas.length}</strong> de <strong>{todas.length}</strong> atividades cadastradas</span>
            <span>Total Consultor: <strong style={{ color: "var(--on-surface)" }}>{brl(totalConsultor)}</strong></span>
          </div>
        </section>
      </main>
    </>
  );
}
