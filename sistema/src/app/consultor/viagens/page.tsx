"use client";

import React, { useState } from "react";
import ConsultorHeader from "@/components/ConsultorHeader";
import { useConsultor } from "@/contexts/ConsultorContext";
import { formatarPeriodoBR } from "@/lib/date-utils";

export default function ConsultorViagensPage() {
  const { consultorAtivo, dadosConsultor } = useConsultor();
  const viagens = dadosConsultor?.viagens || [];

  const politicas = [
    {
      nome: "NNÓS Consultoria (Geral)",
      arquivo: "/politicas/politica-nnos.pdf",
      miniatura: "/politicas/politica-nnos.jpg",
      badge: "Oficial / Regra Geral",
    },
    {
      nome: "CNH Training",
      arquivo: "/politicas/politica-cnh.pdf",
      miniatura: "/politicas/politica-cnh.jpg",
      badge: "Cliente Específico",
    },
    {
      nome: "Iveco Group",
      arquivo: "/politicas/politica-iveco.pdf",
      miniatura: "/politicas/politica-iveco.jpg",
      badge: "Cliente Específico",
    },
    {
      nome: "Reembolso Vexpenses",
      arquivo: "/politicas/politica-reembolso-nnos.pdf",
      miniatura: "/politicas/politica-reembolso-nnos.jpg",
      badge: "Prestação de Contas",
    },
  ];

  const brl = (val: number | null | undefined) =>
    (val || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const getStatusStyle = (st: string) => {
    const s = (st || "").toUpperCase();
    if (s.includes("CANCEL")) return { bg: "#fee2e2", fg: "#b91c1c" };
    if (s.includes("CONCLU") || s.includes("CONFIRM")) return { bg: "#dcfce7", fg: "#15803d" };
    if (s.includes("VOUCHER")) return { bg: "#e0f2fe", fg: "#0369a1" };
    if (s.includes("COTAC") || s.includes("AGUARD")) return { bg: "#fef3c7", fg: "#b45309" };
    return { bg: "#f1f5f9", fg: "#475569" };
  };

  return (
    <>
      <ConsultorHeader tituloPagina="Minhas Viagens" />

      <main className="content-container" style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: "24px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 800, margin: 0, color: "var(--primary)" }}>
            Viagens &amp; Logística Corporativa
          </h1>
          <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "var(--on-surface-variant)" }}>
            Solicitações de passagens aéreas, hospedagem e deslocamentos de <strong>{consultorAtivo?.nome}</strong>.
          </p>
        </div>

        {/* Banner de Orientações com Miniaturas Conforme Diretriz 3 do AGENTS.md */}
        <section
          style={{
            backgroundColor: "#fffbeb",
            border: "1.5px solid #fef3c7",
            borderRadius: "14px",
            padding: "20px 24px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
            <span className="material-symbols-outlined" style={{ color: "#d97706", fontSize: "22px" }}>
              info
            </span>
            <h3 style={{ fontSize: "15px", fontWeight: 700, margin: 0, color: "#92400e" }}>
              Orientações para Prestação de Contas &amp; Políticas de Viagem
            </h3>
          </div>

          <p style={{ fontSize: "13px", color: "#78350f", lineHeight: 1.5, margin: "0 0 16px 0" }}>
            <strong>Atenção viajante:</strong> Verifique com antecedência para qual empresa e projeto você estará viajando.
            Se a empresa contratante não possuir política própria homologada, a política oficial adotada como regra geral é a da <strong>NNÓS Consultoria</strong>.
            Clique nas miniaturas abaixo para abrir o PDF oficial correspondente em nova guia.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px" }}>
            {politicas.map((pol) => (
              <a
                key={pol.nome}
                href={pol.arquivo}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  backgroundColor: "#ffffff",
                  borderRadius: "12px",
                  border: "1.5px solid #fde68a",
                  overflow: "hidden",
                  textDecoration: "none",
                  transition: "all 0.15s ease",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
                  cursor: "pointer",
                }}
              >
                {/* Miniatura em Imagem da Capa */}
                <div style={{ width: "100%", height: "130px", overflow: "hidden", backgroundColor: "#fef3c7", position: "relative" }}>
                  <img
                    src={pol.miniatura}
                    alt={pol.nome}
                    style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }}
                    onError={(e) => {
                      // Fallback gracioso se a imagem demorar a carregar
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      top: "8px",
                      right: "8px",
                      backgroundColor: "rgba(255,255,255,0.9)",
                      borderRadius: "6px",
                      padding: "2px 6px",
                      fontSize: "10px",
                      fontWeight: 700,
                      color: "#b45309",
                      display: "flex",
                      alignItems: "center",
                      gap: "2px",
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "12px" }}>picture_as_pdf</span>
                    PDF
                  </div>
                </div>

                {/* Título e Badge */}
                <div style={{ padding: "10px 12px", width: "100%", textAlign: "center" }}>
                  <div style={{ fontWeight: 700, fontSize: "12px", color: "#92400e" }}>
                    {pol.nome}
                  </div>
                  <span style={{ fontSize: "10px", color: "#b45309", opacity: 0.85, marginTop: "2px", display: "block" }}>
                    {pol.badge}
                  </span>
                </div>
              </a>
            ))}
          </div>
        </section>

        {/* Lista de Viagens */}
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 700, color: "var(--primary)", margin: 0 }}>
            Solicitações Registradas ({viagens.length})
          </h2>

          {viagens.length === 0 ? (
            <div
              style={{
                padding: "36px",
                textAlign: "center",
                backgroundColor: "var(--surface-container-lowest)",
                borderRadius: "14px",
                border: "1px solid var(--border)",
                color: "var(--on-surface-variant)",
                fontSize: "13px",
              }}
            >
              Nenhuma viagem registrada até o momento para este consultor.
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px" }}>
              {viagens.map((v: any, idx: number) => {
                const badgeStatus = getStatusStyle(v.status);

                return (
                  <div
                    key={v.id || idx}
                    style={{
                      backgroundColor: "var(--surface-container-lowest)",
                      border: "1px solid var(--border)",
                      borderRadius: "14px",
                      padding: "18px 20px",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      gap: "14px",
                    }}
                  >
                    <div>
                      {/* Top row com SL-XXX em azul claro (corrigido, sem cor escura!) */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 800,
                            padding: "3px 10px",
                            borderRadius: "6px",
                            backgroundColor: "#e0f2fe",
                            color: "#0369a1",
                            border: "1px solid #bae6fd",
                          }}
                        >
                          {v.id?.startsWith("sol-") ? `SL-${String(idx + 1).padStart(3, "0")}` : (v.codigo || `SL-${String(idx + 1).padStart(3, "0")}`)}
                        </span>
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: 700,
                            padding: "3px 10px",
                            borderRadius: "999px",
                            backgroundColor: badgeStatus.bg,
                            color: badgeStatus.fg,
                            textTransform: "uppercase",
                          }}
                        >
                          {v.status || "CONFIRMADO"}
                        </span>
                      </div>

                      <h3 style={{ fontSize: "15px", fontWeight: 800, margin: "0 0 8px 0", color: "var(--primary)" }}>
                        {v.projeto || "Projeto NNÓS"}
                      </h3>

                      <div style={{ fontSize: "12px", color: "var(--on-surface-variant)", display: "flex", flexDirection: "column", gap: "4px" }}>
                        <div>
                          <strong>Destino: </strong>
                          <span>{v.destino || "Conforme Escopo"}</span>
                        </div>
                        <div>
                          <strong>Período: </strong>
                          <span>{formatarPeriodoBR(v.dataInicial, v.dataFinal)}</span>
                        </div>
                        <div>
                          <strong>Agência / Emissão: </strong>
                          <span>{v.agenciaNome || v.agencia || "GSP Logística"}</span>
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        paddingTop: "12px",
                        borderTop: "1px dashed var(--border)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontSize: "12px",
                      }}
                    >
                      <span style={{ fontSize: "11px", color: "var(--on-surface-variant)" }}>Custo Total Logística:</span>
                      <strong style={{ color: "var(--primary)", fontSize: "14px" }}>
                        {brl(v.totalContratado || v.custoTotal || v.total || 0)}
                      </strong>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
