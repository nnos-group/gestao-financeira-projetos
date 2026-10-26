"use client";

import React, { useState } from "react";
import { AgendaBloqueio } from "@/lib/agenda-bloqueios";
import { formatarPeriodoBR } from "@/lib/date-utils";

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
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 1050 }}>
      <div
        className="modal-card"
        style={{ maxWidth: "660px", maxHeight: "92vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header do Modal com Design System Moderno (Print 3) */}
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                backgroundColor: "#fee2e2",
                color: "#dc2626",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
                event_busy
              </span>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "var(--primary)" }}>
                Bloquear Período na Agenda
              </h3>
              <p style={{ margin: "2px 0 0 0", fontSize: "11.5px", color: "var(--on-surface-variant)" }}>
                Consultor: <strong style={{ color: "var(--on-surface)" }}>{consultorNome}</strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            className="btn-modal-close"
            onClick={onClose}
            title="Fechar modal"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Formulário com Scroll Body */}
        <form
          onSubmit={handleSalvar}
          style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}
        >
          <div className="modal-body" style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
            {/* Caixa Informativa Moderna */}
            <div
              style={{
                backgroundColor: "#fffbeb",
                border: "1px solid #fde68a",
                borderRadius: "12px",
                padding: "12px 16px",
                fontSize: "12.5px",
                color: "#92400e",
                lineHeight: 1.5,
                display: "flex",
                alignItems: "flex-start",
                gap: "10px",
                marginBottom: "4px",
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: "20px", color: "#d97706", flexShrink: 0, marginTop: "1px" }}
              >
                info
              </span>
              <div>
                <strong style={{ color: "#78350f" }}>Como funciona o bloqueio:</strong> Quando o Líder de Projeto for agendar uma atividade em Projetos &amp; Atividades que coincida com o período bloqueado, o sistema alertará que você está indisponível para aquela data.
              </div>
            </div>

            {/* Grid 2 Colunas para Datas */}
            <div className="modal-grid-2">
              <div className="form-field">
                <label>Data Inicial *</label>
                <input
                  type="date"
                  value={dataInicial}
                  onChange={(e) => setDataInicial(e.target.value)}
                  required
                />
              </div>

              <div className="form-field">
                <label>Data Final *</label>
                <input
                  type="date"
                  value={dataFinal}
                  onChange={(e) => setDataFinal(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Motivo e Tags */}
            <div className="form-field">
              <label>Motivo / Tipo de Bloqueio *</label>
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
                        padding: "6px 12px",
                        borderRadius: "20px",
                        fontSize: "11px",
                        fontWeight: 700,
                        border: sel ? "1px solid #dc2626" : "1px solid var(--border)",
                        backgroundColor: sel ? "#dc2626" : "var(--surface-container-low, #f1f5f9)",
                        color: sel ? "#ffffff" : "var(--on-surface-variant, #475569)",
                        cursor: "pointer",
                        boxShadow: sel ? "0 2px 4px rgba(220, 38, 38, 0.25)" : "none",
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
                required
              />
            </div>

            {/* Observações Adicionais */}
            <div className="form-field">
              <label>Observações Adicionais (Opcional)</label>
              <textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Detalhes visíveis para a coordenação ao tentar agendar..."
                rows={2}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  backgroundColor: "var(--surface-container-low, #f1f5f9)",
                  fontSize: "13px",
                  color: "var(--on-surface)",
                  resize: "vertical",
                }}
              />
            </div>

            {/* Seus Bloqueios Registrados */}
            <div style={{ marginTop: "14px", borderTop: "1px solid var(--border)", paddingTop: "14px" }}>
              <h4
                style={{
                  margin: "0 0 10px 0",
                  fontSize: "11.5px",
                  fontWeight: 800,
                  color: "var(--on-surface-variant)",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                Seus Bloqueios Registrados ({bloqueios.length})
              </h4>

              {bloqueios.length === 0 ? (
                <div
                  style={{
                    padding: "16px",
                    borderRadius: "10px",
                    backgroundColor: "var(--surface-container-lowest, #ffffff)",
                    border: "1px dashed var(--border)",
                    textAlign: "center",
                    fontSize: "12px",
                    color: "var(--on-surface-variant)",
                    fontStyle: "italic",
                  }}
                >
                  Nenhum período de bloqueio cadastrado para este consultor.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {bloqueios.map((b) => (
                    <div
                      key={b.id}
                      style={{
                        padding: "12px 16px",
                        borderRadius: "10px",
                        backgroundColor: "var(--surface-container-lowest, #ffffff)",
                        border: "1px solid rgba(220, 38, 38, 0.2)",
                        borderLeft: "4px solid #dc2626",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "12px",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                          <span
                            className="material-symbols-outlined"
                            style={{ fontSize: "16px", color: "#dc2626" }}
                          >
                            event_busy
                          </span>
                          <strong style={{ fontSize: "13px", color: "#991b1b" }}>
                            {formatarPeriodoBR(b.dataInicial, b.dataFinal)}
                          </strong>
                          <span
                            style={{
                              fontSize: "10.5px",
                              fontWeight: 700,
                              padding: "2px 8px",
                              borderRadius: "4px",
                              backgroundColor: "rgba(220, 38, 38, 0.12)",
                              color: "#b91c1c",
                            }}
                          >
                            {b.motivo}
                          </span>
                        </div>
                        {b.observacoes && (
                          <p style={{ margin: "4px 0 0 24px", fontSize: "11.5px", color: "var(--on-surface-variant)" }}>
                            {b.observacoes}
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        disabled={removendoId === b.id}
                        onClick={() => handleRemover(b.id)}
                        style={{
                          padding: "5px 10px",
                          borderRadius: "6px",
                          backgroundColor: "#ffffff",
                          border: "1px solid #fecdd3",
                          color: "#dc2626",
                          fontSize: "11px",
                          fontWeight: 700,
                          cursor: "pointer",
                          transition: "all 0.15s ease",
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

          {/* Footer Idêntico ao Print 3 */}
          <div className="modal-footer">
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={salvando}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "9px 22px",
                borderRadius: "8px",
                backgroundColor: "#dc2626",
                color: "#ffffff",
                border: "none",
                fontSize: "13px",
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 2px 6px rgba(220, 38, 38, 0.28)",
                transition: "background 0.15s ease",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                lock
              </span>
              <span>{salvando ? "Bloqueando..." : "Confirmar Bloqueio"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
