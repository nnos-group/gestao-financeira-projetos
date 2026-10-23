"use client";

import React from "react";
import ConsultorHeader from "@/components/ConsultorHeader";
import { useConsultor } from "@/contexts/ConsultorContext";

export default function ConsultorPagamentosPage() {
  const { consultorAtivo, dadosConsultor } = useConsultor();

  const brl = (val: number | null | undefined) =>
    (val || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const kpis = dadosConsultor?.kpis || { totalRepasse: 0 };
  const bms = dadosConsultor?.bms || [];

  return (
    <>
      <ConsultorHeader tituloPagina="Meus Pagamentos" />

      <main className="content-container" style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: "24px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 800, margin: 0, color: "var(--primary)" }}>
            Meus Pagamentos &amp; Repasses Contratuais
          </h1>
          <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "var(--on-surface-variant)" }}>
            Acompanhamento de repasses financeiros, cronograma de créditos e dados cadastrais de <strong>{consultorAtivo?.nome}</strong>.
          </p>
        </div>

        {/* Card do Cronograma Oficial */}
        <section
          style={{
            backgroundColor: "#f0fdf4",
            border: "1.5px solid #bbf7d0",
            borderRadius: "14px",
            padding: "20px 24px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
            <span className="material-symbols-outlined" style={{ color: "#16a34a", fontSize: "22px" }}>
              event_available
            </span>
            <h3 style={{ fontSize: "15px", fontWeight: 700, margin: 0, color: "#166534" }}>
              Cronograma Oficial de Faturamento &amp; Pagamento NNÓS
            </h3>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "14px", marginTop: "12px", fontSize: "13px", color: "#14532d" }}>
            <div style={{ padding: "12px 14px", borderRadius: "10px", backgroundColor: "#ffffff", border: "1px solid #bbf7d0" }}>
              <strong>1ª Quinzena:</strong>
              <div style={{ fontSize: "12px", marginTop: "4px", color: "#166534" }}>
                • Envio da NF até o <strong>dia 25</strong> do mês vigente.<br />
                • Previsão de Pagamento: Creditado no <strong>dia 10</strong> subsequente.
              </div>
            </div>

            <div style={{ padding: "12px 14px", borderRadius: "10px", backgroundColor: "#ffffff", border: "1px solid #bbf7d0" }}>
              <strong>Totalidade / Mês Cheio:</strong>
              <div style={{ fontSize: "12px", marginTop: "4px", color: "#166534" }}>
                • Envio da NF até o <strong>dia 10</strong> após emissão do BM.<br />
                • Previsão de Pagamento: Creditado no <strong>dia 25</strong> do mês corrente.
              </div>
            </div>
          </div>
        </section>

        {/* Resumo de Repasses e BMs Faturáveis */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px" }}>
          {/* Card Resumo Financeiro */}
          <section
            style={{
              backgroundColor: "var(--surface-container-lowest)",
              border: "1px solid var(--border)",
              borderRadius: "14px",
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span className="material-symbols-outlined" style={{ color: "var(--primary)" }}>
                account_balance_wallet
              </span>
              <h3 style={{ fontSize: "15px", fontWeight: 700, margin: 0, color: "var(--primary)" }}>
                Previsão de Repasses Apurados
              </h3>
            </div>

            <div>
              <span style={{ fontSize: "12px", color: "var(--on-surface-variant)" }}>Total Acumulado Contratual</span>
              <div style={{ fontSize: "28px", fontWeight: 800, color: "#059669", marginTop: "4px" }}>
                {brl(kpis.totalRepasse)}
              </div>
            </div>

            <div style={{ fontSize: "12px", color: "var(--on-surface-variant)", lineHeight: 1.5 }}>
              Os pagamentos são liberados após a validação da coordenação operacional e assinatura mútua do Boletim de Medição (BM).
            </div>
          </section>

          {/* Dados Bancários */}
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
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span className="material-symbols-outlined" style={{ color: "var(--primary)" }}>
                credit_card
              </span>
              <h3 style={{ fontSize: "15px", fontWeight: 700, margin: 0, color: "var(--primary)" }}>
                Dados Bancários para Crédito
              </h3>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px" }}>
              <div>
                <span style={{ fontSize: "11px", color: "var(--on-surface-variant)", display: "block" }}>Favorecido / Razão Social</span>
                <strong>{consultorAtivo?.razao_social || consultorAtivo?.nome}</strong>
              </div>
              <div>
                <span style={{ fontSize: "11px", color: "var(--on-surface-variant)", display: "block" }}>CNPJ / CPF</span>
                <strong>{consultorAtivo?.cnpj || consultorAtivo?.cpf || "Não informado"}</strong>
              </div>
              <div>
                <span style={{ fontSize: "11px", color: "var(--on-surface-variant)", display: "block" }}>Chave Pix Cadastrada</span>
                <strong style={{ color: "var(--primary)" }}>{consultorAtivo?.pix || consultorAtivo?.cnpj || "Conforme emissor da NF"}</strong>
              </div>
            </div>
          </section>
        </div>

        {/* Tabela de BMs e Status de Pagamento */}
        <section
          style={{
            backgroundColor: "var(--surface-container-lowest)",
            borderRadius: "14px",
            border: "1px solid var(--border)",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ fontSize: "15px", fontWeight: 700, margin: 0, color: "var(--primary)" }}>
              Boletins e Previsões de Pagamento
            </h3>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
            <thead>
              <tr style={{ backgroundColor: "var(--surface-container-low)", borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "12px 16px", fontWeight: 700, color: "var(--on-surface-variant)", fontSize: "11px", textTransform: "uppercase" }}>BM</th>
                <th style={{ padding: "12px 16px", fontWeight: 700, color: "var(--on-surface-variant)", fontSize: "11px", textTransform: "uppercase" }}>Competência</th>
                <th style={{ padding: "12px 16px", fontWeight: 700, color: "var(--on-surface-variant)", fontSize: "11px", textTransform: "uppercase" }}>Status do Workflow</th>
                <th style={{ padding: "12px 16px", fontWeight: 700, color: "var(--on-surface-variant)", fontSize: "11px", textTransform: "uppercase", textAlign: "right" }}>Valor Líquido</th>
              </tr>
            </thead>
            <tbody>
              {bms.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: "30px", textAlign: "center", color: "var(--on-surface-variant)" }}>
                    Nenhum BM faturável registrado.
                  </td>
                </tr>
              ) : (
                bms.map((bm: any, idx: number) => {
                  const isAprovado = bm.status?.includes("Aprovado");
                  return (
                    <tr key={bm.codigo || idx} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "14px 16px", fontWeight: 700, color: "var(--primary)" }}>
                        BM {bm.codigo}
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        {bm.mesReferencia}
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            padding: "3px 8px",
                            borderRadius: "999px",
                            backgroundColor: isAprovado ? "#dcfce7" : "#ffedd5",
                            color: isAprovado ? "#15803d" : "#c2410c",
                          }}
                        >
                          {bm.status}
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px", textAlign: "right", fontWeight: 700, color: "#059669" }}>
                        {brl(bm.valorLiquidoTotal)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </section>
      </main>
    </>
  );
}
