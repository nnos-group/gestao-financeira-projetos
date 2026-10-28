"use client";

import React from "react";
import Link from "next/link";
import ConsultorHeader from "@/components/ConsultorHeader";
import { useConsultor } from "@/contexts/ConsultorContext";
import { formatarPeriodoBR, formatarDataBR } from "@/lib/date-utils";

export default function ConsultorPage() {
  const { consultorAtivo, dadosConsultor, carregando } = useConsultor();

  const brl = (val: number | null | undefined) =>
    (val || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const kpis = dadosConsultor?.kpis || {
    totalHoras: 0,
    totalRepasse: 0,
    totalProjetos: 0,
    totalViagens: 0,
    totalBms: 0,
    bmsPendentes: 0,
  };

  const proximasAtividades = (dadosConsultor?.lancamentos || []).slice(0, 5);
  const ultimosBms = (dadosConsultor?.bms || []).slice(0, 3);
  const proximasViagens = (dadosConsultor?.viagens || []).slice(0, 3);

  return (
    <>
      <ConsultorHeader tituloPagina="Visão Geral" />

      <main className="content-container" style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: "24px" }}>
        {/* Banner de Boas-Vindas e Contexto do Consultor */}
        <section
          style={{
            backgroundColor: "var(--surface-container-lowest)",
            border: "1px solid var(--border)",
            color: "var(--on-surface)",
            padding: "24px 28px",
            borderRadius: "16px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "16px",
          }}
        >
          <div>
            <h1 style={{ fontSize: "24px", fontWeight: 800, margin: "0 0 6px 0", color: "var(--primary)", letterSpacing: "-0.02em" }}>
              Olá, {consultorAtivo?.nome || "Consultor"}!
            </h1>
            <p style={{ margin: 0, fontSize: "13px", color: "var(--on-surface-variant)", maxWidth: "600px", lineHeight: 1.5 }}>
              Acompanhe sua agenda operacional, viagens agendadas, boletins de medição e previsão de pagamentos em um único painel.
            </p>
          </div>

          <div
            style={{
              backgroundColor: "var(--surface-container-low)",
              padding: "14px 20px",
              borderRadius: "12px",
              border: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              fontSize: "12px",
              minWidth: "220px",
            }}
          >
            <div>
              <strong style={{ color: "var(--on-surface-variant)" }}>Empresa: </strong>
              <span style={{ fontWeight: 600, color: "var(--on-surface)" }}>{consultorAtivo?.razao_social || consultorAtivo?.nome}</span>
            </div>
            <div>
              <strong style={{ color: "var(--on-surface-variant)" }}>CNPJ: </strong>
              <span style={{ fontWeight: 600, color: "var(--on-surface)" }}>{consultorAtivo?.cnpj || "Pessoa Física"}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <strong style={{ color: "var(--on-surface-variant)" }}>Perfil: </strong>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 800,
                  padding: "2px 8px",
                  borderRadius: "6px",
                  backgroundColor: "#e0f2fe",
                  color: "#0369a1",
                  textTransform: "uppercase",
                }}
              >
                {consultorAtivo?.perfil || "SÊNIOR"}
              </span>
            </div>
          </div>
        </section>

        {/* 3 Cards de Métricas Operacionais */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "16px",
          }}
        >
          {/* Card 1: Horas Acumuladas */}
          <div className="kpi-card">
            <div className="kpi-content">
              <span className="kpi-label">HORAS APURADAS</span>
              <div className="kpi-value-row">
                <span className="kpi-value medium">{kpis.totalHoras.toFixed(1)} h</span>
              </div>
              <span style={{ fontSize: "11px", color: "var(--on-surface-variant)" }}>
                Atividades registradas no ciclo
              </span>
            </div>
            <div className="kpi-icon-box">
              <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>
                schedule
              </span>
            </div>
          </div>

          {/* Card 2: Previsão de Pagamento */}
          <div className="kpi-card">
            <div className="kpi-content">
              <span className="kpi-label">PREVISÃO DE PAGAMENTO</span>
              <div className="kpi-value-row">
                <span className="kpi-value medium" style={{ color: "#059669" }}>
                  {brl(kpis.totalRepasse)}
                </span>
              </div>
              <span style={{ fontSize: "11px", color: "var(--on-surface-variant)" }}>
                Estimativa contratual de honorários
              </span>
            </div>
            <div className="kpi-icon-box success-bg">
              <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>
                payments
              </span>
            </div>
          </div>

          {/* Card 3: Viagens e Deslocamentos */}
          <div className="kpi-card">
            <div className="kpi-content">
              <span className="kpi-label">VIAGENS &amp; LOGÍSTICA</span>
              <div className="kpi-value-row">
                <span className="kpi-value medium">{kpis.totalViagens}</span>
              </div>
              <span style={{ fontSize: "11px", color: "var(--on-surface-variant)" }}>
                Solicitações corporativas vinculadas
              </span>
            </div>
            <div className="kpi-icon-box tertiary-bg">
              <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>
                flight_takeoff
              </span>
            </div>
          </div>
        </section>

        {/* Grid de Conteúdo: Agenda Recente e BMs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: "20px" }}>
          {/* Coluna 1: Próximas Atividades na Agenda */}
          <section
            style={{
              backgroundColor: "var(--surface-container-lowest)",
              border: "1px solid var(--border)",
              borderRadius: "14px",
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              gap: "14px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span className="material-symbols-outlined" style={{ color: "var(--primary)" }}>
                  calendar_month
                </span>
                <h3 style={{ fontSize: "15px", fontWeight: 700, margin: 0, color: "var(--primary)" }}>
                  Próximas Atividades na Agenda
                </h3>
              </div>
              <Link href="/consultor/agenda" style={{ fontSize: "12px", color: "var(--primary)", fontWeight: 700, textDecoration: "none" }}>
                Ver Agenda Completa →
              </Link>
            </div>

            {proximasAtividades.length === 0 ? (
              <div style={{ padding: "30px", textAlign: "center", color: "var(--on-surface-variant)", fontSize: "13px" }}>
                Nenhuma atividade agendada no momento para este consultor.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {proximasAtividades.map((atv, idx) => (
                  <div
                    key={atv.id || idx}
                    style={{
                      padding: "12px 14px",
                      borderRadius: "10px",
                      backgroundColor: "var(--surface-container-low)",
                      border: "1px solid var(--border)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "13px", color: "var(--primary)" }}>
                        {atv.projetos?.nome || "Projeto"}
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--on-surface-variant)", marginTop: "2px" }}>
                        {atv.atividade || "Execução de Atividade"} • {atv.local || atv.modalidade || "Presencial"}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          padding: "3px 8px",
                          borderRadius: "6px",
                          backgroundColor: "#e0f2fe",
                          color: "#0369a1",
                          display: "inline-block",
                        }}
                      >
                        {formatarPeriodoBR(atv.data_inicial, atv.data_final)}
                      </span>
                      <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--on-surface-variant)", marginTop: "4px" }}>
                        {atv.horas ? `${atv.horas}h` : "8h"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Coluna 2: Meus Boletins de Medição (BMs) */}
          <section
            style={{
              backgroundColor: "var(--surface-container-lowest)",
              border: "1px solid var(--border)",
              borderRadius: "14px",
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              gap: "14px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span className="material-symbols-outlined" style={{ color: "var(--primary)" }}>
                  receipt_long
                </span>
                <h3 style={{ fontSize: "15px", fontWeight: 700, margin: 0, color: "var(--primary)" }}>
                  Meus Boletins de Medição (BMs)
                </h3>
              </div>
              <Link href="/consultor/bms" style={{ fontSize: "12px", color: "var(--primary)", fontWeight: 700, textDecoration: "none" }}>
                Ver Todos os BMs →
              </Link>
            </div>

            {ultimosBms.length === 0 ? (
              <div style={{ padding: "30px", textAlign: "center", color: "var(--on-surface-variant)", fontSize: "13px" }}>
                Nenhum Boletim de Medição emitido para este consultor.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {ultimosBms.map((bm, idx) => {
                  const isAprovado = bm.status?.includes("Aprovado");
                  return (
                    <div
                      key={bm.codigo || idx}
                      style={{
                        padding: "14px 16px",
                        borderRadius: "10px",
                        backgroundColor: "var(--surface-container-low)",
                        border: "1px solid var(--border)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontWeight: 800, fontSize: "14px", color: "var(--primary)" }}>
                            BM {bm.codigo}
                          </span>
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: 700,
                              padding: "2px 8px",
                              borderRadius: "999px",
                              backgroundColor: isAprovado ? "#dcfce7" : "#ffedd5",
                              color: isAprovado ? "#15803d" : "#c2410c",
                            }}
                          >
                            {bm.status}
                          </span>
                        </div>
                        <div style={{ fontSize: "12px", color: "var(--on-surface-variant)", marginTop: "4px" }}>
                          Referência: {bm.mesReferencia} • {(bm.totalHoras || bm.horasTotal) ? `${bm.totalHoras || bm.horasTotal}h` : ""}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontWeight: 700, fontSize: "14px", color: "#059669" }}>
                          {brl(bm.valorTotal ?? bm.valorLiquidoTotal)}
                        </div>
                        <a
                          href={`/consultor/bms`}
                          style={{
                            fontSize: "11px",
                            color: "var(--primary)",
                            fontWeight: 700,
                            textDecoration: "underline",
                            marginTop: "4px",
                            display: "inline-block",
                          }}
                        >
                          Visualizar BM
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* Card de Dados Cadastrais & Empresa Prestadora */}
        <section
          style={{
            backgroundColor: "var(--surface-container-lowest)",
            border: "1px solid var(--border)",
            borderRadius: "14px",
            padding: "20px 24px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
            <span className="material-symbols-outlined" style={{ color: "var(--primary)" }}>
              badge
            </span>
            <h3 style={{ fontSize: "15px", fontWeight: 700, margin: 0, color: "var(--primary)" }}>
              Dados Cadastrais &amp; Conta Bancária p/ Pagamentos
            </h3>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "14px",
              fontSize: "13px",
            }}
          >
            <div>
              <span style={{ fontSize: "11px", color: "var(--on-surface-variant)", display: "block" }}>Nome Completo</span>
              <strong>{consultorAtivo?.nome_completo || consultorAtivo?.nome}</strong>
            </div>
            <div>
              <span style={{ fontSize: "11px", color: "var(--on-surface-variant)", display: "block" }}>E-mail de Contato</span>
              <strong>{consultorAtivo?.email}</strong>
            </div>
            <div>
              <span style={{ fontSize: "11px", color: "var(--on-surface-variant)", display: "block" }}>Cidade Base / Aeroporto</span>
              <strong>{consultorAtivo?.cidade_base || "BH / MG"} ({consultorAtivo?.aeroporto_preferencial || "CNF"})</strong>
            </div>
            <div>
              <span style={{ fontSize: "11px", color: "var(--on-surface-variant)", display: "block" }}>Chave Pix Cadastrada</span>
              <strong style={{ color: "var(--primary)" }}>{consultorAtivo?.pix || consultorAtivo?.cnpj || "Conforme Nota Fiscal"}</strong>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
