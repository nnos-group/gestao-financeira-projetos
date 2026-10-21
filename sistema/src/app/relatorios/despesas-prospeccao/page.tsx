"use client";

import React from "react";
import RelatorioShell from "@/components/RelatorioShell";

export default function RelatorioDespesasProspeccaoPage() {
  return (
    <RelatorioShell titulo="Despesas & Prospecção · 2026">
      <div style={{ display: "flex", flexDirection: "column", gap: "12px", height: "calc(100vh - 110px)", minHeight: "650px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
          <div>
            <h1 style={{ fontFamily: "var(--font-jakarta)", fontSize: "22px", fontWeight: 800, color: "var(--primary)", margin: 0 }}>
              Despesas &amp; Prospecção Comercial
            </h1>
            <p style={{ margin: "2px 0 0", fontSize: "12.5px", color: "var(--on-surface-variant)" }}>
              Viagens e atividades corporativas: prospecção comercial, viagens internacionais e destinos.
            </p>
          </div>
          <a
            href="https://nnos-group.github.io/relatorio-financeiro-nnos-2026/prospeccao.html"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 12px",
              borderRadius: "8px",
              border: "1px solid var(--border)",
              background: "var(--surface-container-lowest)",
              fontSize: "12px",
              fontWeight: 700,
              color: "var(--primary)",
              textDecoration: "none",
            }}
          >
            <span>Abrir tela cheia externa</span>
            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>open_in_new</span>
          </a>
        </div>

        <div
          style={{
            flex: 1,
            width: "100%",
            borderRadius: "14px",
            border: "1px solid var(--border)",
            overflow: "hidden",
            boxShadow: "0 6px 20px rgba(0, 0, 0, 0.08)",
            background: "#ffffff",
          }}
        >
          <iframe
            src="/relatorios-portal/prospeccao.html"
            title="Despesas e Prospecção NNÓS"
            style={{
              width: "100%",
              height: "100%",
              border: "none",
            }}
          />
        </div>
      </div>
    </RelatorioShell>
  );
}
