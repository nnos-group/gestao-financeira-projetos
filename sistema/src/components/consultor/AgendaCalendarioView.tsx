"use client";

import React, { useState, useMemo } from "react";
import { AgendaBloqueio } from "@/lib/agenda-bloqueios";
import { formatarPeriodoBR } from "@/lib/date-utils";

interface AgendaCalendarioViewProps {
  atividades: any[];
  bloqueios: AgendaBloqueio[];
  anoInicial: number;
  mesInicial: number; // 1 a 12
  onSelecionarAtividade?: (atv: any) => void;
}

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MESES_NOMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export default function AgendaCalendarioView({
  atividades,
  bloqueios,
  anoInicial,
  mesInicial,
  onSelecionarAtividade,
}: AgendaCalendarioViewProps) {
  const [ano, setAno] = useState(anoInicial || new Date().getFullYear());
  const [mes, setMes] = useState(mesInicial && mesInicial > 0 ? mesInicial : new Date().getMonth() + 1);

  const mesAnterior = () => {
    if (mes === 1) {
      setMes(12);
      setAno((a) => a - 1);
    } else {
      setMes((m) => m - 1);
    }
  };

  const proximoMes = () => {
    if (mes === 12) {
      setMes(1);
      setAno((a) => a + 1);
    } else {
      setMes((m) => m + 1);
    }
  };

  // Cálculo dos dias do mês e preenchimento da grade
  const diasDoMes = useMemo(() => {
    const primeiroDia = new Date(ano, mes - 1, 1);
    const ultimoDia = new Date(ano, mes, 0);
    const totalDias = ultimoDia.getDate();
    const diaSemanaInicio = primeiroDia.getDay(); // 0 a 6

    const lista: { dia: number; dataStr: string; emOutroMes: boolean }[] = [];

    // Dias do mês anterior para completar a primeira semana
    const mesAnteriorUltimoDia = new Date(ano, mes - 1, 0).getDate();
    for (let i = diaSemanaInicio - 1; i >= 0; i--) {
      const d = mesAnteriorUltimoDia - i;
      const mAnt = mes === 1 ? 12 : mes - 1;
      const aAnt = mes === 1 ? ano - 1 : ano;
      const dataStr = `${aAnt}-${String(mAnt).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      lista.push({ dia: d, dataStr, emOutroMes: true });
    }

    // Dias do mês corrente
    for (let d = 1; d <= totalDias; d++) {
      const dataStr = `${ano}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      lista.push({ dia: d, dataStr, emOutroMes: false });
    }

    // Dias do próximo mês para completar a grade de 35 ou 42 células
    const resto = lista.length % 7;
    if (resto > 0) {
      const faltam = 7 - resto;
      const mProx = mes === 12 ? 1 : mes + 1;
      const aProx = mes === 12 ? ano + 1 : ano;
      for (let d = 1; d <= faltam; d++) {
        const dataStr = `${aProx}-${String(mProx).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        lista.push({ dia: d, dataStr, emOutroMes: true });
      }
    }

    return lista;
  }, [ano, mes]);

  // Função para verificar se uma data cai no intervalo de uma atividade
  const getAtividadesDoDia = (dataStr: string) => {
    return atividades.filter((atv) => {
      const ini = String(atv.data_inicial || atv.dataInicial || "").slice(0, 10);
      const fim = String(atv.data_final || atv.dataFinal || ini).slice(0, 10);
      if (!ini) return false;
      return dataStr >= ini && dataStr <= fim;
    });
  };

  // Função para verificar se uma data cai no intervalo de um bloqueio
  const getBloqueiosDoDia = (dataStr: string) => {
    return bloqueios.filter((blk) => {
      const ini = String(blk.dataInicial || "").slice(0, 10);
      const fim = String(blk.dataFinal || ini).slice(0, 10);
      if (!ini) return false;
      return dataStr >= ini && dataStr <= fim;
    });
  };

  const hojeStr = new Date().toISOString().slice(0, 10);

  return (
    <div
      style={{
        backgroundColor: "var(--surface-container-lowest, #ffffff)",
        borderRadius: "14px",
        border: "1px solid var(--border)",
        overflow: "hidden",
        boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header do Calendário: Navegação de Mês */}
      <div
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid var(--border)",
          backgroundColor: "var(--surface-container-low, #f8fafc)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span className="material-symbols-outlined" style={{ fontSize: "24px", color: "var(--primary)" }}>
            calendar_month
          </span>
          <div>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "var(--primary)" }}>
              {MESES_NOMES[mes - 1]} de {ano}
            </h3>
            <span style={{ fontSize: "11px", color: "var(--on-surface-variant)" }}>
              Visão Mensal da Agenda e Disponibilidade Operacional
            </span>
          </div>
        </div>

        {/* Controles de Navegação */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            type="button"
            onClick={mesAnterior}
            style={{
              padding: "6px 10px",
              borderRadius: "8px",
              backgroundColor: "var(--surface)",
              border: "1px solid var(--border)",
              color: "var(--on-surface)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "12px",
              fontWeight: 600,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>chevron_left</span>
            <span>Mês Anterior</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const h = new Date();
              setAno(h.getFullYear());
              setMes(h.getMonth() + 1);
            }}
            style={{
              padding: "6px 12px",
              borderRadius: "8px",
              backgroundColor: "var(--primary)",
              border: "none",
              color: "#ffffff",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: 700,
            }}
          >
            Hoje
          </button>

          <button
            type="button"
            onClick={proximoMes}
            style={{
              padding: "6px 10px",
              borderRadius: "8px",
              backgroundColor: "var(--surface)",
              border: "1px solid var(--border)",
              color: "var(--on-surface)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "12px",
              fontWeight: 600,
            }}
          >
            <span>Próximo Mês</span>
            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>chevron_right</span>
          </button>
        </div>
      </div>

      {/* Grade dos Dias da Semana */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          borderBottom: "1px solid var(--border)",
          backgroundColor: "#f1f5f9",
          textAlign: "center",
        }}
      >
        {DIAS_SEMANA.map((ds, idx) => (
          <div
            key={ds}
            style={{
              padding: "10px 4px",
              fontSize: "11px",
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              color: idx === 0 || idx === 6 ? "#94a3b8" : "var(--primary)",
            }}
          >
            {ds}
          </div>
        ))}
      </div>

      {/* Grade de Células de Dias */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          backgroundColor: "var(--border, #e2e8f0)",
          gap: "1px",
        }}
      >
        {diasDoMes.map((celula, idx) => {
          const atvsDoDia = getAtividadesDoDia(celula.dataStr);
          const blksDoDia = getBloqueiosDoDia(celula.dataStr);
          const isHoje = celula.dataStr === hojeStr;
          const temBloqueio = blksDoDia.length > 0;

          return (
            <div
              key={idx}
              style={{
                minHeight: "110px",
                backgroundColor: celula.emOutroMes
                  ? "#fcfcfd"
                  : temBloqueio
                  ? "#fff8f8"
                  : "var(--surface, #ffffff)",
                padding: "8px 6px",
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                transition: "background-color 0.1s ease",
              }}
            >
              {/* Número do Dia */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2px" }}>
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: isHoje ? 800 : 700,
                    width: isHoje ? "22px" : "auto",
                    height: isHoje ? "22px" : "auto",
                    borderRadius: isHoje ? "50%" : "0",
                    backgroundColor: isHoje ? "var(--primary)" : "transparent",
                    color: isHoje
                      ? "#ffffff"
                      : celula.emOutroMes
                      ? "#94a3b8"
                      : "var(--on-surface)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {celula.dia}
                </span>

                {temBloqueio && (
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: "14px", color: "#e11d48" }}
                    title={`Bloqueado: ${blksDoDia.map((b) => b.motivo).join(", ")}`}
                  >
                    lock
                  </span>
                )}
              </div>

              {/* Bloqueios do Dia */}
              {blksDoDia.map((b) => (
                <div
                  key={b.id}
                  style={{
                    backgroundColor: "#ffe4e6",
                    border: "1px solid #fecdd3",
                    color: "#9f1239",
                    borderRadius: "6px",
                    padding: "3px 6px",
                    fontSize: "10px",
                    fontWeight: 700,
                    lineHeight: 1.2,
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                  title={`Bloqueio: ${b.motivo} (${formatarPeriodoBR(b.dataInicial, b.dataFinal)})`}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "12px" }}>event_busy</span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {b.motivo}
                  </span>
                </div>
              ))}

              {/* Atividades do Dia */}
              {atvsDoDia.map((atv, i) => {
                const statusStr = String(atv.status || "CONFIRMADO").toUpperCase();
                const isCancelado = statusStr.includes("CANCEL");
                const isConfirmado = statusStr.includes("CONFIRM") || statusStr.includes("REALIZ") || statusStr.includes("CONCLU");

                const bgCor = isCancelado ? "#fee2e2" : isConfirmado ? "#dcfce7" : "#e0f2fe";
                const textCor = isCancelado ? "#991b1b" : isConfirmado ? "#166534" : "#0369a1";

                return (
                  <div
                    key={atv.id || i}
                    onClick={() => onSelecionarAtividade && onSelecionarAtividade(atv)}
                    style={{
                      backgroundColor: bgCor,
                      border: `1px solid ${textCor}33`,
                      color: textCor,
                      borderRadius: "6px",
                      padding: "3px 6px",
                      fontSize: "10.5px",
                      fontWeight: 700,
                      cursor: "pointer",
                      lineHeight: 1.25,
                      boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                    }}
                    title={`${atv.projetos?.nome || atv.projeto} • ${atv.atividade} (${atv.local || "Local"})`}
                  >
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {atv.projetos?.nome || atv.projeto || "Atividade"}
                    </div>
                    <div style={{ fontSize: "9px", opacity: 0.85, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {atv.atividade} {atv.horas ? `• ${atv.horas}h` : ""}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
