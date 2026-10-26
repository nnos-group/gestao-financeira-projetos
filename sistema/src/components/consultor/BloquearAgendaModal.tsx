"use client";

import React, { useState } from "react";
import { AgendaBloqueio } from "@/lib/agenda-bloqueios";
import { formatarPeriodoBR, formatarDataHoraBR } from "@/lib/date-utils";

interface BloquearAgendaModalProps {
  consultorNome: string;
  consultorId?: string;
  bloqueios: AgendaBloqueio[];
  onClose: () => void;
  onAtualizar: () => Promise<void>;
  showToast: (msg: string) => void;
}

export default function BloquearAgendaModal({
  consultorNome,
  consultorId,
  bloqueios,
  onClose,
  onAtualizar,
  showToast,
}: BloquearAgendaModalProps) {
  const [dataInicial, setDataInicial] = useState("");
  const [dataFinal, setDataFinal] = useState("");
  const [tipo, setTipo] = useState<AgendaBloqueio["tipo"]>("OFF");
  const [motivo, setMotivo] = useState("Momento OFF / Pessoal");
  const [observacoes, setObservacoes] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [removendoId, setRemovendoId] = useState<string | null>(null);

  const motivosPredefinidos: { rotulo: string; tipo: AgendaBloqueio["tipo"] }[] = [
    { rotulo: "Momento OFF / Pessoal", tipo: "OFF" },
    { rotulo: "Férias / Recesso", tipo: "FERIAS" },
    { rotulo: "Outra Atividade / Treinamento Externo", tipo: "OUTRA_ATIVIDADE" },
    { rotulo: "Compromisso Particular / Médico", tipo: "PARTICULAR" },
    { rotulo: "Indisponibilidade Operacional", tipo: "OUTRO" },
  ];

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dataInicial || !dataFinal || !motivo.trim()) {
      showToast("⚠️ Preencha as datas e o motivo do bloqueio.");
      return;
    }

    if (dataInicial > dataFinal) {
      showToast("⚠️ A data inicial não pode ser posterior à data final.");
      return;
    }

    try {
      setSalvando(true);
      const res = await fetch("/api/consultor/bloqueios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consultorNome,
          consultorId,
          dataInicial,
          dataFinal,
          tipo,
          motivo,
          observacoes,
        }),
      });

      const data = await res.json();
      if (!data.ok) throw new Error(data.error);

      showToast("Período bloqueado com sucesso na sua agenda!");
      await onAtualizar();
      setDataInicial("");
      setDataFinal("");
      setObservacoes("");
    } catch (err: any) {
      showToast(`Erro ao bloquear agenda: ${err.message}`);
    } finally {
      setSalvando(false);
    }
  };

  const handleRemover = async (id: string) => {
    if (!confirm("Deseja realmente remover este bloqueio de agenda?")) return;

    try {
      setRemovendoId(id);
      const res = await fetch(`/api/consultor/bloqueios?id=${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);

      showToast("Bloqueio removido com sucesso.");
      await onAtualizar();
    } catch (err: any) {
      showToast(`Erro ao remover bloqueio: ${err.message}`);
    } finally {
      setRemovendoId(null);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(15, 23, 42, 0.7)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "680px",
          maxHeight: "92vh",
          backgroundColor: "#ffffff",
          borderRadius: "16px",
          border: "1px solid var(--border)",
          boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header do Modal */}
        <div
          style={{
            padding: "18px 24px",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "#f8fafc",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "38px",
                height: "38px",
                borderRadius: "10px",
                backgroundColor: "#fee2e2",
                color: "#dc2626",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>
                event_busy
              </span>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#0f172a" }}>
                Bloquear Período na Agenda
              </h3>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#64748b" }}>
                Consultor: <strong style={{ color: "#0f2a4a" }}>{consultorNome}</strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "#94a3b8",
              padding: "4px",
              display: "flex",
              alignItems: "center",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>close</span>
          </button>
        </div>

        {/* Corpo do Modal com Scroll */}
        <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "20px" }}>
          <div
            style={{
              backgroundColor: "#fef3c7",
              border: "1px solid #fde68a",
              borderRadius: "10px",
              padding: "12px 16px",
              fontSize: "12.5px",
              color: "#92400e",
              lineHeight: 1.5,
              display: "flex",
              alignItems: "flex-start",
              gap: "10px",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "20px", color: "#d97706", flexShrink: 0 }}>
              info
            </span>
            <div>
              <strong>Como funciona o bloqueio:</strong> Quando o Líder de Projeto for agendar uma atividade em Projetos &amp; Atividades que coincida com o período bloqueado, o sistema alertará que você está indisponível para aquela data.
            </div>
          </div>

          {/* Formulário de Novo Bloqueio */}
          <form onSubmit={handleSalvar} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                  Data Inicial *
                </label>
                <input
                  type="date"
                  value={dataInicial}
                  onChange={(e) => setDataInicial(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "13px",
                    color: "#0f172a",
                    backgroundColor: "#ffffff",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                  Data Final *
                </label>
                <input
                  type="date"
                  value={dataFinal}
                  onChange={(e) => setDataFinal(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "13px",
                    color: "#0f172a",
                    backgroundColor: "#ffffff",
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                Motivo / Tipo de Bloqueio *
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "8px" }}>
                {motivosPredefinidos.map((m) => {
                  const sel = motivo === m.rotulo;
                  return (
                    <button
                      key={m.rotulo}
                      type="button"
                      onClick={() => {
                        setMotivo(m.rotulo);
                        setTipo(m.tipo);
                      }}
                      style={{
                        padding: "5px 10px",
                        borderRadius: "20px",
                        fontSize: "11px",
                        fontWeight: 700,
                        border: sel ? "1px solid #dc2626" : "1px solid #cbd5e1",
                        backgroundColor: sel ? "#dc2626" : "#f8fafc",
                        color: sel ? "#ffffff" : "#475569",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {m.rotulo}
                    </button>
                  );
                })}
              </div>
              <input
                type="text"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ex: Momento OFF / Pessoal, Viagem, etc."
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  fontSize: "13px",
                  color: "#0f172a",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                Observações Adicionais (Opcional)
              </label>
              <textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Detalhes visíveis para a coordenação ao tentar agendar..."
                rows={2}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  fontSize: "12.5px",
                  color: "#0f172a",
                  resize: "vertical",
                }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="submit"
                disabled={salvando}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "9px 20px",
                  borderRadius: "8px",
                  backgroundColor: "#dc2626",
                  color: "#ffffff",
                  border: "none",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: "0 2px 6px rgba(220, 38, 38, 0.25)",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "17px" }}>lock</span>
                <span>{salvando ? "Bloqueando..." : "Confirmar Bloqueio"}</span>
              </button>
            </div>
          </form>

          {/* Lista de Bloqueios Cadastrados */}
          <div style={{ marginTop: "10px", borderTop: "1px solid #e2e8f0", paddingTop: "16px" }}>
            <h4 style={{ margin: "0 0 10px 0", fontSize: "13px", fontWeight: 800, color: "#1e293b", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Seus Bloqueios Registrados ({bloqueios.length})
            </h4>

            {bloqueios.length === 0 ? (
              <p style={{ margin: 0, fontSize: "12px", color: "#64748b", fontStyle: "italic" }}>
                Nenhum período de bloqueio cadastrado para este consultor.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {bloqueios.map((b) => (
                  <div
                    key={b.id}
                    style={{
                      padding: "10px 14px",
                      borderRadius: "10px",
                      backgroundColor: "#fff1f2",
                      border: "1px solid #fecdd3",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "12px",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#e11d48" }}>
                          event_busy
                        </span>
                        <strong style={{ fontSize: "13px", color: "#9f1239" }}>
                          {formatarPeriodoBR(b.dataInicial, b.dataFinal)}
                        </strong>
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: 700,
                            padding: "1px 6px",
                            borderRadius: "4px",
                            backgroundColor: "rgba(225, 29, 72, 0.15)",
                            color: "#9f1239",
                          }}
                        >
                          {b.motivo}
                        </span>
                      </div>
                      {b.observacoes && (
                        <p style={{ margin: "3px 0 0 24px", fontSize: "11.5px", color: "#64748b" }}>
                          {b.observacoes}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={removendoId === b.id}
                      onClick={() => handleRemover(b.id)}
                      style={{
                        padding: "4px 8px",
                        borderRadius: "6px",
                        backgroundColor: "#ffffff",
                        border: "1px solid #fecdd3",
                        color: "#e11d48",
                        fontSize: "11px",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                      title="Excluir este bloqueio"
                    >
                      {removendoId === b.id ? "Removendo..." : "Desbloquear"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
