"use client";

import React, { useEffect, useMemo, useState } from "react";
import ConsultorHeader from "@/components/ConsultorHeader";
import ModernDropdown from "@/components/ModernDropdown";
import { useConsultor } from "@/contexts/ConsultorContext";
import { formatarDataBR } from "@/lib/date-utils";

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
  const [expandido, setExpandido] = useState<string | null>(null);

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

  const limpar = () => {
    setBusca("");
    setCidade("todas");
    setModalidade("todas");
    setStatus("todos");
  };

  const th: React.CSSProperties = { padding: "12px 16px", fontSize: "11px", fontWeight: 700, color: "var(--on-surface-variant)", textTransform: "uppercase", letterSpacing: "0.03em", textAlign: "left" };

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

        {/* KPIs (sem informação de FATURAR) */}
        <section className="kpis-grid" aria-label="Indicadores do Consultor" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <div className="kpi-card">
            <div className="kpi-content">
              <span className="kpi-label">A RECEBER (CONSULTOR)</span>
              <div className="kpi-value-row"><span className="kpi-value medium">{brl(totalConsultor)}</span></div>
            </div>
            <div className="kpi-icon-box success-bg"><span className="material-symbols-outlined" style={{ fontSize: "22px" }}>payments</span></div>
          </div>
          <div className="kpi-card">
            <div className="kpi-content">
              <span className="kpi-label">HORAS NA COMPETÊNCIA</span>
              <div className="kpi-value-row"><span className="kpi-value medium">{totalHoras.toFixed(0)} h</span></div>
            </div>
            <div className="kpi-icon-box"><span className="material-symbols-outlined" style={{ fontSize: "22px" }}>schedule</span></div>
          </div>
          <div className="kpi-card">
            <div className="kpi-content">
              <span className="kpi-label">ATIVIDADES</span>
              <div className="kpi-value-row"><span className="kpi-value medium">{filtradas.length}</span></div>
            </div>
            <div className="kpi-icon-box secondary-bg"><span className="material-symbols-outlined" style={{ fontSize: "22px" }}>event_note</span></div>
          </div>
          <div className="kpi-card">
            <div className="kpi-content">
              <span className="kpi-label">CANCELADAS</span>
              <div className="kpi-value-row"><span className="kpi-value medium" style={{ color: "#b91c1c" }}>{canceladas} turmas</span></div>
            </div>
            <div className="kpi-icon-box cancel-bg"><span className="material-symbols-outlined" style={{ fontSize: "22px" }}>event_busy</span></div>
          </div>
        </section>

        <section style={{ backgroundColor: "var(--surface-container-lowest)", border: "1px solid var(--border)", borderRadius: "14px", overflow: "hidden" }}>
          {/* Competência */}
          <nav className="month-strip" aria-label="Seleção de Competência" style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "var(--primary)" }}>calendar_month</span>
            <span className="month-label" style={{ fontWeight: 700, margin: 0 }}>COMPETÊNCIA:</span>
            <ModernDropdown
              value={ano}
              onChange={(v) => setAno(Number(v))}
              options={anosDisponiveis.map((a) => ({ value: a, label: String(a) }))}
              minWidth={90}
              searchable={false}
            />
            <button type="button" onClick={() => setMes(0)} className={`month-chip ${mes === 0 ? "active" : ""}`} style={{ border: "none", cursor: "pointer" }}>
              Todos
            </button>
            {MESES.map((m, i) => (
              <button
                key={m}
                type="button"
                onClick={() => setMes(mes === i + 1 ? 0 : i + 1)}
                className={`month-chip ${mes === i + 1 ? "active" : ""}`}
                style={{ border: "none", cursor: "pointer" }}
              >
                {m}
              </button>
            ))}
          </nav>

          {/* Filtros */}
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ flex: 1, minWidth: "240px", position: "relative" }}>
              <span className="material-symbols-outlined" style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", fontSize: "18px", color: "var(--on-surface-variant)" }}>search</span>
              <input
                id="agenda-busca"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Filtrar por CC, Projeto, Atividade, Concessionária ou Cidade..."
                style={{ width: "100%", padding: "9px 12px 9px 36px", borderRadius: "10px", border: "1px solid var(--border)", background: "var(--surface-container-lowest)", color: "var(--on-surface)", fontSize: "13px" }}
              />
            </div>
            <ModernDropdown value={cidade} onChange={(v) => setCidade(String(v))} icon="location_on" minWidth={200}
              options={[{ value: "todas", label: "Todas as Cidades" }, ...cidades.map((c) => ({ value: c, label: c }))]} />
            <ModernDropdown value={modalidade} onChange={(v) => setModalidade(String(v))} icon="flag" minWidth={180}
              options={[{ value: "todas", label: "Modalidade" }, ...modalidades.map((c) => ({ value: c, label: c }))]} />
            <ModernDropdown value={status} onChange={(v) => setStatus(String(v))} icon="check_circle" minWidth={190}
              options={[{ value: "todos", label: "Status da Atividade" }, ...statusLista.map((c) => ({ value: c, label: c }))]} />
            <button type="button" onClick={limpar} className="btn-secondary" style={{ padding: "8px 14px", fontSize: "12px" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>restart_alt</span>
              <span>Limpar</span>
            </button>
          </div>

          {/* Tabela */}
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
                    const aberto = expandido === l.id;
                    const remoto = (l.modalidade || "").toLowerCase().match(/remot|online|ead|virtual/);
                    const cc = l.projetos?.centros_custo;
                    return (
                      <React.Fragment key={l.id}>
                        <tr style={{ borderTop: "1px solid var(--border)" }}>
                          <td style={{ padding: "14px 16px" }}>
                            <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                              <button type="button" onClick={() => setExpandido(aberto ? null : l.id)} aria-label="Detalhes"
                                style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--on-surface-variant)", padding: 0 }}>
                                <span className="material-symbols-outlined" style={{ fontSize: "20px", transform: aberto ? "rotate(180deg)" : "none", transition: "transform .15s" }}>expand_more</span>
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
                        {aberto && (
                          <tr style={{ background: "var(--surface-container-low)" }}>
                            <td colSpan={5} style={{ padding: "12px 52px", fontSize: "12px", color: "var(--on-surface-variant)" }}>
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px" }}>
                                <div><strong>Centro de Custo:</strong> {cc?.codigo || "—"}</div>
                                <div><strong>Contrato:</strong> {cc?.contrato || "—"}</div>
                                <div><strong>Área:</strong> {cc?.areas?.nome || "—"}</div>
                                <div><strong>Líder do Projeto:</strong> {cc?.lideres?.nome || "—"}</div>
                                <div><strong>Modalidade:</strong> {l.modalidade || "—"}</div>
                                <div><strong>Precisa de logística:</strong> {l.precisa_logistica ? "Sim" : "Não"}</div>
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
