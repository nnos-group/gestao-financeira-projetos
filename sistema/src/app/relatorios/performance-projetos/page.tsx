"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import RelatorioShell from "@/components/RelatorioShell";
import { usePerfilAcesso } from "@/contexts/PerfilAcessoContext";

export default function RelatorioPerformanceProjetosPage() {
  const { perfilAtivoId } = usePerfilAcesso();
  const router = useRouter();

  useEffect(() => {
    if (perfilAtivoId === "LIDER") {
      router.replace("/relatorios/painel-lider");
    }
  }, [perfilAtivoId, router]);

  if (perfilAtivoId === "LIDER") {
    return (
      <RelatorioShell titulo="Performance de Projetos · 2026">
        <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/10 mt-6">
          <span className="material-symbols-outlined text-4xl text-amber-500 mb-2">lock</span>
          <h2 className="text-lg font-bold text-slate-800 dark:text-white">Acesso Exclusivo à Diretoria &amp; Adm</h2>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">Redirecionando para o seu Painel por Líder...</p>
        </div>
      </RelatorioShell>
    );
  }
  return (
    <RelatorioShell titulo="Performance de Projetos · 2026">
      <div style={{ display: "flex", flexDirection: "column", gap: "12px", height: "calc(100vh - 110px)", minHeight: "650px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
          <div>
            <h1 style={{ fontFamily: "var(--font-jakarta)", fontSize: "22px", fontWeight: 800, color: "var(--primary)", margin: 0 }}>
              Performance de Projetos · Booking &amp; Margem
            </h1>
            <p style={{ margin: "2px 0 0", fontSize: "12.5px", color: "var(--on-surface-variant)" }}>
              Dashboard executivo do portfólio: receita, margem bruta, custos diretos, impostos e rankings.
            </p>
          </div>
          <a
            href="https://nnos-group.github.io/relatorio-financeiro-nnos-2026/booking.html"
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
            src="/relatorios-portal/booking.html"
            title="Performance de Projetos NNÓS"
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
