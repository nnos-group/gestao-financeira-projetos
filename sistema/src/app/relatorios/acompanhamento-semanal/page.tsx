"use client";

import React, { useEffect, useMemo, useState } from "react";
import RelatorioShell from "@/components/RelatorioShell";
import ModernDropdown from "@/components/ModernDropdown";
import { usePerfilAcesso } from "@/contexts/PerfilAcessoContext";
import { formatarDataBR } from "@/lib/date-utils";
import historicoInicial from "@/lib/acompanhamento-semanal-base.json";

interface InstituicaoPosicao {
  caixa: number;
  aplicacao: number;
  rentabilidade: string;
}

interface ItemAtraso {
  realizado: string;
  faturado: string;
  projeto: string;
  perfil: string;
  numeroNota: string;
  valor: number;
  dias: number;
  vencimento: string;
}

interface ItemProjetoValor {
  projeto: string;
  valor: number;
}

export interface RelatorioSemanalItem {
  id: string;
  dataReferencia: string;
  mesReferencia: string;
  anoReferencia: number;
  criadoEm: string;
  criadoPor: string;
  posicaoFinanceira: {
    total: number;
    sicoob: InstituicaoPosicao;
    clara: InstituicaoPosicao;
    itau: InstituicaoPosicao;
  };
  contasAPagar: {
    vencidos: number;
    vencemHoje: number;
    aVencer: number;
    pagos: number;
    totalPeriodo: number;
  };
  contasAReceber: {
    vencidos: number;
    vencemHoje: number;
    aVencer: number;
    pagos: number;
    totalPeriodo: number;
  };
  cashBack: {
    totalAcumulado: number;
    anos: {
      "2023": number;
      "2024": number;
      "2025": number;
      "2026": number;
    };
  };
  claraDesconto: {
    totalAcumulado: number;
    anos: {
      "2023": number;
      "2024": number;
      "2025": number;
      "2026": number;
    };
  };
  aReceberEmAtraso: ItemAtraso[];
  totalAtraso: number;
  aVencerEmAberto: number;
  totalAReceber: number;
  projetosMes: ItemProjetoValor[];
  totalProjetos: number;
}

function fmtNum(v: number | undefined | null, casas = 2): string {
  const n = Number(v) || 0;
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
}

function fmtCompactoOuDecimal(v: number | undefined | null): string {
  const n = Number(v) || 0;
  if (n === 0) return "0";
  if (Number.isInteger(n) && n < 1000) return String(n);
  return fmtNum(n, 2);
}

function calcularVariacao(atual: number, anterior?: number | null): {
  pct: number;
  subiu: boolean;
} {
  if (anterior === undefined || anterior === null || anterior === 0) {
    return { pct: 0, subiu: true };
  }
  const diff = atual - anterior;
  const pct = Math.round((Math.abs(diff) / Math.abs(anterior)) * 100);
  return { pct, subiu: diff >= 0 };
}

// Componente do Círculo com Seta de Indicador Positivo / Negativo (Fiel ao Print)
function IndicadorVariacaoSeta({
  atual,
  anterior,
  inverterSemantica = false,
  tamanho = "md",
}: {
  atual: number;
  anterior?: number | null;
  inverterSemantica?: boolean;
  tamanho?: "sm" | "md" | "lg";
}) {
  const { pct, subiu } = calcularVariacao(atual, anterior);
  // Para Posição Financeira, Contas a Receber e Projetos: subir é positivo (verde), cair é negativo (rosa/vermelho)
  // Para A Receber em Atraso: subir o atraso é negativo (rosa/vermelho, seta para baixo no estilo do print), cair é positivo (verde)
  const ehPositivo = inverterSemantica ? !subiu : subiu;

  const corBorda = ehPositivo ? "#a7dec7" : "#f5b5b8";
  const corSeta = ehPositivo ? "#9fd8be" : "#f2a6aa";
  const corTexto = "#334155";
  const setaParaCima = inverterSemantica ? !subiu : subiu;

  const dim = tamanho === "lg" ? 48 : tamanho === "sm" ? 36 : 42;
  const fontPct = tamanho === "lg" ? "13px" : tamanho === "sm" ? "10.5px" : "11.5px";

  return (
    <div
      title={
        anterior != null
          ? `Variação em relação ao relatório anterior (${fmtNum(anterior)} -> ${fmtNum(atual)})`
          : "Sem relatório anterior para comparação"
      }
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        userSelect: "none",
      }}
    >
      {setaParaCima && (
        <div
          style={{
            width: 0,
            height: 0,
            borderLeft: "9px solid transparent",
            borderRight: "9px solid transparent",
            borderBottom: `11px solid ${corSeta}`,
            marginBottom: "-3px",
          }}
        />
      )}
      <div
        style={{
          width: `${dim}px`,
          height: `${dim}px`,
          borderRadius: "50%",
          border: `3px solid ${corBorda}`,
          backgroundColor: "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: fontPct,
          fontWeight: 700,
          color: corTexto,
          boxShadow: "0 2px 6px rgba(15, 42, 74, 0.06)",
          zIndex: 1,
        }}
      >
        {pct}%
      </div>
      {!setaParaCima && (
        <div
          style={{
            width: 0,
            height: 0,
            borderLeft: "9px solid transparent",
            borderRight: "9px solid transparent",
            borderTop: `11px solid ${corSeta}`,
            marginTop: "-3px",
          }}
        />
      )}
    </div>
  );
}

export default function AcompanhamentoSemanalPage() {
  const { perfilAtivoId, usuarioLogado, hidratado } = usePerfilAcesso();
  const temAcessoDiretoria =
    !hidratado ||
    !perfilAtivoId ||
    perfilAtivoId === "DIRETORIA" ||
    perfilAtivoId === "ADMIN" ||
    usuarioLogado?.perfilId === "DIRETORIA" ||
    usuarioLogado?.perfilId === "ADMIN";

  const [historico, setHistorico] = useState<RelatorioSemanalItem[]>(
    historicoInicial as unknown as RelatorioSemanalItem[]
  );
  const [relatorioSelecionadoId, setRelatorioSelecionadoId] = useState<string>(
    (historicoInicial as any[])[0]?.id || "sem-2026-11-24"
  );
  const [modalEdicaoAberto, setModalEdicaoAberto] = useState(false);
  const [modalHistoricoAberto, setModalHistoricoAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [sincronizandoBase, setSincronizandoBase] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Estado do formulário para criar novo ou editar relatório
  const [formRelatorio, setFormRelatorio] = useState<RelatorioSemanalItem>(
    (historicoInicial as unknown as RelatorioSemanalItem[])[0]
  );

  const mostrarToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  useEffect(() => {
    fetch("/api/relatorios/acompanhamento-semanal")
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        if (res?.success && Array.isArray(res.historico) && res.historico.length > 0) {
          setHistorico(res.historico);
          setRelatorioSelecionadoId(res.historico[0].id);
        }
      })
      .catch((e) => console.warn("Aviso ao carregar histórico semanal:", e));
  }, []);

  // Relatório ativo e o relatório imediatamente anterior para cálculo das setas
  const { relatorioAtivo, relatorioAnterior } = useMemo(() => {
    const idx = historico.findIndex((r) => r.id === relatorioSelecionadoId);
    const ativo = idx >= 0 ? historico[idx] : historico[0];
    const anterior = idx >= 0 && idx + 1 < historico.length ? historico[idx + 1] : historico[1] || null;
    return { relatorioAtivo: ativo, relatorioAnterior: anterior };
  }, [historico, relatorioSelecionadoId]);

  const opcoesHistoricoDropdown = useMemo(() => {
    return historico.map((r, idx) => ({
      value: r.id,
      label: `${formatarDataBR(r.dataReferencia)} • ${r.mesReferencia}/${r.anoReferencia}${
        idx === 0 ? " (Último Enviado)" : ""
      }`,
      icon: idx === 0 ? "verified" : "history",
    }));
  }, [historico]);

  const abrirModalEditarAtual = () => {
    if (!relatorioAtivo) return;
    setFormRelatorio(JSON.parse(JSON.stringify(relatorioAtivo)));
    setModalEdicaoAberto(true);
  };

  const abrirModalNovoRelatorio = async () => {
    const base = relatorioAtivo || historico[0];
    const hojeISO = new Date().toISOString().slice(0, 10);
    const MESES = [
      "JANEIRO",
      "FEVEREIRO",
      "MARÇO",
      "ABRIL",
      "MAIO",
      "JUNHO",
      "JULHO",
      "AGOSTO",
      "SETEMBRO",
      "OUTUBRO",
      "NOVEMBRO",
      "DEZEMBRO",
    ];
    const dt = new Date();
    const mesCorrente = MESES[dt.getMonth()] || "NOVEMBRO";

    const copia: RelatorioSemanalItem = JSON.parse(JSON.stringify(base));
    copia.id = `sem-${hojeISO}`;
    copia.dataReferencia = hojeISO;
    copia.mesReferencia = mesCorrente;
    copia.anoReferencia = dt.getFullYear();
    copia.criadoPor = usuarioLogado?.nome || "Diretoria Executiva";

    setFormRelatorio(copia);
    setModalEdicaoAberto(true);

    // Já puxa os dados em tempo real da base de dados para a nova data
    await sincronizarDadosBaseNoForm(hojeISO, copia);
  };

  const sincronizarDadosBaseNoForm = async (dataRefISO: string, estadoBase?: RelatorioSemanalItem) => {
    try {
      setSincronizandoBase(true);
      const res = await fetch(
        `/api/relatorios/acompanhamento-semanal?acao=calcular_base&dataReferencia=${encodeURIComponent(dataRefISO)}`
      );
      const json = await res.json();
      if (json?.success && json.dadosBase) {
        const db = json.dadosBase;
        setFormRelatorio((prev) => {
          const alvo = estadoBase || prev;
          return {
            ...alvo,
            dataReferencia: dataRefISO,
            mesReferencia: db.mesReferencia || alvo.mesReferencia,
            anoReferencia: db.anoReferencia || alvo.anoReferencia,
            aReceberEmAtraso: db.aReceberEmAtraso,
            totalAtraso: db.totalAtraso,
            aVencerEmAberto: db.aVencerEmAberto,
            totalAReceber: db.totalAReceber,
            projetosMes: db.projetosMes,
            totalProjetos: db.totalProjetos,
          };
        });
        mostrarToast("Dados de Faturamento e Projetos do mês corrente sincronizados da base!");
      }
    } catch (e) {
      console.warn("Erro ao sincronizar base:", e);
    } finally {
      setSincronizandoBase(false);
    }
  };

  const handleSalvarRelatorio = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSalvando(true);
      const res = await fetch("/api/relatorios/acompanhamento-semanal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formRelatorio,
          id: `sem-${formRelatorio.dataReferencia}`,
          criadoPor: usuarioLogado?.nome || formRelatorio.criadoPor || "Diretoria Executiva",
        }),
      });
      const json = await res.json();
      if (json?.success && Array.isArray(json.historico)) {
        setHistorico(json.historico);
        setRelatorioSelecionadoId(json.relatorio.id);
        setModalEdicaoAberto(false);
        mostrarToast(
          `Relatório Semanal de ${formatarDataBR(json.relatorio.dataReferencia)} salvo e publicado no histórico!`
        );
      } else {
        alert(json?.error || "Erro ao salvar relatório semanal.");
      }
    } catch (err: any) {
      alert("Erro ao salvar relatório: " + err.message);
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluirRelatorio = async (id: string, dataRef: string) => {
    if (historico.length <= 1) {
      alert("Não é permitido excluir o único relatório do histórico.");
      return;
    }
    if (!confirm(`Deseja realmente excluir o relatório de ${formatarDataBR(dataRef)} do histórico?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/relatorios/acompanhamento-semanal?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json?.success && Array.isArray(json.historico)) {
        setHistorico(json.historico);
        setRelatorioSelecionadoId(json.historico[0].id);
        mostrarToast(`Relatório de ${formatarDataBR(dataRef)} removido do histórico.`);
      }
    } catch {}
  };

  // Bloqueio estrito para perfis que não sejam Diretoria Executiva
  if (!temAcessoDiretoria) {
    return (
      <RelatorioShell titulo="Acompanhamento Semanal">
        <div
          style={{
            padding: "48px 24px",
            textAlign: "center",
            background: "var(--surface-container-lowest, #ffffff)",
            borderRadius: "20px",
            border: "1px solid var(--border, #e2e8f0)",
            marginTop: "24px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "48px", color: "#f59e0b" }}>
            lock
          </span>
          <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 800, color: "var(--on-surface)" }}>
            Acesso Exclusivo à Diretoria Executiva
          </h2>
          <p style={{ margin: 0, fontSize: "14px", color: "var(--on-surface-variant)", maxWidth: "480px" }}>
            O boletim executivo de Acompanhamento Semanal contém informações estratégicas de posição bancária e fluxo de
            caixa restritas ao perfil de Diretoria Executiva.
          </p>
        </div>
      </RelatorioShell>
    );
  }

  if (!relatorioAtivo) return null;

  // Dados para os gráficos dinâmicos de Cash Back e Clara Desconto na Fatura
  const anosGrafico = ["2023", "2024", "2025", "2026"] as const;
  const maxCashBack = Math.max(40000, ...anosGrafico.map((a) => Number(relatorioAtivo.cashBack.anos[a]) || 0));
  const maxClara = Math.max(25000, ...anosGrafico.map((a) => Number(relatorioAtivo.claraDesconto.anos[a]) || 0));

  return (
    <RelatorioShell titulo="Acompanhamento Semanal · Diretoria Executiva">
      {/* Toast de Confirmação */}
      {toastMsg && (
        <div
          style={{
            position: "fixed",
            top: "20px",
            right: "24px",
            zIndex: 9999,
            backgroundColor: "#0a3254",
            color: "#ffffff",
            padding: "12px 20px",
            borderRadius: "12px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            boxShadow: "0 10px 28px rgba(0, 0, 0, 0.25)",
            fontSize: "13px",
            fontWeight: 700,
          }}
        >
          <span className="material-symbols-outlined" style={{ color: "#34d399", fontSize: "20px" }}>
            check_circle
          </span>
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Barra de Ferramentas Executiva: Seletor de Histórico, Comparativo, Edição Manual e Novo Envio */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          padding: "12px 16px",
          borderRadius: "14px",
          background: "var(--surface-container-lowest, #ffffff)",
          border: "1px solid var(--border, #e2e8f0)",
          boxShadow: "0 2px 8px rgba(15, 42, 74, 0.04)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#0284c7" }}>
              history
            </span>
            <span
              style={{
                fontSize: "12px",
                fontWeight: 800,
                textTransform: "uppercase",
                color: "var(--on-surface-variant)",
                letterSpacing: "0.03em",
              }}
            >
              Relatório Exibido:
            </span>
          </div>

          <ModernDropdown
            value={relatorioSelecionadoId}
            onChange={(val) => setRelatorioSelecionadoId(String(val))}
            options={opcoesHistoricoDropdown}
            icon="event_note"
            minWidth="290px"
          />

          {relatorioAnterior && (
            <span
              style={{
                fontSize: "11.5px",
                color: "var(--on-surface-variant)",
                background: "var(--surface-container-low, #f1f5f9)",
                padding: "5px 10px",
                borderRadius: "8px",
                border: "1px solid var(--border, #e2e8f0)",
                fontWeight: 600,
              }}
            >
              Comparando setas com: <strong>{formatarDataBR(relatorioAnterior.dataReferencia)}</strong>
            </span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setModalHistoricoAberto(true)}
            className="btn-secondary"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              borderRadius: "10px",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "17px" }}>
              folder_clock
            </span>
            <span>Histórico de Envios ({historico.length})</span>
          </button>

          <button
            type="button"
            onClick={abrirModalEditarAtual}
            className="btn-secondary"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              borderRadius: "10px",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "17px" }}>
              edit_note
            </span>
            <span>Editar Valores Manuais</span>
          </button>

          <button
            type="button"
            onClick={abrirModalNovoRelatorio}
            className="btn-primary"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 16px",
              borderRadius: "10px",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
              background: "linear-gradient(135deg, #0083ca 0%, #0a4e82 100%)",
              color: "#ffffff",
              border: "none",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "17px" }}>
              add_chart
            </span>
            <span>Novo Relatório Semanal</span>
          </button>
        </div>
      </div>

      {/* =====================================================================
          PAINEL EXECUTIVO FIEL AO LAYOUT OFICIAL (Acompanhamento Semanal_25-11-26)
         ===================================================================== */}
      <div
        className="a4-sheet"
        style={{
          backgroundColor: "#f3f6f9",
          borderRadius: "18px",
          overflow: "hidden",
          border: "1px solid #d8e2ec",
          boxShadow: "0 12px 36px rgba(10, 46, 70, 0.08)",
          color: "#1e293b",
          fontFamily: "var(--font-jakarta, 'Plus Jakarta Sans', sans-serif)",
        }}
      >
        {/* CABEÇALHO AZUL DEGRADÊ OFICIAL */}
        <div
          style={{
            background: "linear-gradient(90deg, #0099c8 0%, #0973ae 45%, #004c8c 100%)",
            padding: "14px 28px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "16px",
            color: "#ffffff",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
            {/* Ícone de Calendário Turquesa */}
            <div
              style={{
                width: "54px",
                height: "54px",
                borderRadius: "14px",
                backgroundColor: "#2bb3c0",
                border: "2px solid rgba(255, 255, 255, 0.75)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.12)",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "34px", color: "#ffffff" }}>
                calendar_month
              </span>
            </div>

            <div style={{ width: "2px", height: "48px", backgroundColor: "rgba(255, 255, 255, 0.55)" }} />

            <div style={{ display: "flex", flexDirection: "column" }}>
              <span
                style={{
                  fontSize: "19px",
                  fontWeight: 700,
                  color: "#04233b",
                  lineHeight: 1.1,
                  letterSpacing: "-0.01em",
                }}
              >
                {formatarDataBR(relatorioAtivo.dataReferencia)}
              </span>
              <div style={{ display: "flex", alignItems: "baseline", gap: "12px", flexWrap: "wrap", marginTop: "2px" }}>
                <span
                  style={{
                    fontSize: "30px",
                    fontWeight: 800,
                    color: "#ffffff",
                    letterSpacing: "0.02em",
                    lineHeight: 1.1,
                    textTransform: "uppercase",
                  }}
                >
                  ACOMPANHAMENTO SEMANAL
                </span>
                <span style={{ fontSize: "26px", fontWeight: 300, color: "rgba(255,255,255,0.8)" }}>|</span>
                <span
                  style={{
                    fontSize: "25px",
                    fontWeight: 500,
                    color: "#05233b",
                    textTransform: "uppercase",
                    letterSpacing: "0.03em",
                  }}
                >
                  {relatorioAtivo.mesReferencia}
                </span>
              </div>
            </div>
          </div>

          {/* Logomarca NNÓS Branca à Direita */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <img
              src="/logo-horizontal-branca.png"
              alt="NNÓS - Transformando Estratégias em Realidade"
              style={{ height: "54px", width: "auto", objectFit: "contain" }}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = "/logo-coruja.png";
              }}
            />
          </div>
        </div>

        {/* CORPO DO PAINEL */}
        <div style={{ padding: "18px 22px 24px", display: "flex", flexDirection: "column", gap: "18px" }}>
          {/* =================================================================
              LINHA 1: POSIÇÃO FINANCEIRA (ESQUERDA) + CONTAS A PAGAR & RECEBER (DIREITA)
             ================================================================= */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(370px, 1.05fr) minmax(560px, 2.15fr)",
              gap: "18px",
              alignItems: "stretch",
            }}
          >
            {/* CARD 1: POSIÇÃO FINANCEIRA (Manual) */}
            <div
              style={{
                backgroundColor: "#ffffff",
                borderRadius: "16px",
                padding: "16px 20px",
                boxShadow: "0 2px 10px rgba(15, 42, 74, 0.04)",
                border: "1px solid #e2e8f0",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              {/* Topo do Card Posição Financeira */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "50%",
                      backgroundColor: "#539bb2",
                      color: "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
                      account_balance
                    </span>
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: "17px",
                        fontWeight: 500,
                        color: "#1e293b",
                        letterSpacing: "0.01em",
                        textTransform: "uppercase",
                      }}
                    >
                      POSIÇÃO FINANCEIRA
                    </div>
                    <div
                      style={{
                        fontSize: "29px",
                        fontWeight: 800,
                        color: "#09314b",
                        lineHeight: 1.15,
                        marginTop: "4px",
                      }}
                    >
                      {fmtNum(relatorioAtivo.posicaoFinanceira.total)}
                    </div>
                  </div>
                </div>

                {/* Seta Comparativa com o Relatório Anterior */}
                <IndicadorVariacaoSeta
                  atual={relatorioAtivo.posicaoFinanceira.total}
                  anterior={relatorioAnterior?.posicaoFinanceira?.total}
                  tamanho="lg"
                />
              </div>

              {/* Tabela de Instituições: SICOOB, CLARA, ITAÚ */}
              <div style={{ marginTop: "10px" }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "95px 1fr 1fr 78px",
                    alignItems: "center",
                    paddingBottom: "4px",
                    fontSize: "13px",
                    fontWeight: 800,
                    color: "#0f172a",
                    textAlign: "right",
                  }}
                >
                  <div />
                  <div style={{ textAlign: "center" }}>CAIXA</div>
                  <div style={{ textAlign: "center" }}>APLICAÇÃO</div>
                  <div />
                </div>

                {/* Linha 1: SICOOB */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "95px 1fr 1fr 78px",
                    alignItems: "center",
                    padding: "8px 0",
                    borderTop: "1px dashed #cbd5e1",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                    <span
                      style={{
                        width: 0,
                        height: 0,
                        borderLeft: "8px solid transparent",
                        borderRight: "8px solid transparent",
                        borderTop: "14px solid #00a859",
                        display: "inline-block",
                      }}
                    />
                    <span style={{ fontWeight: 900, fontSize: "14px", color: "#003641", letterSpacing: "-0.02em" }}>
                      SICOOB
                    </span>
                  </div>
                  <div
                    style={{
                      textAlign: "center",
                      fontSize: "15.5px",
                      fontWeight: 700,
                      color: relatorioAtivo.posicaoFinanceira.sicoob.caixa < 0 ? "#d98a8c" : "#67b887",
                    }}
                  >
                    {fmtNum(relatorioAtivo.posicaoFinanceira.sicoob.caixa)}
                  </div>
                  <div
                    style={{
                      textAlign: "center",
                      fontSize: "15.5px",
                      fontWeight: 700,
                      color: "#67b887",
                    }}
                  >
                    {fmtNum(relatorioAtivo.posicaoFinanceira.sicoob.aplicacao)}
                  </div>
                  <div style={{ textAlign: "center", lineHeight: 1.15 }}>
                    <div style={{ fontSize: "9.5px", color: "#64748b", fontWeight: 600 }}>Rentabilidade</div>
                    <div style={{ fontSize: "11px", color: "#67b887", fontWeight: 700 }}>
                      {relatorioAtivo.posicaoFinanceira.sicoob.rentabilidade}
                    </div>
                  </div>
                </div>

                {/* Linha 2: CLARA */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "95px 1fr 1fr 78px",
                    alignItems: "center",
                    padding: "8px 0",
                    borderTop: "1px dashed #cbd5e1",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span
                      style={{
                        width: "18px",
                        height: "18px",
                        borderRadius: "50%",
                        backgroundColor: "#0f172a",
                        color: "#ffffff",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "11px",
                      }}
                    >
                      ✦
                    </span>
                    <span
                      style={{
                        fontWeight: 800,
                        fontSize: "14.5px",
                        color: "#0f172a",
                        fontFamily: "Georgia, serif",
                        letterSpacing: "0.03em",
                      }}
                    >
                      CLARA
                    </span>
                  </div>
                  <div
                    style={{
                      textAlign: "center",
                      fontSize: "15.5px",
                      fontWeight: 700,
                      color: relatorioAtivo.posicaoFinanceira.clara.caixa < 0 ? "#d98a8c" : "#67b887",
                    }}
                  >
                    {fmtNum(relatorioAtivo.posicaoFinanceira.clara.caixa)}
                  </div>
                  <div
                    style={{
                      textAlign: "center",
                      fontSize: "15.5px",
                      fontWeight: 700,
                      color: "#67b887",
                    }}
                  >
                    {fmtNum(relatorioAtivo.posicaoFinanceira.clara.aplicacao)}
                  </div>
                  <div style={{ textAlign: "center", lineHeight: 1.15 }}>
                    <div style={{ fontSize: "9.5px", color: "#64748b", fontWeight: 600 }}>Rentabilidade</div>
                    <div style={{ fontSize: "11px", color: "#67b887", fontWeight: 700 }}>
                      {relatorioAtivo.posicaoFinanceira.clara.rentabilidade}
                    </div>
                  </div>
                </div>

                {/* Linha 3: ITAÚ */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "95px 1fr 1fr 78px",
                    alignItems: "center",
                    padding: "8px 0 2px",
                    borderTop: "1px dashed #cbd5e1",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span
                      style={{
                        padding: "3px 7px",
                        borderRadius: "6px",
                        backgroundColor: "#ec7000",
                        color: "#ffea00",
                        fontWeight: 900,
                        fontSize: "12px",
                        lineHeight: 1,
                      }}
                    >
                      Itaú
                    </span>
                  </div>
                  <div
                    style={{
                      textAlign: "center",
                      fontSize: "15.5px",
                      fontWeight: 700,
                      color: relatorioAtivo.posicaoFinanceira.itau.caixa < 0 ? "#d98a8c" : "#67b887",
                    }}
                  >
                    {fmtNum(relatorioAtivo.posicaoFinanceira.itau.caixa)}
                  </div>
                  <div
                    style={{
                      textAlign: "center",
                      fontSize: "15.5px",
                      fontWeight: 700,
                      color: "#67b887",
                    }}
                  >
                    {fmtNum(relatorioAtivo.posicaoFinanceira.itau.aplicacao)}
                  </div>
                  <div style={{ textAlign: "center", lineHeight: 1.15 }}>
                    <div style={{ fontSize: "9.5px", color: "#64748b", fontWeight: 600 }}>Rentabilidade</div>
                    <div style={{ fontSize: "11px", color: "#67b887", fontWeight: 700 }}>
                      {relatorioAtivo.posicaoFinanceira.itau.rentabilidade}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* COLUNA DIREITA DA LINHA 1: CONTAS A PAGAR + CONTAS A RECEBER */}
            <div style={{ display: "flex", flexDirection: "column", gap: "14px", justifyContent: "space-between" }}>
              {/* CARD 2: CONTAS A PAGAR (Manual) */}
              <div
                style={{
                  backgroundColor: "#ffffff",
                  borderRadius: "16px",
                  padding: "14px 18px",
                  boxShadow: "0 2px 10px rgba(15, 42, 74, 0.04)",
                  border: "1px solid #e2e8f0",
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                  <div
                    style={{
                      width: "30px",
                      height: "30px",
                      borderRadius: "50%",
                      backgroundColor: "#53869b",
                      color: "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "17px" }}>
                      bar_chart
                    </span>
                  </div>
                  <span style={{ fontSize: "16.5px", fontWeight: 500, color: "#1e293b", textTransform: "uppercase" }}>
                    CONTAS A PAGAR
                  </span>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "46px repeat(5, 1fr)",
                    gap: "10px",
                    alignItems: "center",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <IndicadorVariacaoSeta
                      atual={relatorioAtivo.contasAPagar.totalPeriodo}
                      anterior={relatorioAnterior?.contasAPagar?.totalPeriodo}
                      tamanho="sm"
                    />
                  </div>

                  {/* Vencidos */}
                  <div
                    style={{
                      backgroundColor: "#f8fafc",
                      borderRadius: "12px",
                      padding: "8px 10px",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: "12px", fontWeight: 800, color: "#0f172a", textTransform: "uppercase" }}>
                      VENCIDOS
                    </div>
                    <div style={{ fontSize: "21px", fontWeight: 800, color: "#ea9999", marginTop: "2px" }}>
                      {fmtCompactoOuDecimal(relatorioAtivo.contasAPagar.vencidos)}
                    </div>
                  </div>

                  {/* Vencem Hoje */}
                  <div
                    style={{
                      backgroundColor: "#f8fafc",
                      borderRadius: "12px",
                      padding: "8px 10px",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: "12px", fontWeight: 800, color: "#0f172a", textTransform: "uppercase" }}>
                      VENCEM HOJE
                    </div>
                    <div style={{ fontSize: "21px", fontWeight: 800, color: "#ea9999", marginTop: "2px" }}>
                      {fmtCompactoOuDecimal(relatorioAtivo.contasAPagar.vencemHoje)}
                    </div>
                  </div>

                  {/* A Vencer */}
                  <div
                    style={{
                      backgroundColor: "#f8fafc",
                      borderRadius: "12px",
                      padding: "8px 10px",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: "12px", fontWeight: 800, color: "#0f172a", textTransform: "uppercase" }}>
                      A VENCER
                    </div>
                    <div style={{ fontSize: "21px", fontWeight: 800, color: "#546e7a", marginTop: "2px" }}>
                      {fmtCompactoOuDecimal(relatorioAtivo.contasAPagar.aVencer)}
                    </div>
                  </div>

                  {/* Pagos */}
                  <div
                    style={{
                      backgroundColor: "#f8fafc",
                      borderRadius: "12px",
                      padding: "8px 10px",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: "12px", fontWeight: 800, color: "#0f172a", textTransform: "uppercase" }}>
                      PAGOS
                    </div>
                    <div style={{ fontSize: "21px", fontWeight: 800, color: "#67b887", marginTop: "2px" }}>
                      {fmtCompactoOuDecimal(relatorioAtivo.contasAPagar.pagos)}
                    </div>
                  </div>

                  {/* Total do Período */}
                  <div
                    style={{
                      backgroundColor: "#f8fafc",
                      borderRadius: "12px",
                      padding: "8px 10px",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: "12px", fontWeight: 800, color: "#0f172a", textTransform: "uppercase" }}>
                      TOTAL DO PERÍODO
                    </div>
                    <div style={{ fontSize: "21px", fontWeight: 800, color: "#546e7a", marginTop: "2px" }}>
                      {fmtNum(relatorioAtivo.contasAPagar.totalPeriodo)}
                    </div>
                  </div>
                </div>
              </div>

              {/* CARD 3: CONTAS A RECEBER (Manual) */}
              <div
                style={{
                  backgroundColor: "#ffffff",
                  borderRadius: "16px",
                  padding: "14px 18px",
                  boxShadow: "0 2px 10px rgba(15, 42, 74, 0.04)",
                  border: "1px solid #e2e8f0",
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                  <div
                    style={{
                      width: "30px",
                      height: "30px",
                      borderRadius: "50%",
                      backgroundColor: "#53869b",
                      color: "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "17px" }}>
                      bar_chart
                    </span>
                  </div>
                  <span style={{ fontSize: "16.5px", fontWeight: 500, color: "#1e293b", textTransform: "uppercase" }}>
                    CONTAS A RECEBER
                  </span>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "46px repeat(5, 1fr)",
                    gap: "10px",
                    alignItems: "center",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <IndicadorVariacaoSeta
                      atual={relatorioAtivo.contasAReceber.totalPeriodo}
                      anterior={relatorioAnterior?.contasAReceber?.totalPeriodo}
                      tamanho="sm"
                    />
                  </div>

                  {/* Vencidos */}
                  <div
                    style={{
                      backgroundColor: "#f8fafc",
                      borderRadius: "12px",
                      padding: "8px 10px",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: "12px", fontWeight: 800, color: "#0f172a", textTransform: "uppercase" }}>
                      VENCIDOS
                    </div>
                    <div style={{ fontSize: "21px", fontWeight: 800, color: "#ea9999", marginTop: "2px" }}>
                      {fmtCompactoOuDecimal(relatorioAtivo.contasAReceber.vencidos)}
                    </div>
                  </div>

                  {/* Vencem Hoje */}
                  <div
                    style={{
                      backgroundColor: "#f8fafc",
                      borderRadius: "12px",
                      padding: "8px 10px",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: "12px", fontWeight: 800, color: "#0f172a", textTransform: "uppercase" }}>
                      VENCEM HOJE
                    </div>
                    <div style={{ fontSize: "21px", fontWeight: 800, color: "#ea9999", marginTop: "2px" }}>
                      {fmtCompactoOuDecimal(relatorioAtivo.contasAReceber.vencemHoje)}
                    </div>
                  </div>

                  {/* A Vencer */}
                  <div
                    style={{
                      backgroundColor: "#f8fafc",
                      borderRadius: "12px",
                      padding: "8px 10px",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: "12px", fontWeight: 800, color: "#0f172a", textTransform: "uppercase" }}>
                      A VENCER
                    </div>
                    <div style={{ fontSize: "21px", fontWeight: 800, color: "#546e7a", marginTop: "2px" }}>
                      {fmtCompactoOuDecimal(relatorioAtivo.contasAReceber.aVencer)}
                    </div>
                  </div>

                  {/* Pagos */}
                  <div
                    style={{
                      backgroundColor: "#f8fafc",
                      borderRadius: "12px",
                      padding: "8px 10px",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: "12px", fontWeight: 800, color: "#0f172a", textTransform: "uppercase" }}>
                      PAGOS
                    </div>
                    <div style={{ fontSize: "21px", fontWeight: 800, color: "#67b887", marginTop: "2px" }}>
                      {fmtCompactoOuDecimal(relatorioAtivo.contasAReceber.pagos)}
                    </div>
                  </div>

                  {/* Total do Período */}
                  <div
                    style={{
                      backgroundColor: "#f8fafc",
                      borderRadius: "12px",
                      padding: "8px 10px",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: "12px", fontWeight: 800, color: "#0f172a", textTransform: "uppercase" }}>
                      TOTAL DO PERÍODO
                    </div>
                    <div style={{ fontSize: "21px", fontWeight: 800, color: "#546e7a", marginTop: "2px" }}>
                      {fmtNum(relatorioAtivo.contasAReceber.totalPeriodo)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* =================================================================
              LINHA 2: A RECEBER EM ATRASO + CASH BACK / CLARA + PROJETOS | VALORES
             ================================================================= */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(480px, 1.85fr) minmax(240px, 0.85fr) minmax(300px, 1.15fr)",
              gap: "18px",
              alignItems: "stretch",
            }}
          >
            {/* COLUNA 1: A RECEBER EM ATRASO + TOTAL A RECEBER + A VENCER EM ABERTO (Via Base de Dados) */}
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "14px" }}>
              <div
                style={{
                  backgroundColor: "#ffffff",
                  borderRadius: "16px",
                  padding: "16px 18px",
                  boxShadow: "0 2px 10px rgba(15, 42, 74, 0.04)",
                  border: "1px solid #e2e8f0",
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "50%",
                      backgroundColor: "#80c4c8",
                      color: "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                      date_range
                    </span>
                  </div>
                  <span style={{ fontSize: "17px", fontWeight: 500, color: "#1e293b", textTransform: "uppercase" }}>
                    A RECEBER EM ATRASO
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1 }}>
                  {/* Seta Comparativa Lateral */}
                  <div style={{ flexShrink: 0 }}>
                    <IndicadorVariacaoSeta
                      atual={relatorioAtivo.totalAtraso}
                      anterior={relatorioAnterior?.totalAtraso}
                      inverterSemantica={true}
                      tamanho="md"
                    />
                  </div>

                  {/* Tabela A Receber em Atraso */}
                  <div style={{ flex: 1, overflowX: "auto", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10.5px" }}>
                      <thead>
                        <tr
                          style={{
                            backgroundColor: "#0a3254",
                            color: "#ffffff",
                            textTransform: "uppercase",
                            fontWeight: 700,
                            fontSize: "9.5px",
                            letterSpacing: "0.03em",
                          }}
                        >
                          <th style={{ padding: "6px 6px", textAlign: "center" }}>REALIZADO</th>
                          <th style={{ padding: "6px 6px", textAlign: "center" }}>FATURADO</th>
                          <th style={{ padding: "6px 8px", textAlign: "center" }}>PROJETO</th>
                          <th style={{ padding: "6px 6px", textAlign: "center" }}>PERFIL</th>
                          <th style={{ padding: "6px 6px", textAlign: "center" }}>Nº NOTA</th>
                          <th style={{ padding: "6px 8px", textAlign: "right" }}>VALOR</th>
                          <th style={{ padding: "6px 6px", textAlign: "center" }}>DIAS</th>
                          <th style={{ padding: "6px 8px", textAlign: "center" }}>VENCIMENTO</th>
                        </tr>
                      </thead>
                      <tbody>
                        {relatorioAtivo.aReceberEmAtraso.map((item, idx) => (
                          <tr
                            key={`${item.numeroNota}-${item.projeto}-${idx}`}
                            style={{
                              backgroundColor: idx % 2 === 0 ? "#ffffff" : "#f1f5f9",
                              borderBottom: "1px solid #e2e8f0",
                              color: "#475569",
                            }}
                          >
                            <td style={{ padding: "4px 6px", textAlign: "center", whiteSpace: "nowrap" }}>
                              {item.realizado}
                            </td>
                            <td style={{ padding: "4px 6px", textAlign: "center", whiteSpace: "nowrap" }}>
                              {item.faturado}
                            </td>
                            <td
                              style={{
                                padding: "4px 8px",
                                textAlign: "center",
                                fontWeight: 600,
                                color: "#334155",
                                maxWidth: "180px",
                              }}
                            >
                              {item.projeto}
                            </td>
                            <td style={{ padding: "4px 6px", textAlign: "center", whiteSpace: "nowrap" }}>
                              {item.perfil}
                            </td>
                            <td style={{ padding: "4px 6px", textAlign: "center", whiteSpace: "nowrap" }}>
                              {item.numeroNota}
                            </td>
                            <td
                              style={{
                                padding: "4px 8px",
                                textAlign: "right",
                                fontWeight: 600,
                                color: "#334155",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {fmtNum(item.valor)}
                            </td>
                            <td
                              style={{
                                padding: "4px 6px",
                                textAlign: "center",
                                fontWeight: 800,
                                color: "#c00000",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {item.dias}
                            </td>
                            <td style={{ padding: "4px 8px", textAlign: "center", whiteSpace: "nowrap" }}>
                              {formatarDataBR(item.vencimento)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr
                          style={{
                            backgroundColor: "#0a3254",
                            color: "#ffffff",
                            fontWeight: 800,
                            fontSize: "11px",
                          }}
                        >
                          <td colSpan={5} style={{ padding: "6px 10px", textAlign: "right" }}>
                            TOTAL
                          </td>
                          <td style={{ padding: "6px 8px", textAlign: "right", whiteSpace: "nowrap" }}>
                            {fmtNum(relatorioAtivo.totalAtraso)}
                          </td>
                          <td colSpan={2} style={{ padding: "6px 8px", textAlign: "center" }}>
                            -
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>

              {/* RODAPÉ DA COLUNA 1: TOTAL A RECEBER & A VENCER EM ABERTO (Via Base de Dados) */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "16px",
                  padding: "4px 8px",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "50%",
                      backgroundColor: "#80c4c8",
                      color: "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      marginTop: "2px",
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                      date_range
                    </span>
                  </div>
                  <div>
                    <div style={{ fontSize: "16px", fontWeight: 500, color: "#1e293b", textTransform: "uppercase" }}>
                      TOTAL A RECEBER
                    </div>
                    <div style={{ fontSize: "24px", fontWeight: 800, color: "#0f172a", lineHeight: 1.15 }}>
                      {fmtNum(relatorioAtivo.totalAReceber)}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "50%",
                      backgroundColor: "#80c4c8",
                      color: "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      marginTop: "2px",
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                      schedule
                    </span>
                  </div>
                  <div>
                    <div style={{ fontSize: "16px", fontWeight: 500, color: "#1e293b", textTransform: "uppercase" }}>
                      A VENCER EM ABERTO
                    </div>
                    <div style={{ fontSize: "24px", fontWeight: 800, color: "#0f172a", lineHeight: 1.15 }}>
                      {fmtNum(relatorioAtivo.aVencerEmAberto)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* COLUNA 2: CASH BACK & CLARA DESCONTO NA FATURA (Manual no valor + Gráfico Automático) */}
            <div
              style={{
                backgroundColor: "#ffffff",
                borderRadius: "16px",
                padding: "16px 16px",
                boxShadow: "0 2px 10px rgba(15, 42, 74, 0.04)",
                border: "1px solid #e2e8f0",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: "18px",
              }}
            >
              {/* BLOCO SUPERIOR: CASH BACK */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div
                    style={{
                      width: "38px",
                      height: "38px",
                      borderRadius: "50%",
                      background: "linear-gradient(135deg, #c2f0c2 0%, #68b8e8 100%)",
                      color: "#1d4ed8",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>
                      flight_takeoff
                    </span>
                  </div>
                  <span style={{ fontSize: "16px", fontWeight: 500, color: "#1e293b", textTransform: "uppercase" }}>
                    CASH BACK
                  </span>
                </div>

                <div style={{ fontSize: "24px", fontWeight: 800, color: "#09314b" }}>
                  {fmtNum(relatorioAtivo.cashBack.totalAcumulado)}
                </div>

                {/* Gráfico Dinâmico de Colunas Cash Back (2023-2026) */}
                <div style={{ marginTop: "4px" }}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "48px 1fr",
                      gap: "4px",
                      alignItems: "stretch",
                      height: "120px",
                    }}
                  >
                    {/* Eixo Y */}
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        fontSize: "8.5px",
                        color: "#64748b",
                        textAlign: "right",
                        paddingRight: "4px",
                      }}
                    >
                      <span>{fmtNum(maxCashBack, 2)}</span>
                      <span>{fmtNum(maxCashBack * 0.75, 2)}</span>
                      <span>{fmtNum(maxCashBack * 0.5, 2)}</span>
                      <span>{fmtNum(maxCashBack * 0.25, 2)}</span>
                      <span>0,00</span>
                    </div>

                    {/* Área das Barras */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(4, 1fr)",
                        alignItems: "end",
                        borderBottom: "1px solid #cbd5e1",
                        paddingBottom: "2px",
                        gap: "8px",
                        background:
                          "repeating-linear-gradient(to bottom, #f1f5f9 0px, #f1f5f9 1px, transparent 1px, transparent 29px)",
                      }}
                    >
                      {anosGrafico.map((ano) => {
                        const val = Number(relatorioAtivo.cashBack.anos[ano]) || 0;
                        const alturaPct = Math.min(100, Math.max(4, Math.round((val / maxCashBack) * 100)));
                        return (
                          <div
                            key={ano}
                            style={{
                              height: "100%",
                              display: "flex",
                              alignItems: "flex-end",
                              justifyContent: "center",
                            }}
                          >
                            <div
                              title={`${ano}: R$ ${fmtNum(val)}`}
                              style={{
                                width: "22px",
                                height: `${alturaPct}%`,
                                backgroundColor: "#1b84d4",
                                borderRadius: "2px 2px 0 0",
                                transition: "height 0.3s ease",
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Tabela Integrada na Base do Gráfico */}
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: "8.5px",
                      color: "#475569",
                      marginTop: "2px",
                    }}
                  >
                    <thead>
                      <tr>
                        <th style={{ width: "48px", border: "1px solid #e2e8f0", padding: "2px" }} />
                        {anosGrafico.map((ano) => (
                          <th
                            key={ano}
                            style={{
                              border: "1px solid #e2e8f0",
                              padding: "2px",
                              textAlign: "center",
                              fontWeight: 700,
                            }}
                          >
                            {ano}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td
                          style={{
                            border: "1px solid #e2e8f0",
                            padding: "2px 3px",
                            fontWeight: 700,
                            whiteSpace: "nowrap",
                          }}
                        >
                          <span
                            style={{
                              display: "inline-block",
                              width: "6px",
                              height: "6px",
                              backgroundColor: "#1b84d4",
                              marginRight: "3px",
                            }}
                          />
                          Total
                        </td>
                        {anosGrafico.map((ano) => (
                          <td
                            key={ano}
                            style={{
                              border: "1px solid #e2e8f0",
                              padding: "2px",
                              textAlign: "center",
                              fontWeight: 600,
                            }}
                          >
                            {fmtNum(relatorioAtivo.cashBack.anos[ano])}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* BLOCO INFERIOR: CLARA DESCONTO NA FATURA */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  borderTop: "1px dashed #e2e8f0",
                  paddingTop: "14px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span
                      style={{
                        width: "20px",
                        height: "20px",
                        borderRadius: "50%",
                        backgroundColor: "#0f172a",
                        color: "#ffffff",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "11px",
                      }}
                    >
                      ✦
                    </span>
                    <span
                      style={{
                        fontWeight: 800,
                        fontSize: "16px",
                        color: "#0f172a",
                        fontFamily: "Georgia, serif",
                        letterSpacing: "0.03em",
                      }}
                    >
                      CLARA
                    </span>
                  </div>
                  <span style={{ fontSize: "11.5px", fontWeight: 500, color: "#1e293b", textTransform: "uppercase" }}>
                    DESCONTO NA FATURA
                  </span>
                </div>

                <div style={{ fontSize: "24px", fontWeight: 800, color: "#09314b" }}>
                  {fmtNum(relatorioAtivo.claraDesconto.totalAcumulado)}
                </div>

                {/* Gráfico Dinâmico de Colunas Clara Desconto (2023-2026) */}
                <div style={{ marginTop: "4px" }}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "48px 1fr",
                      gap: "4px",
                      alignItems: "stretch",
                      height: "120px",
                    }}
                  >
                    {/* Eixo Y */}
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        fontSize: "8.5px",
                        color: "#64748b",
                        textAlign: "right",
                        paddingRight: "4px",
                      }}
                    >
                      <span>{fmtNum(maxClara, 2)}</span>
                      <span>{fmtNum(maxClara * 0.8, 2)}</span>
                      <span>{fmtNum(maxClara * 0.6, 2)}</span>
                      <span>{fmtNum(maxClara * 0.4, 2)}</span>
                      <span>{fmtNum(maxClara * 0.2, 2)}</span>
                      <span>0,00</span>
                    </div>

                    {/* Área das Barras */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(4, 1fr)",
                        alignItems: "end",
                        borderBottom: "1px solid #cbd5e1",
                        paddingBottom: "2px",
                        gap: "8px",
                        background:
                          "repeating-linear-gradient(to bottom, #f1f5f9 0px, #f1f5f9 1px, transparent 1px, transparent 23px)",
                      }}
                    >
                      {anosGrafico.map((ano) => {
                        const val = Number(relatorioAtivo.claraDesconto.anos[ano]) || 0;
                        const alturaPct = Math.min(100, Math.max(3, Math.round((val / maxClara) * 100)));
                        return (
                          <div
                            key={ano}
                            style={{
                              height: "100%",
                              display: "flex",
                              alignItems: "flex-end",
                              justifyContent: "center",
                            }}
                          >
                            <div
                              title={`${ano}: R$ ${fmtNum(val)}`}
                              style={{
                                width: "22px",
                                height: `${alturaPct}%`,
                                backgroundColor: "#0c3c52",
                                borderRadius: "2px 2px 0 0",
                                transition: "height 0.3s ease",
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Tabela Integrada na Base do Gráfico */}
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: "8.5px",
                      color: "#475569",
                      marginTop: "2px",
                    }}
                  >
                    <thead>
                      <tr>
                        <th style={{ width: "48px", border: "1px solid #e2e8f0", padding: "2px" }} />
                        {anosGrafico.map((ano) => (
                          <th
                            key={ano}
                            style={{
                              border: "1px solid #e2e8f0",
                              padding: "2px",
                              textAlign: "center",
                              fontWeight: 700,
                            }}
                          >
                            {ano}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td
                          style={{
                            border: "1px solid #e2e8f0",
                            padding: "2px 3px",
                            fontWeight: 700,
                            whiteSpace: "nowrap",
                          }}
                        >
                          <span
                            style={{
                              display: "inline-block",
                              width: "6px",
                              height: "6px",
                              backgroundColor: "#0c3c52",
                              marginRight: "3px",
                            }}
                          />
                          Total
                        </td>
                        {anosGrafico.map((ano) => (
                          <td
                            key={ano}
                            style={{
                              border: "1px solid #e2e8f0",
                              padding: "2px",
                              textAlign: "center",
                              fontWeight: 600,
                            }}
                          >
                            {fmtNum(relatorioAtivo.claraDesconto.anos[ano])}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* COLUNA 3: PROJETOS | VALORES (Via Base de Dados do Mês Corrente) */}
            <div
              style={{
                backgroundColor: "#ffffff",
                borderRadius: "16px",
                padding: "16px 18px",
                boxShadow: "0 2px 10px rgba(15, 42, 74, 0.04)",
                border: "1px solid #e2e8f0",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              {/* Cabeçalho Projetos + Seta Comparativa + Valores */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "10px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div
                    style={{
                      width: "34px",
                      height: "34px",
                      borderRadius: "50%",
                      backgroundColor: "#80c4c8",
                      color: "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "19px" }}>
                      analytics
                    </span>
                  </div>
                  <span style={{ fontSize: "18px", fontWeight: 500, color: "#1e293b", textTransform: "uppercase" }}>
                    PROJETOS
                  </span>
                </div>

                <IndicadorVariacaoSeta
                  atual={relatorioAtivo.totalProjetos}
                  anterior={relatorioAnterior?.totalProjetos}
                  tamanho="md"
                />

                <span style={{ fontSize: "18px", fontWeight: 500, color: "#1e293b", textTransform: "uppercase" }}>
                  VALORES
                </span>
              </div>

              {/* Lista de Projetos do Mês Corrente */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
                  <tbody>
                    {relatorioAtivo.projetosMes.map((p, idx) => (
                      <tr
                        key={p.projeto}
                        style={{
                          backgroundColor: idx % 2 === 0 ? "#f0f7fa" : "#ffffff",
                        }}
                      >
                        <td
                          style={{
                            padding: "4.5px 8px",
                            color: "#64748b",
                            fontWeight: 500,
                            textTransform: "uppercase",
                          }}
                        >
                          {p.projeto}
                        </td>
                        <td
                          style={{
                            padding: "4.5px 8px",
                            textAlign: "right",
                            color: "#475569",
                            fontWeight: 600,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {fmtNum(p.valor)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr
                      style={{
                        backgroundColor: "#0a3254",
                        color: "#ffffff",
                        fontWeight: 800,
                        fontSize: "12px",
                      }}
                    >
                      <td style={{ padding: "7px 10px" }}>TOTAL</td>
                      <td style={{ padding: "7px 10px", textAlign: "right", whiteSpace: "nowrap" }}>
                        {fmtNum(relatorioAtivo.totalProjetos)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================================
          MODAL 1: HISTÓRICO DE RELATÓRIOS SEMANAIS ENVIADOS
         ===================================================================== */}
      {modalHistoricoAberto && (
        <div
          className="modal-backdrop"
          onClick={() => setModalHistoricoAberto(false)}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(9, 21, 38, 0.6)",
            backdropFilter: "blur(4px)",
            zIndex: 9000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
        >
          <div
            className="modal-container"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: "860px",
              backgroundColor: "var(--surface-container-lowest, #ffffff)",
              borderRadius: "18px",
              border: "1px solid var(--border, #e2e8f0)",
              overflow: "hidden",
              boxShadow: "0 24px 60px rgba(0, 0, 0, 0.3)",
            }}
          >
            <div
              className="modal-header"
              style={{
                padding: "16px 22px",
                backgroundColor: "#0a3254",
                color: "#ffffff",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span className="material-symbols-outlined" style={{ color: "#38bdf8" }}>
                  history
                </span>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800 }}>
                  Histórico de Relatórios de Acompanhamento Semanal Enviados
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalHistoricoAberto(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#ffffff",
                  cursor: "pointer",
                  display: "flex",
                }}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div style={{ padding: "20px 22px", maxHeight: "70vh", overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12.5px" }}>
                <thead>
                  <tr
                    style={{
                      backgroundColor: "var(--surface-container-low, #f8fafc)",
                      borderBottom: "1px solid var(--border, #e2e8f0)",
                      textAlign: "left",
                      fontSize: "11px",
                      textTransform: "uppercase",
                      color: "var(--on-surface-variant)",
                    }}
                  >
                    <th style={{ padding: "10px 12px" }}>Data do Relatório</th>
                    <th style={{ padding: "10px 12px" }}>Mês Ref.</th>
                    <th style={{ padding: "10px 12px", textAlign: "right" }}>Posição Financeira</th>
                    <th style={{ padding: "10px 12px", textAlign: "right" }}>Contas a Pagar</th>
                    <th style={{ padding: "10px 12px", textAlign: "right" }}>Total a Receber</th>
                    <th style={{ padding: "10px 12px", textAlign: "right" }}>Projetos (Mês)</th>
                    <th style={{ padding: "10px 12px", textAlign: "center" }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {historico.map((item, idx) => {
                    const isAtual = item.id === relatorioSelecionadoId;
                    return (
                      <tr
                        key={item.id}
                        style={{
                          borderBottom: "1px solid var(--border, #f1f5f9)",
                          backgroundColor: isAtual ? "rgba(2, 132, 199, 0.08)" : "transparent",
                        }}
                      >
                        <td style={{ padding: "12px", fontWeight: 800 }}>
                          {formatarDataBR(item.dataReferencia)}
                          {idx === 0 && (
                            <span
                              style={{
                                marginLeft: "8px",
                                padding: "2px 7px",
                                borderRadius: "999px",
                                fontSize: "10px",
                                backgroundColor: "#dcfce7",
                                color: "#15803d",
                                fontWeight: 800,
                              }}
                            >
                              Último Enviado
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "12px", fontWeight: 600 }}>
                          {item.mesReferencia}/{item.anoReferencia}
                        </td>
                        <td style={{ padding: "12px", textAlign: "right", fontWeight: 700 }}>
                          R$ {fmtNum(item.posicaoFinanceira.total)}
                        </td>
                        <td style={{ padding: "12px", textAlign: "right", fontWeight: 600 }}>
                          R$ {fmtNum(item.contasAPagar.totalPeriodo)}
                        </td>
                        <td style={{ padding: "12px", textAlign: "right", fontWeight: 700, color: "#0284c7" }}>
                          R$ {fmtNum(item.totalAReceber)}
                        </td>
                        <td style={{ padding: "12px", textAlign: "right", fontWeight: 700, color: "#059669" }}>
                          R$ {fmtNum(item.totalProjetos)}
                        </td>
                        <td style={{ padding: "12px", textAlign: "center" }}>
                          <div style={{ display: "inline-flex", gap: "8px" }}>
                            <button
                              type="button"
                              onClick={() => {
                                setRelatorioSelecionadoId(item.id);
                                setModalHistoricoAberto(false);
                              }}
                              style={{
                                padding: "5px 10px",
                                borderRadius: "6px",
                                border: "1px solid #0284c7",
                                backgroundColor: isAtual ? "#0284c7" : "transparent",
                                color: isAtual ? "#ffffff" : "#0284c7",
                                fontSize: "11px",
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                            >
                              {isAtual ? "Em Exibição" : "Visualizar"}
                            </button>
                            {historico.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleExcluirRelatorio(item.id, item.dataReferencia)}
                                title="Excluir este envio do histórico"
                                style={{
                                  padding: "5px 8px",
                                  borderRadius: "6px",
                                  border: "1px solid #fecaca",
                                  backgroundColor: "transparent",
                                  color: "#dc2626",
                                  fontSize: "11px",
                                  cursor: "pointer",
                                }}
                              >
                                Excluir
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 2: PREENCHIMENTO MANUAL & SINCRONIZAÇÃO COM A BASE DE DADOS
         ===================================================================== */}
      {modalEdicaoAberto && (
        <div
          className="modal-backdrop"
          onClick={() => setModalEdicaoAberto(false)}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(9, 21, 38, 0.65)",
            backdropFilter: "blur(4px)",
            zIndex: 9000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
        >
          <div
            className="modal-container"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: "960px",
              maxHeight: "92vh",
              backgroundColor: "var(--surface-container-lowest, #ffffff)",
              borderRadius: "18px",
              border: "1px solid var(--border, #e2e8f0)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              boxShadow: "0 24px 60px rgba(0, 0, 0, 0.35)",
            }}
          >
            {/* Header do Modal */}
            <div
              className="modal-header"
              style={{
                padding: "16px 24px",
                backgroundColor: "#0a3254",
                color: "#ffffff",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span className="material-symbols-outlined" style={{ color: "#38bdf8" }}>
                  edit_document
                </span>
                <div>
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800 }}>
                    Configurar &amp; Publicar Relatório de Acompanhamento Semanal
                  </h3>
                  <span style={{ fontSize: "11.5px", color: "#bae6fd" }}>
                    Preenchimento manual de Posição Financeira, Contas a Pagar/Receber, Cash Back e Clara + Dados
                    automáticos da Base
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalEdicaoAberto(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#ffffff",
                  cursor: "pointer",
                  display: "flex",
                }}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Corpo do Formulário */}
            <form
              onSubmit={handleSalvarRelatorio}
              style={{ padding: "20px 24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "18px" }}
            >
              {/* 1. Data de Referência, Mês Corrente e Botão de Sincronização com a Base */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "180px 180px 1fr",
                  gap: "14px",
                  alignItems: "end",
                  padding: "14px 16px",
                  borderRadius: "12px",
                  backgroundColor: "var(--surface-container-low, #f8fafc)",
                  border: "1px solid var(--border, #e2e8f0)",
                }}
              >
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 800, marginBottom: "4px" }}>
                    DATA DO RELATÓRIO *
                  </label>
                  <input
                    type="date"
                    required
                    value={formRelatorio.dataReferencia}
                    onChange={(e) =>
                      setFormRelatorio((prev) => ({
                        ...prev,
                        dataReferencia: e.target.value,
                        id: `sem-${e.target.value}`,
                      }))
                    }
                    className="form-input"
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 800, marginBottom: "4px" }}>
                    MÊS CORRENTE *
                  </label>
                  <input
                    type="text"
                    required
                    value={formRelatorio.mesReferencia}
                    onChange={(e) =>
                      setFormRelatorio((prev) => ({ ...prev, mesReferencia: e.target.value.toUpperCase() }))
                    }
                    className="form-input"
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    disabled={sincronizandoBase}
                    onClick={() => sincronizarDadosBaseNoForm(formRelatorio.dataReferencia)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "9px 14px",
                      borderRadius: "9px",
                      border: "1px solid #0284c7",
                      backgroundColor: "rgba(2, 132, 199, 0.1)",
                      color: "#0284c7",
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor: sincronizandoBase ? "wait" : "pointer",
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "17px" }}>
                      sync
                    </span>
                    <span>
                      {sincronizandoBase
                        ? "Sincronizando Base..."
                        : "Atualizar Atrasos, A Receber e Projetos via Base de Dados"}
                    </span>
                  </button>
                </div>
              </div>

              {/* 2. POSIÇÃO FINANCEIRA (Preenchimento Manual) */}
              <div
                style={{
                  padding: "14px 16px",
                  borderRadius: "12px",
                  border: "1px solid var(--border, #e2e8f0)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong style={{ fontSize: "13px", color: "#0284c7", textTransform: "uppercase" }}>
                    1. Posição Financeira (Preenchimento Manual)
                  </strong>
                  <span style={{ fontSize: "12.5px", fontWeight: 800 }}>
                    Total Calculado: R${" "}
                    {fmtNum(
                      (Number(formRelatorio.posicaoFinanceira.sicoob.caixa) || 0) +
                        (Number(formRelatorio.posicaoFinanceira.sicoob.aplicacao) || 0) +
                        (Number(formRelatorio.posicaoFinanceira.clara.caixa) || 0) +
                        (Number(formRelatorio.posicaoFinanceira.clara.aplicacao) || 0) +
                        (Number(formRelatorio.posicaoFinanceira.itau.caixa) || 0) +
                        (Number(formRelatorio.posicaoFinanceira.itau.aplicacao) || 0)
                    )}
                  </span>
                </div>

                {(["sicoob", "clara", "itau"] as const).map((inst) => (
                  <div
                    key={inst}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "110px 1fr 1fr 140px",
                      gap: "10px",
                      alignItems: "center",
                    }}
                  >
                    <span style={{ fontWeight: 800, textTransform: "uppercase", fontSize: "12px" }}>
                      {inst === "itau" ? "ITAÚ" : inst.toUpperCase()}
                    </span>
                    <div>
                      <label style={{ fontSize: "10px", fontWeight: 700 }}>CAIXA (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formRelatorio.posicaoFinanceira[inst].caixa}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setFormRelatorio((prev) => ({
                            ...prev,
                            posicaoFinanceira: {
                              ...prev.posicaoFinanceira,
                              [inst]: { ...prev.posicaoFinanceira[inst], caixa: val },
                            },
                          }));
                        }}
                        className="form-input"
                        style={{ width: "100%", padding: "6px 8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "10px", fontWeight: 700 }}>APLICAÇÃO (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formRelatorio.posicaoFinanceira[inst].aplicacao}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setFormRelatorio((prev) => ({
                            ...prev,
                            posicaoFinanceira: {
                              ...prev.posicaoFinanceira,
                              [inst]: { ...prev.posicaoFinanceira[inst], aplicacao: val },
                            },
                          }));
                        }}
                        className="form-input"
                        style={{ width: "100%", padding: "6px 8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "10px", fontWeight: 700 }}>RENTABILIDADE</label>
                      <input
                        type="text"
                        value={formRelatorio.posicaoFinanceira[inst].rentabilidade}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormRelatorio((prev) => ({
                            ...prev,
                            posicaoFinanceira: {
                              ...prev.posicaoFinanceira,
                              [inst]: { ...prev.posicaoFinanceira[inst], rentabilidade: val },
                            },
                          }));
                        }}
                        className="form-input"
                        style={{ width: "100%", padding: "6px 8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* 3. CONTAS A PAGAR & CONTAS A RECEBER (Preenchimento Manual) */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                {/* Contas a Pagar */}
                <div
                  style={{
                    padding: "14px 16px",
                    borderRadius: "12px",
                    border: "1px solid var(--border, #e2e8f0)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  <strong style={{ fontSize: "13px", color: "#0284c7", textTransform: "uppercase" }}>
                    2. Contas a Pagar (Preenchimento Manual)
                  </strong>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <div>
                      <label style={{ fontSize: "10px", fontWeight: 700 }}>VENCIDOS (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formRelatorio.contasAPagar.vencidos}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value) || 0;
                          setFormRelatorio((prev) => ({
                            ...prev,
                            contasAPagar: {
                              ...prev.contasAPagar,
                              vencidos: v,
                              totalPeriodo:
                                Math.round(
                                  (v +
                                    prev.contasAPagar.vencemHoje +
                                    prev.contasAPagar.aVencer +
                                    prev.contasAPagar.pagos) *
                                    100
                                ) / 100,
                            },
                          }));
                        }}
                        className="form-input"
                        style={{ width: "100%", padding: "6px 8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "10px", fontWeight: 700 }}>VENCEM HOJE (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formRelatorio.contasAPagar.vencemHoje}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value) || 0;
                          setFormRelatorio((prev) => ({
                            ...prev,
                            contasAPagar: {
                              ...prev.contasAPagar,
                              vencemHoje: v,
                              totalPeriodo:
                                Math.round(
                                  (prev.contasAPagar.vencidos +
                                    v +
                                    prev.contasAPagar.aVencer +
                                    prev.contasAPagar.pagos) *
                                    100
                                ) / 100,
                            },
                          }));
                        }}
                        className="form-input"
                        style={{ width: "100%", padding: "6px 8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "10px", fontWeight: 700 }}>A VENCER (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formRelatorio.contasAPagar.aVencer}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value) || 0;
                          setFormRelatorio((prev) => ({
                            ...prev,
                            contasAPagar: {
                              ...prev.contasAPagar,
                              aVencer: v,
                              totalPeriodo:
                                Math.round(
                                  (prev.contasAPagar.vencidos +
                                    prev.contasAPagar.vencemHoje +
                                    v +
                                    prev.contasAPagar.pagos) *
                                    100
                                ) / 100,
                            },
                          }));
                        }}
                        className="form-input"
                        style={{ width: "100%", padding: "6px 8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "10px", fontWeight: 700 }}>PAGOS (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formRelatorio.contasAPagar.pagos}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value) || 0;
                          setFormRelatorio((prev) => ({
                            ...prev,
                            contasAPagar: {
                              ...prev.contasAPagar,
                              pagos: v,
                              totalPeriodo:
                                Math.round(
                                  (prev.contasAPagar.vencidos +
                                    prev.contasAPagar.vencemHoje +
                                    prev.contasAPagar.aVencer +
                                    v) *
                                    100
                                ) / 100,
                            },
                          }));
                        }}
                        className="form-input"
                        style={{ width: "100%", padding: "6px 8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                      />
                    </div>
                    <div style={{ gridColumn: "1 / -1" }}>
                      <label style={{ fontSize: "10px", fontWeight: 800 }}>TOTAL DO PERÍODO (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formRelatorio.contasAPagar.totalPeriodo}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value) || 0;
                          setFormRelatorio((prev) => ({
                            ...prev,
                            contasAPagar: { ...prev.contasAPagar, totalPeriodo: v },
                          }));
                        }}
                        className="form-input"
                        style={{ width: "100%", padding: "6px 8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                      />
                    </div>
                  </div>
                </div>

                {/* Contas a Receber */}
                <div
                  style={{
                    padding: "14px 16px",
                    borderRadius: "12px",
                    border: "1px solid var(--border, #e2e8f0)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  <strong style={{ fontSize: "13px", color: "#0284c7", textTransform: "uppercase" }}>
                    3. Contas a Receber (Preenchimento Manual)
                  </strong>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <div>
                      <label style={{ fontSize: "10px", fontWeight: 700 }}>VENCIDOS (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formRelatorio.contasAReceber.vencidos}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value) || 0;
                          setFormRelatorio((prev) => ({
                            ...prev,
                            contasAReceber: {
                              ...prev.contasAReceber,
                              vencidos: v,
                              totalPeriodo:
                                Math.round(
                                  (v +
                                    prev.contasAReceber.vencemHoje +
                                    prev.contasAReceber.aVencer +
                                    prev.contasAReceber.pagos) *
                                    100
                                ) / 100,
                            },
                          }));
                        }}
                        className="form-input"
                        style={{ width: "100%", padding: "6px 8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "10px", fontWeight: 700 }}>VENCEM HOJE (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formRelatorio.contasAReceber.vencemHoje}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value) || 0;
                          setFormRelatorio((prev) => ({
                            ...prev,
                            contasAReceber: {
                              ...prev.contasAReceber,
                              vencemHoje: v,
                              totalPeriodo:
                                Math.round(
                                  (prev.contasAReceber.vencidos +
                                    v +
                                    prev.contasAReceber.aVencer +
                                    prev.contasAReceber.pagos) *
                                    100
                                ) / 100,
                            },
                          }));
                        }}
                        className="form-input"
                        style={{ width: "100%", padding: "6px 8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "10px", fontWeight: 700 }}>A VENCER (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formRelatorio.contasAReceber.aVencer}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value) || 0;
                          setFormRelatorio((prev) => ({
                            ...prev,
                            contasAReceber: {
                              ...prev.contasAReceber,
                              aVencer: v,
                              totalPeriodo:
                                Math.round(
                                  (prev.contasAReceber.vencidos +
                                    prev.contasAReceber.vencemHoje +
                                    v +
                                    prev.contasAReceber.pagos) *
                                    100
                                ) / 100,
                            },
                          }));
                        }}
                        className="form-input"
                        style={{ width: "100%", padding: "6px 8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "10px", fontWeight: 700 }}>PAGOS (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formRelatorio.contasAReceber.pagos}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value) || 0;
                          setFormRelatorio((prev) => ({
                            ...prev,
                            contasAReceber: {
                              ...prev.contasAReceber,
                              pagos: v,
                              totalPeriodo:
                                Math.round(
                                  (prev.contasAReceber.vencidos +
                                    prev.contasAReceber.vencemHoje +
                                    prev.contasAReceber.aVencer +
                                    v) *
                                    100
                                ) / 100,
                            },
                          }));
                        }}
                        className="form-input"
                        style={{ width: "100%", padding: "6px 8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                      />
                    </div>
                    <div style={{ gridColumn: "1 / -1" }}>
                      <label style={{ fontSize: "10px", fontWeight: 800 }}>TOTAL DO PERÍODO (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formRelatorio.contasAReceber.totalPeriodo}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value) || 0;
                          setFormRelatorio((prev) => ({
                            ...prev,
                            contasAReceber: { ...prev.contasAReceber, totalPeriodo: v },
                          }));
                        }}
                        className="form-input"
                        style={{ width: "100%", padding: "6px 8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 4. CASH BACK & CLARA DESCONTO (Preenchimento Manual -> Gráfico Ajustado Automaticamente) */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                {/* Cash Back */}
                <div
                  style={{
                    padding: "14px 16px",
                    borderRadius: "12px",
                    border: "1px solid var(--border, #e2e8f0)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  <strong style={{ fontSize: "13px", color: "#0284c7", textTransform: "uppercase" }}>
                    4. Cash Back (Manual • Gráfico Ajusta Automaticamente)
                  </strong>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px" }}>
                    {anosGrafico.map((ano) => (
                      <div key={ano}>
                        <label style={{ fontSize: "10px", fontWeight: 700 }}>{ano} (R$)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={formRelatorio.cashBack.anos[ano]}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value) || 0;
                            setFormRelatorio((prev) => {
                              const novosAnos = { ...prev.cashBack.anos, [ano]: v };
                              const diffAno = v - (Number(prev.cashBack.anos[ano]) || 0);
                              return {
                                ...prev,
                                cashBack: {
                                  anos: novosAnos,
                                  totalAcumulado:
                                    Math.round(((Number(prev.cashBack.totalAcumulado) || 0) + diffAno) * 100) / 100,
                                },
                              };
                            });
                          }}
                          className="form-input"
                          style={{ width: "100%", padding: "6px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                        />
                      </div>
                    ))}
                  </div>
                  <div>
                    <label style={{ fontSize: "10px", fontWeight: 800 }}>VALOR TOTAL EXIBIDO NO CARD (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formRelatorio.cashBack.totalAcumulado}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value) || 0;
                        setFormRelatorio((prev) => ({
                          ...prev,
                          cashBack: { ...prev.cashBack, totalAcumulado: v },
                        }));
                      }}
                      className="form-input"
                      style={{ width: "100%", padding: "6px 8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                    />
                  </div>
                </div>

                {/* Clara Desconto */}
                <div
                  style={{
                    padding: "14px 16px",
                    borderRadius: "12px",
                    border: "1px solid var(--border, #e2e8f0)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  <strong style={{ fontSize: "13px", color: "#0284c7", textTransform: "uppercase" }}>
                    5. Clara Desconto (Manual • Gráfico Ajusta Automaticamente)
                  </strong>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px" }}>
                    {anosGrafico.map((ano) => (
                      <div key={ano}>
                        <label style={{ fontSize: "10px", fontWeight: 700 }}>{ano} (R$)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={formRelatorio.claraDesconto.anos[ano]}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value) || 0;
                            setFormRelatorio((prev) => {
                              const novosAnos = { ...prev.claraDesconto.anos, [ano]: v };
                              const soma =
                                Math.round(
                                  (novosAnos["2023"] + novosAnos["2024"] + novosAnos["2025"] + novosAnos["2026"]) * 100
                                ) / 100;
                              return {
                                ...prev,
                                claraDesconto: {
                                  anos: novosAnos,
                                  totalAcumulado: soma,
                                },
                              };
                            });
                          }}
                          className="form-input"
                          style={{ width: "100%", padding: "6px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                        />
                      </div>
                    ))}
                  </div>
                  <div>
                    <label style={{ fontSize: "10px", fontWeight: 800 }}>VALOR TOTAL EXIBIDO NO CARD (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formRelatorio.claraDesconto.totalAcumulado}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value) || 0;
                        setFormRelatorio((prev) => ({
                          ...prev,
                          claraDesconto: { ...prev.claraDesconto, totalAcumulado: v },
                        }));
                      }}
                      className="form-input"
                      style={{ width: "100%", padding: "6px 8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                    />
                  </div>
                </div>
              </div>

              {/* Resumo dos Blocos Automáticos via Base de Dados */}
              <div
                style={{
                  padding: "12px 16px",
                  borderRadius: "12px",
                  backgroundColor: "rgba(2, 132, 199, 0.07)",
                  border: "1px solid rgba(2, 132, 199, 0.25)",
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: "12px",
                  fontSize: "12px",
                }}
              >
                <div>
                  <span style={{ color: "var(--on-surface-variant)", fontSize: "10.5px", fontWeight: 700 }}>
                    A RECEBER EM ATRASO (BASE)
                  </span>
                  <div style={{ fontWeight: 800, fontSize: "14px", color: "#dc2626" }}>
                    R$ {fmtNum(formRelatorio.totalAtraso)} ({formRelatorio.aReceberEmAtraso.length} títulos)
                  </div>
                </div>
                <div>
                  <span style={{ color: "var(--on-surface-variant)", fontSize: "10.5px", fontWeight: 700 }}>
                    A VENCER EM ABERTO (BASE)
                  </span>
                  <div style={{ fontWeight: 800, fontSize: "14px" }}>R$ {fmtNum(formRelatorio.aVencerEmAberto)}</div>
                </div>
                <div>
                  <span style={{ color: "var(--on-surface-variant)", fontSize: "10.5px", fontWeight: 700 }}>
                    TOTAL A RECEBER (BASE)
                  </span>
                  <div style={{ fontWeight: 800, fontSize: "14px", color: "#0284c7" }}>
                    R$ {fmtNum(formRelatorio.totalAReceber)}
                  </div>
                </div>
                <div>
                  <span style={{ color: "var(--on-surface-variant)", fontSize: "10.5px", fontWeight: 700 }}>
                    PROJETOS DO MÊS (BASE)
                  </span>
                  <div style={{ fontWeight: 800, fontSize: "14px", color: "#059669" }}>
                    R$ {fmtNum(formRelatorio.totalProjetos)} ({formRelatorio.projetosMes.length} projetos)
                  </div>
                </div>
              </div>

              {/* Rodapé do Modal */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", paddingTop: "6px" }}>
                <button
                  type="button"
                  onClick={() => setModalEdicaoAberto(false)}
                  className="btn-secondary"
                  style={{ padding: "10px 18px", borderRadius: "10px", fontWeight: 700, cursor: "pointer" }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="btn-primary"
                  style={{
                    padding: "10px 22px",
                    borderRadius: "10px",
                    fontWeight: 800,
                    cursor: salvando ? "wait" : "pointer",
                    background: "linear-gradient(135deg, #0083ca 0%, #0a4e82 100%)",
                    color: "#ffffff",
                    border: "none",
                  }}
                >
                  {salvando ? "Salvando..." : "Salvar & Publicar no Histórico"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </RelatorioShell>
  );
}
