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

const statusClasse = (status: string | null | undefined): string => {
  const s = (status || "").toUpperCase();
  if (s.includes("REALIZ")) return "realizado";
  if (s.includes("CONFIRM")) return "confirmado";
  if (s.includes("CANCEL")) return "cancelado";
  if (s.includes("PREV")) return "previsto";
  return "confirmado";
};

const capitalizarAtividade = (str: string | null | undefined): string => {
  if (!str) return "Atividade Operacional";
  const minusculas = new Set([
    "de", "da", "do", "das", "dos", "e", "em", "na", "no", "nas", "nos",
    "a", "o", "as", "os", "para", "por", "com", "sem", "ou",
    "en", "del", "la", "las", "el", "los", "y", "con"
  ]);

  const siglas = new Set([
    "i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x",
    "cx", "ti", "rh", "ead", "cc", "br", "bra", "latam", "ops", "kpi", "xl", "xls"
  ]);

  return str
    .toLowerCase()
    .split(/\s+/)
    .map((palavra, index) => {
      if (!palavra) return "";
      const limpa = palavra.replace(/^[^\wáàâãéèêíïóôõöúçñ]+|[^\wáàâãéèêíïóôõöúçñ]+$/gi, "");
      if (siglas.has(limpa.toLowerCase())) {
        return palavra.toUpperCase();
      }
      if (index > 0 && minusculas.has(limpa.toLowerCase())) {
        return palavra.toLowerCase();
      }
      return palavra.charAt(0).toUpperCase() + palavra.slice(1).toLowerCase();
    })
    .join(" ");
};

function calcularDuracao(ini?: string | null, fim?: string | null, horas?: number | null): string {
  const d = diasEntre(ini, fim);
  const h = horas ? ` • ${horas}h` : "";
  return `${d} ${d === 1 ? "dia" : "dias"}${h}`;
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

  const toggleExpand = alternarItem;

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
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Bloco Superior: Competência + Filtros (Print 5) */}
            <div style={{ backgroundColor: "var(--surface-container-lowest)", border: "1px solid var(--border)", borderRadius: "14px", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
              {/* Competência: Ano e Chips de Meses */}
              <nav className="month-strip" aria-label="Seleção de Competência" style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", padding: "14px 18px", borderBottom: "1px solid var(--border)" }}>
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

              {/* Barra de Filtros */}
              <div style={{ display: "flex", gap: "10px", padding: "12px 18px", alignItems: "center", flexWrap: "wrap", backgroundColor: "var(--surface-container-low)" }}>
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

                {/* Botões de Expandir e Recolher Todos */}
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
            </div>

            {/* Guia de Colunas Oficial Suspenso (Idêntico ao Print 5) */}
            <div
              className="table-labels-guide"
              style={{
                display: "grid",
                gridTemplateColumns: "3.4fr 2fr 2fr 2fr 1.4fr",
                padding: "8px 20px",
                gap: "14px",
                alignItems: "center",
                fontSize: "11px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                color: "var(--on-surface-variant)",
              }}
            >
              <div>PROJETO &amp; ATIVIDADE</div>
              <div>LOCAL / CONCESSIONÁRIA</div>
              <div>PERÍODO &amp; HORAS</div>
              <div>INSTRUTOR / PERFIL</div>
              <div style={{ textAlign: "right" }}>CONSULTOR</div>
            </div>

            {/* Pilha de Cards Flutuantes Suspensos Independentes (Idêntico ao Print 5) */}
            <div className="cards-stack" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
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
                  <span className="material-symbols-outlined" style={{ fontSize: "36px", color: "var(--outline)", display: "block", marginBottom: "8px" }}>
                    event_busy
                  </span>
                  Nenhuma atividade encontrada com os filtros selecionados.
                </div>
              ) : (
                filtradas.map((l) => {
                  const aberto = expandidos.has(l.id);
                  const v = Array.isArray(l.viagens) ? l.viagens[0] : l.viagens;
                  const cc = l.projetos?.centros_custo;

                  // Valores de logística
                  const custo1 = Number(v?.custo_1 || 0);
                  const custo2 = Number(v?.custo_2 || 0);
                  const custo3 = Number(v?.custo_3 || 0);
                  const custo4 = Number(v?.custo_4 || 0);
                  const custo5 = Number(v?.custo_5 || 0);
                  const custoTotalViagem = Number(v?.total || (custo1 + custo2 + custo3 + custo4 + custo5));

                  // Regra de Negócio: Prazo de Prestação de Contas (até 5 dias após término)
                  const infoPrazo = calcularPrazoPrestacaoContas(l.precisa_logistica, l.data_final, v?.custo_5, l.status);

                  return (
                    <div
                      key={l.id}
                      className={`floating-card-row ${aberto ? "expanded" : ""}`}
                      style={{
                        backgroundColor: "var(--surface-container-lowest, #ffffff)",
                        borderRadius: "12px",
                        border: aberto ? "1px solid var(--primary, #00152f)" : "1px solid var(--border)",
                        boxShadow: aberto ? "0 4px 16px rgba(0, 21, 47, 0.08)" : "0 1px 3px rgba(0, 0, 0, 0.04)",
                        overflow: "hidden",
                        transition: "all 0.18s ease",
                      }}
                    >
                      {/* Barra Principal do Card (Idêntico ao Print 5) */}
                      <div
                        className="card-main-bar"
                        style={{
                          display: "grid",
                          gridTemplateColumns: "3.4fr 2fr 2fr 2fr 1.4fr",
                          padding: "14px 20px",
                          gap: "14px",
                          alignItems: "center",
                          cursor: "pointer",
                        }}
                        onClick={() => toggleExpand(l.id)}
                      >
                        {/* Col 1: PROJETO & ATIVIDADE com Botão Toggle Escuro/Claro */}
                        <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpand(l.id);
                            }}
                            style={{
                              width: "32px",
                              height: "32px",
                              borderRadius: "8px",
                              backgroundColor: aberto ? "#00152f" : "#f1f5f9",
                              color: aberto ? "#ffffff" : "var(--primary)",
                              border: "none",
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                              marginTop: "2px",
                              transition: "all 0.15s ease",
                            }}
                            title={aberto ? "Recolher Detalhes" : "Expandir Detalhes Logísticos"}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
                              {aberto ? "expand_less" : "expand_more"}
                            </span>
                          </button>

                          <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                              <strong style={{ fontSize: "13px", fontWeight: 800, color: "var(--primary)", textTransform: "uppercase", letterSpacing: "0.02em" }}>
                                {l.projetos?.nome || "Projeto"}
                              </strong>
                              {l.status && (
                                <span className={`tag-status-atividade ${statusClasse(l.status)}`}>
                                  {l.status}
                                </span>
                              )}
                            </div>
                            <span style={{ fontSize: "12px", color: "var(--on-surface-variant)", lineHeight: 1.3 }}>
                              {capitalizarAtividade(l.atividade)}
                            </span>
                          </div>
                        </div>

                        {/* Col 2: LOCAL / CONCESSIONÁRIA */}
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <div
                            style={{
                              width: "32px",
                              height: "32px",
                              borderRadius: "8px",
                              backgroundColor: "rgba(0, 103, 129, 0.08)",
                              color: "var(--secondary, #006781)",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                              {l.modalidade === "VIRTUAL" ? "devices" : "location_city"}
                            </span>
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
                            <strong style={{ fontSize: "12px", color: "var(--on-surface)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {l.local || "Não informado"}
                            </strong>
                            <span style={{ fontSize: "11px", color: "var(--on-surface-variant)" }}>
                              Região {l.regiao || "BRA"}
                            </span>
                          </div>
                        </div>

                        {/* Col 3: PERÍODO & HORAS */}
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <div
                            style={{
                              width: "32px",
                              height: "32px",
                              borderRadius: "8px",
                              backgroundColor: "rgba(0, 21, 47, 0.06)",
                              color: "var(--primary)",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                              calendar_today
                            </span>
                          </div>
                          <div style={{ display: "flex", flexDirection: "column" }}>
                            <strong style={{ fontSize: "12px", color: "var(--on-surface)", whiteSpace: "nowrap" }}>
                              {formatarPeriodoBR(l.data_inicial, l.data_final)}
                            </strong>
                            <span style={{ fontSize: "11px", color: "var(--on-surface-variant)" }}>
                              {calcularDuracao(l.data_inicial, l.data_final, l.horas)}
                            </span>
                          </div>
                        </div>

                        {/* Col 4: INSTRUTOR / PERFIL */}
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <div
                            style={{
                              width: "32px",
                              height: "32px",
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

                        {/* Col 5: CONSULTOR (Valor a Receber) */}
                        <div style={{ textAlign: "right" }}>
                          <strong style={{ fontSize: "14px", fontWeight: 800, color: "var(--on-surface)", whiteSpace: "nowrap" }}>
                            {brl(l.custo_consultor)}
                          </strong>
                        </div>
                      </div>

                      {/* Drawer Expansível de Detalhamento Logístico (Idêntico ao Print 5) */}
                      {aberto && (
                        <div style={{ padding: "0 20px 20px 20px", backgroundColor: "transparent" }}>
                          <div style={{ border: "1px solid var(--border)", borderRadius: "12px", padding: "18px 20px", backgroundColor: "#f8fafc", boxShadow: "inset 0 1px 2px rgba(0,0,0,0.02)" }}>
                            {/* Header do Detalhamento Logístico */}
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "8px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <span className="material-symbols-outlined" style={{ color: "var(--secondary, #006781)", fontSize: "20px" }}>
                                  flight
                                </span>
                                <strong style={{ fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--primary)" }}>
                                  Detalhamento Logístico &amp; Despesas de Viagem
                                </strong>
                              </div>

                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <div style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "3px 8px", borderRadius: "6px", backgroundColor: "#e2e8f0", fontSize: "11px", color: "var(--on-surface-variant)" }}>
                                  <span>Precisa Logística?</span>
                                  <strong style={{ color: "var(--primary)" }}>{l.precisa_logistica ? "SIM" : "NÃO"}</strong>
                                </div>
                                {v?.agencia && (
                                  <div style={{ padding: "3px 8px", borderRadius: "6px", backgroundColor: "#ffedd5", color: "#c2410c", fontSize: "11px", fontWeight: 700 }}>
                                    AGÊNCIA: {v.agencia}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Matriz dos 6 Mini-Cards de Logística (Idêntico ao Print 5) */}
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "10px", marginBottom: "14px" }}>
                              {/* Item 1: Aéreo */}
                              <div style={{ padding: "12px", borderRadius: "8px", backgroundColor: "#ffffff", border: "1px solid var(--border)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                                  <span style={{ fontSize: "11px", color: "var(--on-surface-variant)", textTransform: "uppercase", fontWeight: 700 }}>Passagem Aérea</span>
                                  <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "var(--secondary)" }}>flight</span>
                                </div>
                                <div style={{ fontSize: "14px", fontWeight: 800, color: "var(--primary)" }}>{brl(custo1)}</div>
                                <span style={{ fontSize: "10px", color: "var(--on-surface-variant)", marginTop: "2px" }}>{custo1 > 0 ? "Emissão e taxas" : "Sem aéreo"}</span>
                              </div>

                              {/* Item 2: Hotel */}
                              <div style={{ padding: "12px", borderRadius: "8px", backgroundColor: "#ffffff", border: "1px solid var(--border)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                                  <span style={{ fontSize: "11px", color: "var(--on-surface-variant)", textTransform: "uppercase", fontWeight: 700 }}>Hotel / Estadia</span>
                                  <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "var(--secondary)" }}>hotel</span>
                                </div>
                                <div style={{ fontSize: "14px", fontWeight: 800, color: "var(--primary)" }}>{brl(custo2)}</div>
                                <span style={{ fontSize: "10px", color: "var(--on-surface-variant)", marginTop: "2px" }}>{custo2 > 0 ? "Hospedagem faturada" : "Sem diárias"}</span>
                              </div>

                              {/* Item 3: Carro */}
                              <div style={{ padding: "12px", borderRadius: "8px", backgroundColor: "#ffffff", border: "1px solid var(--border)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                                  <span style={{ fontSize: "11px", color: "var(--on-surface-variant)", textTransform: "uppercase", fontWeight: 700 }}>Carro / Translado</span>
                                  <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "var(--secondary)" }}>directions_car</span>
                                </div>
                                <div style={{ fontSize: "14px", fontWeight: 800, color: "var(--primary)" }}>{brl(custo3)}</div>
                                <span style={{ fontSize: "10px", color: "var(--on-surface-variant)", marginTop: "2px" }}>{custo3 > 0 ? "Locação / Translado" : "Sem translado"}</span>
                              </div>

                              {/* Item 4: Seguro */}
                              <div style={{ padding: "12px", borderRadius: "8px", backgroundColor: "#ffffff", border: "1px solid var(--border)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                                  <span style={{ fontSize: "11px", color: "var(--on-surface-variant)", textTransform: "uppercase", fontWeight: 700 }}>Seguro / Outros</span>
                                  <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "var(--secondary)" }}>shield</span>
                                </div>
                                <div style={{ fontSize: "14px", fontWeight: 800, color: "var(--primary)" }}>{brl(custo4)}</div>
                                <span style={{ fontSize: "10px", color: "var(--on-surface-variant)", marginTop: "2px" }}>{custo4 > 0 ? "Apólice internacional" : "Não aplicável"}</span>
                              </div>

                              {/* Item 5: Alimentação */}
                              <div style={{ padding: "12px", borderRadius: "8px", backgroundColor: "#ffffff", border: "1px solid var(--border)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                                  <span style={{ fontSize: "11px", color: "var(--on-surface-variant)", textTransform: "uppercase", fontWeight: 700 }}>Alimentação / Diária</span>
                                  <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "var(--secondary)" }}>restaurant</span>
                                </div>
                                <div style={{ fontSize: "14px", fontWeight: 800, color: "var(--primary)" }}>{brl(custo5)}</div>
                                <span style={{ fontSize: "10px", color: "var(--on-surface-variant)", marginTop: "2px" }}>Despesa Consultor</span>
                              </div>

                              {/* Item 6: Total Viagem em Destaque Marinho (Print 5) */}
                              <div style={{ padding: "12px", borderRadius: "8px", backgroundColor: "#00152f", color: "#ffffff", border: "1px solid #00152f", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                                  <span style={{ fontSize: "11px", color: "#93c5fd", textTransform: "uppercase", fontWeight: 700 }}>TOTAL VIAGEM</span>
                                  <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#38bdf8" }}>receipt_long</span>
                                </div>
                                <div style={{ fontSize: "15px", fontWeight: 800, color: "#ffffff" }}>{brl(custoTotalViagem)}</div>
                                <span style={{ fontSize: "10px", color: "#34d399", fontWeight: 700, marginTop: "2px" }}>Conciliado 100%</span>
                              </div>
                            </div>

                            {/* Rodapé do Detalhamento: Prazo Prestação de Contas & Observações Agência */}
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", paddingTop: "12px", borderTop: "1px dashed var(--border)" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                <div style={{ width: "28px", height: "28px", borderRadius: "50%", backgroundColor: infoPrazo.corBg, color: infoPrazo.corTexto, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                  <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>{infoPrazo.icone}</span>
                                </div>
                                <div>
                                  <span style={{ fontSize: "10px", color: "var(--on-surface-variant)", textTransform: "uppercase", fontWeight: 700, display: "block" }}>Prazo Prestação de Contas</span>
                                  <strong style={{ fontSize: "12px", color: infoPrazo.corTexto }}>
                                    {infoPrazo.badgeTexto}
                                    {infoPrazo.status === "EM_ATRASO" ? ` (${infoPrazo.diasAtraso}d em atraso)` : ""}
                                    {infoPrazo.status === "DENTRO_DO_PRAZO" && infoPrazo.diasRestantes ? ` (${infoPrazo.diasRestantes}d restantes)` : ""}
                                  </strong>
                                </div>
                              </div>

                              <div style={{ flex: 1, minWidth: "220px", display: "flex", flexDirection: "column" }}>
                                <span style={{ fontSize: "10px", color: "var(--on-surface-variant)", textTransform: "uppercase", fontWeight: 700 }}>
                                  Observações Agência de Viagens
                                </span>
                                <span style={{ fontSize: "11px", color: "var(--on-surface)", fontStyle: "italic" }}>
                                  {v?.observacao_agencia || "Nenhuma instrução adicional registrada."}
                                </span>
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

            {/* Rodapé da Listagem com Totais */}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 20px", backgroundColor: "var(--surface-container-lowest)", borderRadius: "12px", border: "1px solid var(--border)", fontSize: "12px", color: "var(--on-surface-variant)", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
              <span>Exibindo <strong>{filtradas.length}</strong> de <strong>{todas.length}</strong> atividades cadastradas</span>
              <span>Total Consultor: <strong style={{ color: "var(--primary)", fontSize: "13px" }}>{brl(totalConsultor)}</strong></span>
            </div>
          </div>
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
