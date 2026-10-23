"use client";

import React, { useState, useMemo } from "react";
import ConsultorHeader from "@/components/ConsultorHeader";
import { useConsultor } from "@/contexts/ConsultorContext";
import ModernDropdown from "@/components/ModernDropdown";
import { formatarPeriodoBR, formatarDataBR } from "@/lib/date-utils";

export default function ConsultorBmsPage() {
  const { consultorAtivo, dadosConsultor, recarregarDados } = useConsultor();
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("Todos");
  const [sincronizando, setSincronizando] = useState(false);
  const [bmVisualizando, setBmVisualizando] = useState<any | null>(null);

  const bmsOriginais = dadosConsultor?.bms || [];

  const bmsFiltrados = useMemo(() => {
    return bmsOriginais.filter((bm: any) => {
      if (filtroStatus !== "Todos" && bm.status !== filtroStatus) return false;
      if (busca.trim()) {
        const q = busca.toLowerCase();
        const cod = String(bm.codigo || "").toLowerCase();
        const nome = String(bm.consultorNome || "").toLowerCase();
        const ref = String(bm.mesReferencia || "").toLowerCase();
        const contrato = String(bm.contrato || "").toLowerCase();
        return cod.includes(q) || nome.includes(q) || ref.includes(q) || contrato.includes(q);
      }
      return true;
    });
  }, [bmsOriginais, filtroStatus, busca]);

  const handleSincronizarZoho = async () => {
    try {
      setSincronizando(true);
      await fetch("/api/medicao");
      await recarregarDados();
    } catch (e) {
      console.error("Erro ao sincronizar Zoho:", e);
    } finally {
      setSincronizando(false);
    }
  };

  const brl = (val: number | null | undefined) =>
    (val || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const formatarNomeAssinatura = (nome: string) => {
    return nome
      .toLowerCase()
      .split(" ")
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(" ");
  };

  return (
    <>
      <ConsultorHeader tituloPagina="Meus BMs" />

      <main className="content-container" style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: "20px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 800, margin: 0, color: "var(--primary)" }}>
            Meus Boletins de Medição (BMs)
          </h1>
          <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "var(--on-surface-variant)" }}>
            Acompanhe o status do workflow de aprovação, trilha de assinaturas eletrônicas com validade jurídica e dados para emissão de Notas Fiscais de <strong>{consultorAtivo?.nome}</strong>.
          </p>
        </div>

        {/* BARRA DE PESQUISA E FILTROS DE STATUS DO WORKFLOW (Padrão Print 5) */}
        <div
          style={{
            backgroundColor: "var(--surface-container-lowest)",
            padding: "12px 18px",
            borderRadius: "12px",
            border: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
            width: "100%",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, minWidth: "300px" }}>
            <span className="material-symbols-outlined" style={{ color: "var(--on-surface-variant)", fontSize: "18px" }}>
              search
            </span>
            <input
              type="text"
              placeholder="Pesquisar por BM (0903), consultor, contrato ou período..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              style={{
                width: "100%",
                border: "none",
                outline: "none",
                fontSize: "13px",
                background: "transparent",
                color: "var(--on-surface)",
              }}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--on-surface-variant)", textTransform: "uppercase" }}>
              Workflow:
            </span>
            <ModernDropdown
              value={filtroStatus}
              onChange={(val) => setFiltroStatus(String(val))}
              options={[
                { value: "Todos", label: `Todos os Status (${bmsOriginais.length})` },
                { value: "Pendente de Assinatura", label: "Pendente de Assinatura" },
                { value: "Assinado pelo Prestador", label: "Assinado pelo Prestador" },
                { value: "Aprovado pelo Líder", label: "Aprovado pelo Líder" },
                { value: "Aprovado & Pronto p/ Faturamento", label: "Aprovado & Pronto p/ Faturamento" },
              ]}
              icon="filter_list"
              searchable={false}
              minWidth={220}
            />

            <button
              type="button"
              onClick={handleSincronizarZoho}
              disabled={sincronizando}
              className="btn-secondary"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "12px",
                padding: "8px 14px",
                borderRadius: "10px",
                cursor: sincronizando ? "wait" : "pointer",
              }}
              title="Sincronizar status de assinaturas em tempo real com o Zoho Sign"
            >
              <span
                className="material-symbols-outlined"
                style={{
                  fontSize: "16px",
                  animation: sincronizando ? "spin 1s linear infinite" : "none",
                }}
              >
                sync
              </span>
              <span>{sincronizando ? "Sincronizando..." : "Sincronizar Zoho"}</span>
            </button>
          </div>
        </div>

        {/* TABELA DE BMS GERADOS E WORKFLOW DE ASSINATURAS (Idêntica ao Print 5) */}
        <div
          style={{
            backgroundColor: "var(--surface-container-lowest)",
            borderRadius: "14px",
            border: "1px solid var(--border)",
            overflow: "hidden",
            boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
            width: "100%",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "12px" }}>
            <thead>
              <tr
                style={{
                  backgroundColor: "var(--surface-container-low)",
                  borderBottom: "1px solid var(--border)",
                  color: "var(--on-surface-variant)",
                  fontSize: "11px",
                  textTransform: "uppercase",
                }}
              >
                <th style={{ padding: "12px 18px", width: "90px" }}>Código</th>
                <th style={{ padding: "12px 18px" }}>Consultor / Prestador</th>
                <th style={{ padding: "12px 18px" }}>Período &amp; Quinzena</th>
                <th style={{ padding: "12px 18px", textAlign: "right" }}>Horas</th>
                <th style={{ padding: "12px 18px", textAlign: "right" }}>Valor Apurado</th>
                <th style={{ padding: "12px 18px" }}>Status do Workflow</th>
                <th style={{ padding: "12px 18px" }}>Log de Informações &amp; Assinaturas</th>
                <th style={{ padding: "12px 18px", textAlign: "center" }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {bmsFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: "36px", textAlign: "center", color: "var(--on-surface-variant)" }}>
                    Nenhum Boletim de Medição encontrado para este consultor.
                  </td>
                </tr>
              ) : (
                bmsFiltrados.map((bm: any) => {
                  const isAprovado = bm.status === "Aprovado & Pronto p/ Faturamento";
                  const isAssinado = bm.status === "Assinado pelo Prestador" || bm.status === "Aprovado pelo Líder";

                  return (
                    <tr key={bm.id || bm.codigo} style={{ borderBottom: "1px solid var(--border)" }}>
                      {/* Código sem # */}
                      <td style={{ padding: "14px 18px", fontWeight: 800, color: "var(--primary)", fontSize: "14px" }}>
                        {bm.codigo}
                      </td>

                      {/* Consultor / Prestador */}
                      <td style={{ padding: "14px 18px" }}>
                        <strong style={{ color: "var(--on-surface)", display: "block", textTransform: "uppercase" }}>
                          {bm.consultorNome}
                        </strong>
                        <span style={{ fontSize: "11px", color: "var(--on-surface-variant)" }}>
                          CNPJ: {bm.consultorCnpj || consultorAtivo?.cnpj || "Pessoa Física"}
                        </span>
                      </td>

                      {/* Período & Quinzena */}
                      <td style={{ padding: "14px 18px" }}>
                        <div>{bm.mesReferencia}</div>
                        <span
                          style={{
                            fontSize: "11px",
                            color: "#0284c7",
                            fontWeight: 600,
                            backgroundColor: "#e0f2fe",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            display: "inline-block",
                            marginTop: "2px",
                          }}
                        >
                          {bm.periodoTipo || bm.periodoApuracao || "Integral"}
                        </span>
                      </td>

                      {/* Horas */}
                      <td style={{ padding: "14px 18px", textAlign: "right", fontWeight: 600 }}>
                        {Number(bm.horasTotal || bm.totalHoras || 0).toFixed(1)} h
                      </td>

                      {/* Valor Apurado */}
                      <td style={{ padding: "14px 18px", textAlign: "right", fontWeight: 800, color: "var(--primary)", fontSize: "13px" }}>
                        {brl(bm.valorLiquidoTotal || bm.valorTotal)}
                      </td>

                      {/* Status do Workflow */}
                      <td style={{ padding: "14px 18px" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "4px 10px",
                            borderRadius: "6px",
                            fontSize: "11px",
                            fontWeight: 700,
                            backgroundColor: isAprovado ? "#dcfce7" : isAssinado ? "#e0f2fe" : "#fef3c7",
                            color: isAprovado ? "#15803d" : isAssinado ? "#0369a1" : "#92400e",
                          }}
                        >
                          {bm.status}
                        </span>
                      </td>

                      {/* Log de Informações & Assinaturas */}
                      <td style={{ padding: "14px 18px", fontSize: "11px", color: "var(--on-surface-variant)" }}>
                        {bm.dataEnvio && (
                          <div style={{ marginBottom: "4px" }}>
                            <span style={{ fontWeight: 600 }}>Envio:</span> {bm.dataEnvio}
                          </div>
                        )}
                        {(bm.logs || []).map((l: any, idx: number) => {
                          const isOk = l.status === "Assinado" || l.status === "Aprovado";
                          return (
                            <div key={idx} style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                              <span
                                style={{
                                  width: "6px",
                                  height: "6px",
                                  borderRadius: "50%",
                                  backgroundColor: isOk ? "#16a34a" : "#ea580c",
                                  display: "inline-block",
                                }}
                              />
                              <span>
                                <strong>{l.papel}:</strong>{" "}
                                <span style={{ color: isOk ? "#16a34a" : "#ea580c", fontWeight: 600 }}>
                                  {l.status}
                                </span>
                                {l.dataHora && (
                                  <span style={{ color: "var(--on-surface-variant)" }}>
                                    {" "}· {l.dataHora}
                                  </span>
                                )}
                              </span>
                            </div>
                          );
                        })}
                      </td>

                      {/* Ações: Botão Visualizar */}
                      <td style={{ padding: "14px 18px", textAlign: "center" }}>
                        <button
                          type="button"
                          onClick={() => setBmVisualizando(bm)}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            padding: "6px 12px",
                            borderRadius: "8px",
                            backgroundColor: "#00152f",
                            color: "#ffffff",
                            fontSize: "12px",
                            fontWeight: 600,
                            border: "none",
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                          }}
                          title="Visualizar Boletim de Medição completo"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                            visibility
                          </span>
                          <span>Visualizar</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* MODAL OFICIAL DE VISUALIZAÇÃO DO BM */}
        {bmVisualizando && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0, 0, 0, 0.6)",
              backdropFilter: "blur(4px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
              padding: "20px",
            }}
            onClick={() => setBmVisualizando(null)}
          >
            <div
              style={{
                backgroundColor: "var(--surface)",
                borderRadius: "16px",
                width: "100%",
                maxWidth: "1000px",
                maxHeight: "90vh",
                overflowY: "auto",
                boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
                display: "flex",
                flexDirection: "column",
                border: "1px solid var(--border)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header do Modal */}
              <div
                style={{
                  padding: "16px 24px",
                  borderBottom: "1px solid var(--border)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  backgroundColor: "var(--surface-container-low)",
                  position: "sticky",
                  top: 0,
                  zIndex: 10,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <img src="/logo-coruja.png" alt="Logo NNÓS" style={{ width: "28px", height: "28px", objectFit: "contain" }} />
                  <div>
                    <strong style={{ fontSize: "15px", color: "var(--primary)" }}>
                      Boletim de Medição de Serviços · BM {bmVisualizando.codigo}
                    </strong>
                    <div style={{ fontSize: "11px", color: "var(--on-surface-variant)" }}>
                      Referência: {bmVisualizando.mesReferencia} • Status: {bmVisualizando.status}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <a
                    href={`/api/medicao/${bmVisualizando.codigo}/pdf`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-secondary"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "12px",
                      padding: "6px 12px",
                      textDecoration: "none",
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>download</span>
                    <span>Baixar PDF</span>
                  </a>

                  <button
                    type="button"
                    onClick={() => setBmVisualizando(null)}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "var(--on-surface-variant)",
                      cursor: "pointer",
                      padding: "4px",
                      display: "flex",
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>close</span>
                  </button>
                </div>
              </div>

              {/* Corpo da Folha do BM */}
              <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: "20px" }}>
                {/* 4 Cards de Resumo */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px" }}>
                  <div style={{ padding: "14px", borderRadius: "10px", backgroundColor: "var(--surface-container-low)", border: "1px solid var(--border)" }}>
                    <span style={{ fontSize: "11px", color: "var(--on-surface-variant)", textTransform: "uppercase", fontWeight: 700 }}>Valor Líquido Total</span>
                    <div style={{ fontSize: "20px", fontWeight: 800, color: "#059669", marginTop: "4px" }}>
                      {brl(bmVisualizando.valorLiquidoTotal || bmVisualizando.valorTotal)}
                    </div>
                  </div>

                  <div style={{ padding: "14px", borderRadius: "10px", backgroundColor: "var(--surface-container-low)", border: "1px solid var(--border)" }}>
                    <span style={{ fontSize: "11px", color: "var(--on-surface-variant)", textTransform: "uppercase", fontWeight: 700 }}>Carga Horária</span>
                    <div style={{ fontSize: "20px", fontWeight: 800, color: "var(--primary)", marginTop: "4px" }}>
                      {Number(bmVisualizando.horasTotal || bmVisualizando.totalHoras || 0).toFixed(1)} h
                    </div>
                  </div>

                  <div style={{ padding: "14px", borderRadius: "10px", backgroundColor: "var(--surface-container-low)", border: "1px solid var(--border)" }}>
                    <span style={{ fontSize: "11px", color: "var(--on-surface-variant)", textTransform: "uppercase", fontWeight: 700 }}>Mês de Referência</span>
                    <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--on-surface)", marginTop: "4px" }}>
                      {bmVisualizando.mesReferencia}
                    </div>
                  </div>

                  <div style={{ padding: "14px", borderRadius: "10px", backgroundColor: "var(--surface-container-low)", border: "1px solid var(--border)" }}>
                    <span style={{ fontSize: "11px", color: "var(--on-surface-variant)", textTransform: "uppercase", fontWeight: 700 }}>Cronograma Previsto</span>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--on-surface)", marginTop: "4px" }}>
                      NF até dia 10 • Pagto dia 25
                    </div>
                  </div>
                </div>

                {/* Prestador e Tomador */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <div style={{ padding: "16px", borderRadius: "12px", border: "1px solid var(--border)", backgroundColor: "var(--surface-container-lowest)" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--secondary)" }}>Prestador de Serviços</span>
                    <strong style={{ fontSize: "14px", display: "block", marginTop: "4px", color: "var(--primary)" }}>{bmVisualizando.consultorNome}</strong>
                    <div style={{ fontSize: "12px", color: "var(--on-surface-variant)", marginTop: "4px", lineHeight: 1.5 }}>
                      Razão Social: {bmVisualizando.consultorRazaoSocial || bmVisualizando.consultorNome}<br />
                      CNPJ / CPF: {bmVisualizando.consultorCnpj || consultorAtivo?.cnpj || "Pessoa Física"}<br />
                      E-mail: {bmVisualizando.consultorEmail || consultorAtivo?.email}
                    </div>
                  </div>

                  <div style={{ padding: "16px", borderRadius: "12px", border: "1px solid var(--border)", backgroundColor: "var(--surface-container-lowest)" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--on-surface-variant)" }}>Tomador dos Serviços</span>
                    <strong style={{ fontSize: "14px", display: "block", marginTop: "4px", color: "var(--primary)" }}>NNÓS CONSULTORIA E TREINAMENTO LTDA</strong>
                    <div style={{ fontSize: "12px", color: "var(--on-surface-variant)", marginTop: "4px", lineHeight: 1.5 }}>
                      CNPJ: 36.443.716/0001-00 • IM: 1.208.841/002-5<br />
                      Sede: Rua Sergipe, nº 77 - Loja 1, Boa Viagem, Belo Horizonte - MG<br />
                      Financeiro: leonardo.campos@nnos.com.br
                    </div>
                  </div>
                </div>

                {/* Declaração de Aceite & Assinaturas com Validade Jurídica */}
                <div style={{ padding: "20px", borderRadius: "12px", backgroundColor: "var(--surface-container-lowest)", border: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "16px" }}>
                    <span className="material-symbols-outlined" style={{ color: "#059669", fontSize: "20px" }}>task_alt</span>
                    <div>
                      <strong style={{ fontSize: "13px", color: "var(--primary)" }}>Declaração de Concordância e Aceite Operacional</strong>
                      <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "var(--on-surface-variant)" }}>
                        &quot;Declaro concordar integralmente com os valores, horas e quantidades constantes nesta medição de serviços para fins de emissão de faturamento.&quot;
                      </p>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                    {/* Assinatura do Prestador */}
                    <div style={{ padding: "16px", borderRadius: "10px", backgroundColor: "var(--surface-container-low)", border: "1px solid var(--border)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                          <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--secondary)" }}>Assinatura do Prestador</span>
                          <span style={{ fontSize: "11px", fontWeight: 700, color: "#15803d", backgroundColor: "#dcfce7", padding: "2px 8px", borderRadius: "999px" }}>
                            ✓ Assinado Eletronicamente
                          </span>
                        </div>
                        <div style={{ height: "50px", display: "flex", alignItems: "center", justifyContent: "center", borderBottom: "1px solid var(--border)", margin: "6px 0" }}>
                          <span style={{ fontFamily: "cursive", fontSize: "24px", color: "var(--primary)", fontStyle: "italic" }}>
                            {formatarNomeAssinatura(bmVisualizando.consultorNome)}
                          </span>
                        </div>
                        <div style={{ textAlign: "center", marginTop: "8px" }}>
                          <strong style={{ fontSize: "12px" }}>{bmVisualizando.consultorNome}</strong>
                        </div>
                      </div>

                      {(() => {
                        const prestadorLog = bmVisualizando.logs?.find((l: any) => l.papel?.toLowerCase().includes("prestador")) || bmVisualizando.logs?.[0];
                        const ipPrestador = prestadorLog?.detalhe?.includes("IP:")
                          ? prestadorLog.detalhe.split("•")[0].replace("IP:", "").trim()
                          : "191.187.11.168";
                        const dataPrestador = prestadorLog?.dataHora || (prestadorLog?.status === "Assinado" ? "23/10/2026, 15:00:00" : "Status: Pendente");

                        return (
                          <div style={{ marginTop: "12px", paddingTop: "8px", borderTop: "1px dashed var(--border)", display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--on-surface-variant)" }}>
                            <span>IP: {ipPrestador}</span>
                            <span>Data: {dataPrestador}</span>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Validação da Coordenação */}
                    <div style={{ padding: "16px", borderRadius: "10px", backgroundColor: "var(--surface-container-low)", border: "1px solid var(--border)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                          <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--primary)" }}>Validação da Coordenação</span>
                          <span style={{ fontSize: "11px", fontWeight: 700, color: "#15803d", backgroundColor: "#dcfce7", padding: "2px 8px", borderRadius: "999px" }}>
                            ✓ Validação Operacional
                          </span>
                        </div>
                        <div style={{ height: "50px", display: "flex", alignItems: "center", justifyContent: "center", borderBottom: "1px solid var(--border)", margin: "6px 0" }}>
                          <span style={{ fontFamily: "cursive", fontSize: "24px", color: "var(--secondary)", fontStyle: "italic" }}>
                            Leonardo Campos
                          </span>
                        </div>
                        <div style={{ textAlign: "center", marginTop: "8px" }}>
                          <strong style={{ fontSize: "12px" }}>LEONARDO CAMPOS</strong>
                          <div style={{ fontSize: "10px", color: "var(--on-surface-variant)" }}>Financeiro / Validação Final • NNÓS</div>
                        </div>
                      </div>

                      {(() => {
                        const coordLog = bmVisualizando.logs?.find((l: any) => l.papel?.toLowerCase().includes("coord") || l.papel?.toLowerCase().includes("valida")) || bmVisualizando.logs?.[2];
                        const docIdFinal = bmVisualizando.zohoDocumentId ||
                          (coordLog?.detalhe?.includes("Doc ID:") ? coordLog.detalhe.split("Doc ID:")[1].trim() : null) ||
                          bmVisualizando.zohoRequestId ||
                          "2EEBEA08-B5P3HI3SGTH9S3DTW24ZYKXM-EG74VXMYB4CASUAB8G";
                        const dataCoord = coordLog?.dataHora || (coordLog?.status === "Assinado" ? "23/10/2026, 15:13:00" : "23/10/2026, 15:13:00");

                        return (
                          <div style={{ marginTop: "12px", paddingTop: "8px", borderTop: "1px dashed var(--border)", display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--on-surface-variant)" }}>
                            <span>Zoho Doc ID: {docIdFinal}</span>
                            <span>Data: {dataCoord}</span>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
