"use client";

import React from "react";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";

const MENU = [
  { href: "/projetos", icon: "assignment", label: "Projetos & Atividades" },
  { href: "/medicao", icon: "receipt_long", label: "BM - Boletim de Medição" },
  { href: "/viagens", icon: "flight", label: "Viagens & Logística" },
  { href: "/centro-de-custo", icon: "account_tree", label: "Centro de Custo" },
  { href: "/tabela-precos", icon: "request_quote", label: "Tabela de Preços" },
  { href: "/pessoas", icon: "group", label: "Pessoas" },
  { href: "/faturamento", icon: "receipt", label: "Faturamento" },
  { href: "/pagamentos", icon: "payments", label: "Pagamentos" },
  { href: "/relatorios", icon: "monitoring", label: "Relatórios" },
  { href: "/consultor", icon: "support_agent", label: "Consultor" },
];

export default function RelatorioShell({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
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
            {MENU.map((m) => (
              <Link key={m.href} href={m.href} className={`nav-item${m.href === "/relatorios" ? " active" : ""}`}>
                <span className="material-symbols-outlined">{m.icon}</span>
                <span>{m.label}</span>
              </Link>
            ))}
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
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <Link
              href="/relatorios"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 14px",
                borderRadius: "8px",
                backgroundColor: "var(--surface-container-low)",
                border: "1px solid var(--border)",
                color: "var(--primary)",
                fontSize: "12px",
                fontWeight: 700,
                textDecoration: "none",
                transition: "all 0.15s ease",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>arrow_back</span>
              <span>Voltar</span>
            </Link>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Link href="/relatorios" className="font-label-sm" style={{ color: "var(--on-surface-variant)", letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 600, textDecoration: "none" }}>
                Central de Relatórios
              </Link>
              <span style={{ color: "var(--outline-variant)" }}>/</span>
              <span className="font-label-sm" style={{ color: "var(--primary)", fontWeight: 700 }}>{titulo}</span>
            </div>
          </div>
          <ThemeToggle />
        </header>
        <main style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: "20px", minWidth: 0 }}>
          {children}
        </main>
      </div>
    </div>
  );
}
