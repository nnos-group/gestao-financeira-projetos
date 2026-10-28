"use client";

import Link from "next/link";
import React, { useMemo, useState } from "react";
import ThemeToggle from "@/components/ThemeToggle";

type Indicador = {
  rotulo: string;
  valor: string;
  cor?: string;
};

type Relatorio = {
  id: string;
  titulo: string;
  descricao: string;
  icone: string;
  categoria: "Financeiro" | "Projetos" | "Despesas";
  tag: string;
  cor: string;
  bgIcone: string;
  btnTexto: string;
  btnGradiente: string;
  href: string;
  indicadores: [Indicador, Indicador, Indicador];
  altHref?: string;
  altTexto?: string;
  altGradiente?: string;
};

const RELATORIOS: Relatorio[] = [
  {
    id: "matriz",
    titulo: "Relatório Financeiro & DRE Gerencial",
    descricao:
      "Demonstrativo de Resultados acumulado de 9 meses (Jan a Set/2026), Faturamento Mensal, Análise por Unidades de Negócio, Centros de Custo, Viagens & Reembolsos e Síntese Executiva.",
    icone: "bar_chart",
    categoria: "Financeiro",
    tag: "NNÓS MATRIZ • YTD 2026",
    cor: "#0284c7",
    bgIcone: "#e0f2fe",
    btnTexto: "Acessar Relatório Matriz →",
    btnGradiente: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
    href: "/relatorios/matriz",
    indicadores: [
      { rotulo: "RECEITA YTD", valor: "R$ 7,88M", cor: "#0f172a" },
      { rotulo: "MARGEM BRUTA", valor: "46,5%", cor: "#059669" },
      { rotulo: "PERÍODO", valor: "9 Meses", cor: "#0284c7" },
    ],
    altHref: "/relatorios/financeiro",
    altTexto: "Acessar DRE Analítica Interna →",
    altGradiente: "linear-gradient(135deg, #0f2a4a 0%, #001f35 100%)",
  },
  {
    id: "contas-pagar",
    titulo: "Contas a Pagar | Campus BH UVA",
    descricao:
      "Universidade Veiga de Almeida — Controle analítico por data de vencimento (Out/25 a Jan/27), Realizado vs. Projeções Futuras, Detalhamento de Imobilizado & Obras, Top Fornecedores e Formas de Pagamento.",
    icone: "account_balance_wallet",
    categoria: "Financeiro",
    tag: "CAMPUS BH UVA • SET/2026",
    cor: "#d97706",
    bgIcone: "#fef3c7",
    btnTexto: "Acessar Campus BH UVA →",
    btnGradiente: "linear-gradient(135deg, #d97706 0%, #b45309 100%)",
    href: "/relatorios/contas-pagar",
    indicadores: [
      { rotulo: "TOTAL GERAL", valor: "R$ 765,9K", cor: "#0f172a" },
      { rotulo: "TAXA QUITAÇÃO", valor: "98,21%", cor: "#059669" },
      { rotulo: "IMOBILIZADO", valor: "R$ 337,8K", cor: "#d97706" },
    ],
  },
  {
    id: "performance-projetos",
    titulo: "Performance de Projetos",
    descricao:
      "Dashboard Executivo do portfólio consolidado de 44 projetos. Leitura gerencial de Receita, Margem Bruta, Custos Diretos, Impostos, Ranking por Líderes, Imobilizado & Reforma e Viagens Corporativas.",
    icone: "trending_up",
    categoria: "Projetos",
    tag: "NNÓS BUSINESS • 2026",
    cor: "#059669",
    bgIcone: "#dcfce7",
    btnTexto: "Acessar Performance de Projetos →",
    btnGradiente: "linear-gradient(135deg, #059669 0%, #047857 100%)",
    href: "/relatorios/performance-projetos",
    indicadores: [
      { rotulo: "PROJETOS", valor: "44", cor: "#0f172a" },
      { rotulo: "RECEITA TOTAL", valor: "R$ 10,64M", cor: "#059669" },
      { rotulo: "MARGEM BRUTA", valor: "R$ 1,60M", cor: "#059669" },
    ],
  },
  {
    id: "despesas-prospeccao",
    titulo: "Despesas & Prospecção",
    descricao:
      "Dashboard Executivo de viagens e atividades corporativas. Detalhamento analítico de Prospecção Comercial, Viagens Internacionais, Planejamento Estratégico, Destinos e Categorias.",
    icone: "explore",
    categoria: "Despesas",
    tag: "NNÓS PROSPECÇÃO • YTD 2026",
    cor: "#7c3aed",
    bgIcone: "#ede9fe",
    btnTexto: "Acessar Despesas & Prospecção →",
    btnGradiente: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
    href: "/relatorios/despesas-prospeccao",
    indicadores: [
      { rotulo: "TOTAL GERAL", valor: "R$ 158,7K", cor: "#0f172a" },
      { rotulo: "ATIVIDADES", valor: "53", cor: "#7c3aed" },
      { rotulo: "PROSPECÇÃO", valor: "R$ 16,6K", cor: "#7c3aed" },
    ],
  },
  {
    id: "painel-lider",
    titulo: "Painel por Líder",
    descricao:
      "Visão executiva por gestor de projetos: receita, custos diretos, impostos, margens de rentabilidade e rankings dos projetos mais e menos lucrativos por centro de custo.",
    icone: "badge",
    categoria: "Projetos",
    tag: "PAINEL POR LÍDER • 2026",
    cor: "#2563eb",
    bgIcone: "#dbeafe",
    btnTexto: "Acessar Painel por Líder →",
    btnGradiente: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
    href: "/relatorios/painel-lider",
    indicadores: [
      { rotulo: "LÍDERES", valor: "7", cor: "#0f172a" },
      { rotulo: "PROJETOS", valor: "44", cor: "#2563eb" },
      { rotulo: "RECEITA TOTAL", valor: "R$ 10,64M", cor: "#059669" },
    ],
  },
];

const CATEGORIAS = ["Todos", "Financeiro", "Projetos", "Despesas"] as const;

export default function RelatoriosPage() {
  const [categoria, setCategoria] = useState<(typeof CATEGORIAS)[number]>("Todos");
  const [busca, setBusca] = useState("");

  const lista = useMemo(
    () =>
      RELATORIOS.filter(
        (r) =>
          (categoria === "Todos" || r.categoria === categoria) &&
          `${r.titulo} ${r.descricao} ${r.tag}`.toLowerCase().includes(busca.toLowerCase())
      ),
    [categoria, busca]
  );

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="flex flex-col">
          <div className="sidebar-brand">
            <img src="/logo-coruja.png" alt="Logo Coruja NNÓS" className="sidebar-brand-img" />
            <div className="sidebar-brand-text">
              <h2 style={{ lineHeight: "1.2", textTransform: "uppercase" }}>
                GESTÃO<br />FINANCEIRA &amp; PROJETOS
              </h2>
            </div>
          </div>
          <nav className="sidebar-nav">
            <Link href="/projetos" className="nav-item"><span className="material-symbols-outlined">assignment</span><span>Projetos &amp; Atividades</span></Link>
            <Link href="/medicao" className="nav-item"><span className="material-symbols-outlined">receipt_long</span><span>BM - Boletim de Medição</span></Link>
            <Link href="/viagens" className="nav-item"><span className="material-symbols-outlined">flight</span><span>Viagens &amp; Logística</span></Link>
            <Link href="/centro-de-custo" className="nav-item"><span className="material-symbols-outlined">account_tree</span><span>Centro de Custo</span></Link>
            <Link href="/tabela-precos" className="nav-item"><span className="material-symbols-outlined">request_quote</span><span>Tabela de Preços</span></Link>
            <Link href="/pessoas" className="nav-item"><span className="material-symbols-outlined">group</span><span>Pessoas</span></Link>
            <Link href="/faturamento" className="nav-item"><span className="material-symbols-outlined">receipt</span><span>Faturamento</span></Link>
            <Link href="/pagamentos" className="nav-item"><span className="material-symbols-outlined">payments</span><span>Pagamentos</span></Link>
            <Link href="/relatorios" className="nav-item active"><span className="material-symbols-outlined">monitoring</span><span>Relatórios</span></Link>
            <Link href="/consultor" className="nav-item"><span className="material-symbols-outlined">support_agent</span><span>Consultor</span></Link>
          </nav>
        </div>
        <div className="sidebar-footer">
          <div className="sidebar-footer-info" style={{ padding: "8px 12px", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "2px" }}>
            <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--on-surface)" }}>Sistema Operacional NNÓS</span>
            <span style={{ fontSize: "10px", color: "var(--on-surface-variant)" }}>Módulo de Relatórios Gerenciais</span>
          </div>
        </div>
      </aside>

      <div className="main-wrapper">
        <header className="top-header">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span className="font-label-sm" style={{ color: "var(--on-surface-variant)", letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 600 }}>Portal Corporativo · NNÓS</span>
            <span style={{ color: "var(--outline-variant)" }}>/</span>
            <span className="font-label-sm" style={{ color: "var(--primary)", fontWeight: 700 }}>Central de Relatórios</span>
          </div>
          <ThemeToggle />
        </header>

        <main style={{ padding: "28px 32px", display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Header Banner estilo Print 2 */}
          <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: "10px", alignItems: "center" }}>
            <img src="/logo-horizontal.png" alt="NNÓS - Transformando estratégias em realidade" style={{ height: "92px", width: "auto", objectFit: "contain" }} />
            
            <h1 style={{ fontFamily: "var(--font-jakarta)", fontSize: "32px", fontWeight: 800, color: "var(--primary)", margin: 0 }}>
              Painel de Relatórios
            </h1>
            <p style={{ margin: 0, fontSize: "14px", color: "var(--on-surface-variant)" }}>
              Selecione o demonstrativo que deseja consultar em tempo real:
            </p>
          </div>

          {/* Filtros e Busca */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {CATEGORIAS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategoria(c)}
                  style={{
                    padding: "7px 18px",
                    borderRadius: "999px",
                    fontSize: "12.5px",
                    fontWeight: 700,
                    cursor: "pointer",
                    border: "1px solid var(--border)",
                    background: categoria === c ? "var(--primary)" : "var(--surface-container-lowest)",
                    color: categoria === c ? "var(--on-primary)" : "var(--on-surface-variant)",
                    transition: "all 0.15s ease",
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 14px", borderRadius: "10px", border: "1px solid var(--border)", background: "var(--surface-container-lowest)", minWidth: "280px" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "var(--outline)" }}>search</span>
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar demonstrativo..."
                style={{ border: "none", outline: "none", background: "transparent", fontSize: "13px", width: "100%", color: "var(--on-surface)" }}
              />
            </div>
          </div>

          {/* Grid de 5 Cards no Padrão Exato da Imagem 2 */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "22px" }}>
            {lista.map((r) => {
              return (
                <div
                  key={r.id}
                  style={{
                    position: "relative",
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    padding: "24px",
                    borderRadius: "20px",
                    border: "1px solid var(--border)",
                    background: "var(--surface-container-lowest)",
                    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.05)",
                    transition: "all 0.2s ease",
                  }}
                >
                  {/* Decorative soft glow no canto superior */}
                  <div
                    style={{
                      position: "absolute",
                      top: -40,
                      right: -40,
                      width: 140,
                      height: 140,
                      borderRadius: "50%",
                      background: `${r.cor}15`,
                      filter: "blur(20px)",
                      pointerEvents: "none",
                    }}
                  />

                  <div style={{ display: "flex", flexDirection: "column", gap: "16px", position: "relative" }}>
                    {/* Top Row: Ícone + Tag */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 14,
                          background: r.bgIcone,
                          color: r.cor,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: "24px" }}>
                          {r.icone}
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: "10.5px",
                          fontWeight: 800,
                          padding: "4px 12px",
                          borderRadius: "999px",
                          background: r.bgIcone,
                          color: r.cor,
                          letterSpacing: "0.04em",
                          textTransform: "uppercase",
                        }}
                      >
                        {r.tag}
                      </span>
                    </div>

                    {/* Título & Descrição */}
                    <div>
                      <h3
                        style={{
                          margin: "0 0 8px",
                          fontSize: "17.5px",
                          fontWeight: 800,
                          color: "var(--on-surface)",
                          lineHeight: 1.3,
                        }}
                      >
                        {r.titulo}
                      </h3>
                      <p
                        style={{
                          margin: 0,
                          fontSize: "12.5px",
                          lineHeight: 1.55,
                          color: "var(--on-surface-variant)",
                          minHeight: "56px",
                        }}
                      >
                        {r.descricao}
                      </p>
                    </div>

                    {/* Caixa de mini-indicadores padronizada (3 colunas, Print 2) */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr 1fr",
                        gap: "6px",
                        padding: "12px 10px",
                        borderRadius: "14px",
                        background: "var(--surface-container-low, #f8fafc)",
                        border: "1px solid var(--border, #e2e8f0)",
                        textAlign: "center",
                      }}
                    >
                      {r.indicadores.map((ind, idx) => (
                        <div
                          key={ind.rotulo}
                          style={{
                            borderRight: idx < 2 ? "1px solid var(--border, #e2e8f0)" : "none",
                            paddingRight: idx < 2 ? "4px" : "0",
                          }}
                        >
                          <div
                            style={{
                              fontSize: "9px",
                              fontWeight: 700,
                              color: "var(--on-surface-variant, #64748b)",
                              textTransform: "uppercase",
                              letterSpacing: "0.03em",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {ind.rotulo}
                          </div>
                          <div
                            style={{
                              fontSize: "13.5px",
                              fontWeight: 800,
                              color: ind.cor || "var(--on-surface)",
                              marginTop: "2px",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {ind.valor}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Ações / Botão Principal */}
                  <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
                    <a
                      href={r.href}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                        padding: "12px",
                        borderRadius: "12px",
                        background: r.btnGradiente,
                        color: "#ffffff",
                        fontWeight: 700,
                        fontSize: "13.5px",
                        textDecoration: "none",
                        boxShadow: `0 4px 14px ${r.cor}35`,
                        transition: "all 0.2s ease",
                      }}
                    >
                      <span>{r.btnTexto}</span>
                    </a>

                    {r.altHref && (
                      <a
                        href={r.altHref}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "8px",
                          padding: "12px",
                          borderRadius: "12px",
                          background: r.altGradiente || "linear-gradient(135deg, #0f2a4a 0%, #001f35 100%)",
                          color: "#ffffff",
                          fontWeight: 700,
                          fontSize: "13.5px",
                          textDecoration: "none",
                          boxShadow: "0 4px 14px rgba(15, 42, 74, 0.25)",
                          transition: "all 0.2s ease",
                        }}
                      >
                        <span>{r.altTexto}</span>
                      </a>
                    )}
                  </div>
                </div>
              );
            })}

            {lista.length === 0 && (
              <div style={{ gridColumn: "1 / -1", textAlign: "center", color: "var(--on-surface-variant)", padding: "40px" }}>
                Nenhum relatório encontrado.
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
