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

interface IndicadorInicialOverride {
  pct: number;
  ehPositivo: boolean;
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
  indicadoresIniciais?: {
    posicaoFinanceira?: IndicadorInicialOverride;
    contasAPagar?: IndicadorInicialOverride;
    contasAReceber?: IndicadorInicialOverride;
    aReceberEmAtraso?: IndicadorInicialOverride;
    projetosMes?: IndicadorInicialOverride;
  };
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

// Input Monetário formatado no padrão brasileiro 0.000,00 (com suporte a sinal negativo)
function InputMoedaBR({
  value,
  onChange,
  style,
}: {
  value: number;
  onChange: (novoValor: number) => void;
  style?: React.CSSProperties;
}) {
  const formatarMoeda = (num: number) => {
    const n = Number(num) || 0;
    const negativo = n < 0;
    const abs = Math.abs(n);
    const fmt = abs.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return negativo ? `-${fmt}` : fmt;
  };

  const [texto, setTexto] = useState<string>(() => formatarMoeda(value));
  const [focado, setFocado] = useState(false);

  useEffect(() => {
    if (!focado) {
      setTexto(formatarMoeda(value));
    }
  }, [value, focado]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const negativo = raw.trim().startsWith("-");
    const apenasDigitos = raw.replace(/\D/g, "");
    const centavos = parseInt(apenasDigitos || "0", 10);
    const numero = (negativo ? -1 : 1) * (centavos / 100);
    setTexto(formatarMoeda(numero));
    onChange(Math.round(numero * 100) / 100);
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      value={texto}
      onFocus={() => setFocado(true)}
      onBlur={() => {
        setFocado(false);
        setTexto(formatarMoeda(value));
      }}
      onChange={handleChange}
      className="form-input"
      style={{
        width: "100%",
        padding: "7px 10px",
        borderRadius: "7px",
        border: "1px solid #cbd5e1",
        fontFamily: "var(--font-jakarta, 'Plus Jakarta Sans', sans-serif)",
        fontSize: "13px",
        fontWeight: 600,
        ...style,
      }}
    />
  );
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
  overrideSemAnterior,
  tamanho = "md",
}: {
  atual: number;
  anterior?: number | null;
  inverterSemantica?: boolean;
  overrideSemAnterior?: IndicadorInicialOverride;
  tamanho?: "sm" | "md" | "lg";
}) {
  let pct = 0;
  let ehPositivo = true;

  if (anterior !== undefined && anterior !== null && anterior !== 0) {
    const calc = calcularVariacao(atual, anterior);
    pct = calc.pct;
    ehPositivo = inverterSemantica ? !calc.subiu : calc.subiu;
  } else if (overrideSemAnterior) {
    pct = overrideSemAnterior.pct;
    ehPositivo = overrideSemAnterior.ehPositivo;
  }

  const corBorda = ehPositivo ? "#a7dec7" : "#f5b5b8";
  const corSeta = ehPositivo ? "#9fd8be" : "#f2a6aa";
  const corTexto = "#334155";
  const setaParaCima = ehPositivo;

  const dim = tamanho === "lg" ? 48 : tamanho === "sm" ? 36 : 42;
  const fontPct = tamanho === "lg" ? "13px" : tamanho === "sm" ? "10.5px" : "11.5px";

  return (
    <div
      title={
        anterior != null
          ? `Variação em relação ao relatório anterior (${fmtNum(anterior)} -> ${fmtNum(atual)})`
          : "Indicador comparativo em relação ao relatório anterior"
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

  // Modo de edição e criação de novo Relatório Semanal permitido APENAS pelo Adm
  const podeEditarRelatorio =
    perfilAtivoId === "ADMIN" || (!perfilAtivoId && usuarioLogado?.perfilId === "ADMIN");

  const [historico, setHistorico] = useState<RelatorioSemanalItem[]>(
    historicoInicial as unknown as RelatorioSemanalItem[]
  );
  const [relatorioSelecionadoId, setRelatorioSelecionadoId] = useState<string>(
    (historicoInicial as any[])[0]?.id || "sem-2026-11-24"
  );
  const [modalEdicaoAberto, setModalEdicaoAberto] = useState(false);
  const [modalHistoricoAberto, setModalHistoricoAberto] = useState(false);
  const [modalPreviewEmail, setModalPreviewEmail] = useState<{
    aberto: boolean;
    assunto: string;
    destinatario: string;
    html: string;
    modo?: string;
    sucesso?: boolean;
    mensagem?: string;
  } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [testandoEmail, setTestandoEmail] = useState(false);
  const [baixandoPng, setBaixandoPng] = useState(false);
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
    const anterior = idx >= 0 && idx + 1 < historico.length ? historico[idx + 1] : null;
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
    if (!podeEditarRelatorio || !relatorioAtivo) return;
    setFormRelatorio(JSON.parse(JSON.stringify(relatorioAtivo)));
    setModalEdicaoAberto(true);
  };

  const abrirModalNovoRelatorio = async () => {
    if (!podeEditarRelatorio) return;
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
    copia.criadoPor = usuarioLogado?.nome || "Administrador";

    setFormRelatorio(copia);
    setModalEdicaoAberto(true);

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
    if (!podeEditarRelatorio) return;
    try {
      setSalvando(true);
      const res = await fetch("/api/relatorios/acompanhamento-semanal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formRelatorio,
          id: `sem-${formRelatorio.dataReferencia}`,
          criadoPor: usuarioLogado?.nome || formRelatorio.criadoPor || "Administrador",
        }),
      });
      const json = await res.json();
      if (json?.success && Array.isArray(json.historico)) {
        setHistorico(json.historico);
        setRelatorioSelecionadoId(json.relatorio.id);
        setModalEdicaoAberto(false);
        const infoEmail =
          typeof json.emailsDisparados === "number" && json.emailsDisparados > 0
            ? ` E-mail com resumo executivo enviado para ${json.emailsDisparados} destinatário(s) da Diretoria!`
            : " Resumo executivo disparado por e-mail!";
        mostrarToast(
          `Relatório Semanal de ${formatarDataBR(json.relatorio.dataReferencia)} salvo!${infoEmail}`
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

  const handleTestarEmailIndividual = async () => {
    if (!relatorioAtivo || testandoEmail) return;
    try {
      setTestandoEmail(true);
      const emailAlvo = usuarioLogado?.email || "leonardo.campos@nnos.com.br";
      const nomeAlvo = usuarioLogado?.nome || "Leonardo Campos";
      const loginAlvo = usuarioLogado?.login || "leonardo.campos";

      const res = await fetch("/api/relatorios/acompanhamento-semanal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acao: "testar_email_individual",
          relatorioId: relatorioAtivo.id,
          emailDestinatario: emailAlvo,
          nomeDestinatario: nomeAlvo,
          loginDestinatario: loginAlvo,
        }),
      });
      const json = await res.json();
      if (json?.success) {
        setModalPreviewEmail({
          aberto: true,
          assunto: json.assunto,
          destinatario: json.destinatario,
          html: json.htmlPreview,
          modo: json.resultado?.modo,
          sucesso: json.resultado?.sucesso,
          mensagem: json.resultado?.mensagem,
        });
        mostrarToast(`Teste de E-mail Executivo gerado para ${emailAlvo}!`);
      } else {
        alert(json?.error || "Erro ao disparar e-mail de teste.");
      }
    } catch (err: any) {
      alert("Erro ao testar e-mail: " + err.message);
    } finally {
      setTestandoEmail(false);
    }
  };

  // Geração e Download do Relatório em formato .PNG de Alta Definição (2400 x 1360 px) fiel ao modelo oficial
  const handleBaixarPngAltaDefinicao = async () => {
    if (!relatorioAtivo || baixandoPng) return;
    try {
      setBaixandoPng(true);
      const W = 2400;
      const H = 1360;
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const fontSans = "'Plus Jakarta Sans', 'Segoe UI', Roboto, Arial, sans-serif";

      const carregarImg = (src: string): Promise<HTMLImageElement | null> =>
        new Promise((resolve) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => resolve(img);
          img.onerror = () => resolve(null);
          img.src = src;
        });

      // Garante que a fonte de ícones Material Symbols (mesma do sistema) esteja carregada antes de desenhar
      try {
        await (document as any).fonts?.load?.(`48px 'Material Symbols Outlined'`, "calendar_month");
      } catch {}

      // Desenha um ícone Material Symbols (idêntico ao exibido no sistema) centralizado em (cx, cy)
      const drawIcone = (nome: string, cx: number, cy: number, size: number, cor = "#ffffff") => {
        ctx.save();
        ctx.fillStyle = cor;
        ctx.font = `normal 400 ${size}px 'Material Symbols Outlined'`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(nome, cx, cy);
        ctx.restore();
      };

      // Desenha logomarca preservando a proporção original (equivalente ao objectFit: contain do sistema)
      const drawImgContain = (img: HTMLImageElement, cx: number, cy: number, maxW: number, maxH: number) => {
        const ratio = img.width / img.height;
        let w = maxW;
        let h = w / ratio;
        if (h > maxH) {
          h = maxH;
          w = h * ratio;
        }
        ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
      };

      const [logoBranca, logoSicoob, logoClara, logoItau] = await Promise.all([
        carregarImg("/logo-horizontal-branca.png"),
        carregarImg("/logo-sicoob.png"),
        carregarImg("/logo-clara.png"),
        carregarImg("/logo-itau.png"),
      ]);

      const roundRectPath = (x: number, y: number, w: number, h: number, r: number) => {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
      };

      const fillCard = (x: number, y: number, w: number, h: number, r = 24, fill = "#ffffff", border = "#e2e8f0") => {
        ctx.save();
        ctx.shadowColor = "rgba(15, 42, 74, 0.05)";
        ctx.shadowBlur = 16;
        ctx.shadowOffsetY = 4;
        roundRectPath(x, y, w, h, r);
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.restore();
        if (border) {
          roundRectPath(x, y, w, h, r);
          ctx.lineWidth = 2;
          ctx.strokeStyle = border;
          ctx.stroke();
        }
      };

      const drawIndicadorSeta = (
        cx: number,
        cy: number,
        r: number,
        atual: number,
        anterior?: number | null,
        inverter = false,
        override?: IndicadorInicialOverride
      ) => {
        let pct = 0;
        let ehPositivo = true;
        if (anterior !== undefined && anterior !== null && anterior !== 0) {
          const calc = calcularVariacao(atual, anterior);
          pct = calc.pct;
          ehPositivo = inverter ? !calc.subiu : calc.subiu;
        } else if (override) {
          pct = override.pct;
          ehPositivo = override.ehPositivo;
        }
        const corBorda = ehPositivo ? "#a7dec7" : "#f5b5b8";
        const corSeta = ehPositivo ? "#9fd8be" : "#f2a6aa";

        ctx.save();
        if (ehPositivo) {
          ctx.beginPath();
          ctx.moveTo(cx, cy - r - 15);
          ctx.lineTo(cx - 12, cy - r + 2);
          ctx.lineTo(cx + 12, cy - r + 2);
          ctx.closePath();
          ctx.fillStyle = corSeta;
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.moveTo(cx, cy + r + 15);
          ctx.lineTo(cx - 12, cy + r - 2);
          ctx.lineTo(cx + 12, cy + r - 2);
          ctx.closePath();
          ctx.fillStyle = corSeta;
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.lineWidth = 4.5;
        ctx.strokeStyle = corBorda;
        ctx.stroke();

        ctx.fillStyle = "#334155";
        ctx.font = `700 ${Math.round(r * 0.56)}px ${fontSans}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`${pct}%`, cx, cy + 1);
        ctx.restore();
      };

      // 1. Fundo Geral
      ctx.fillStyle = "#f3f6f9";
      ctx.fillRect(0, 0, W, H);

      // 2. Cabeçalho Degradê Azul Oficial
      const gradHeader = ctx.createLinearGradient(0, 0, W, 0);
      gradHeader.addColorStop(0, "#0099c8");
      gradHeader.addColorStop(0.45, "#0973ae");
      gradHeader.addColorStop(1, "#004c8c");
      ctx.fillStyle = gradHeader;
      ctx.fillRect(0, 0, W, 118);

      // Ícone Calendário Turquesa no Header
      roundRectPath(36, 20, 78, 78, 20);
      ctx.fillStyle = "#2bb3c0";
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.stroke();
      // Ícone calendar_month (mesmo do sistema) dentro do bloco turquesa
      drawIcone("calendar_month", 75, 59, 50, "#ffffff");

      // Divisor vertical do Header
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.fillRect(136, 24, 3, 70);

      // Data + Título ACOMPANHAMENTO SEMANAL | MÊS
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillStyle = "#04233b";
      ctx.font = `700 28px ${fontSans}`;
      ctx.fillText(formatarDataBR(relatorioAtivo.dataReferencia), 160, 18);

      ctx.fillStyle = "#ffffff";
      ctx.font = `800 46px ${fontSans}`;
      const tituloStr = "ACOMPANHAMENTO SEMANAL";
      ctx.fillText(tituloStr, 160, 50);
      const wTitulo = ctx.measureText(tituloStr).width;

      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.font = `300 42px ${fontSans}`;
      ctx.fillText("|", 160 + wTitulo + 18, 50);

      ctx.fillStyle = "#05233b";
      ctx.font = `500 40px ${fontSans}`;
      ctx.fillText(relatorioAtivo.mesReferencia.toUpperCase(), 160 + wTitulo + 46, 54);

      // Logomarca NNÓS Branca à Direita
      if (logoBranca) {
        const lh = 80;
        const lw = (logoBranca.width / logoBranca.height) * lh;
        ctx.drawImage(logoBranca, W - lw - 44, 19, lw, lh);
      }

      // =======================================================================
      // 3. LINHA 1: POSIÇÃO FINANCEIRA + CONTAS A PAGAR & RECEBER
      // =======================================================================
      const row1Y = 140;
      const row1H = 315;
      const cardPosX = 36;
      const cardPosW = 750;
      fillCard(cardPosX, row1Y, cardPosW, row1H, 24);

      // Ícone Posição Financeira
      ctx.beginPath();
      ctx.arc(cardPosX + 46, row1Y + 46, 25, 0, Math.PI * 2);
      ctx.fillStyle = "#539bb2";
      ctx.fill();
      drawIcone("account_balance", cardPosX + 46, row1Y + 46, 29, "#ffffff");

      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillStyle = "#1e293b";
      ctx.font = `500 24px ${fontSans}`;
      ctx.fillText("POSIÇÃO FINANCEIRA", cardPosX + 84, row1Y + 22);

      ctx.fillStyle = "#09314b";
      ctx.font = `800 44px ${fontSans}`;
      ctx.fillText(fmtNum(relatorioAtivo.posicaoFinanceira.total), cardPosX + 84, row1Y + 52);

      drawIndicadorSeta(
        cardPosX + cardPosW - 56,
        row1Y + 56,
        32,
        relatorioAtivo.posicaoFinanceira.total,
        relatorioAnterior?.posicaoFinanceira?.total,
        false,
        relatorioAtivo.indicadoresIniciais?.posicaoFinanceira
      );

      // Cabeçalho CAIXA / APLICAÇÃO
      ctx.fillStyle = "#0f172a";
      ctx.font = `800 18px ${fontSans}`;
      ctx.textAlign = "center";
      ctx.fillText("CAIXA", cardPosX + 290, row1Y + 118);
      ctx.fillText("APLICAÇÃO", cardPosX + 495, row1Y + 118);

      const instRows = [
        { logo: logoSicoob, nome: "SICOOB", dados: relatorioAtivo.posicaoFinanceira.sicoob, w: 134, h: 38 },
        { logo: logoClara, nome: "CLARA", dados: relatorioAtivo.posicaoFinanceira.clara, w: 125, h: 35 },
        { logo: logoItau, nome: "ITAÚ", dados: relatorioAtivo.posicaoFinanceira.itau, w: 44, h: 44 },
      ];

      instRows.forEach((ir, idx) => {
        const ry = row1Y + 148 + idx * 54;
        ctx.save();
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(cardPosX + 26, ry);
        ctx.lineTo(cardPosX + cardPosW - 26, ry);
        ctx.strokeStyle = "#cbd5e1";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();

        const cy = ry + 27;
        if (ir.logo) {
          drawImgContain(ir.logo, cardPosX + 88, cy, ir.w, ir.h);
        } else {
          ctx.fillStyle = "#0f172a";
          ctx.font = `800 18px ${fontSans}`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(ir.nome, cardPosX + 88, cy);
        }

        ctx.font = `700 22px ${fontSans}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = ir.dados.caixa < 0 ? "#d98a8c" : "#67b887";
        ctx.fillText(fmtNum(ir.dados.caixa), cardPosX + 290, cy);

        ctx.fillStyle = "#67b887";
        ctx.fillText(fmtNum(ir.dados.aplicacao), cardPosX + 495, cy);

        ctx.font = `600 13px ${fontSans}`;
        ctx.fillStyle = "#64748b";
        ctx.fillText("Rentabilidade", cardPosX + 665, cy - 8);
        ctx.font = `700 15px ${fontSans}`;
        ctx.fillStyle = "#67b887";
        ctx.fillText(ir.dados.rentabilidade, cardPosX + 665, cy + 10);
      });

      // Cards Contas a Pagar & Contas a Receber
      const rightX = cardPosX + cardPosW + 26;
      const rightW = W - rightX - 36;
      const subCardH = (row1H - 20) / 2;

      const drawContasCard = (
        y: number,
        titulo: string,
        dados: RelatorioSemanalItem["contasAPagar"],
        anteriorTotal?: number | null,
        inverter = false,
        override?: IndicadorInicialOverride
      ) => {
        fillCard(rightX, y, rightW, subCardH, 24);
        ctx.beginPath();
        ctx.arc(rightX + 38, y + 32, 19, 0, Math.PI * 2);
        ctx.fillStyle = "#53869b";
        ctx.fill();

        drawIcone("bar_chart", rightX + 38, y + 32, 25, "#ffffff");

        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#1e293b";
        ctx.font = `500 23px ${fontSans}`;
        ctx.fillText(titulo, rightX + 68, y + 33);
        const wTituloContas = ctx.measureText(titulo).width;

        // Indicador ao lado do título (libera espaço horizontal para os 5 cards)
        drawIndicadorSeta(
          rightX + 68 + wTituloContas + 34,
          y + 36,
          19,
          dados.totalPeriodo,
          anteriorTotal,
          inverter,
          override
        );

        const cols = [
          { label: "VENCIDOS", val: fmtCompactoOuDecimal(dados.vencidos), color: "#ea9999" },
          { label: "VENCEM HOJE", val: fmtCompactoOuDecimal(dados.vencemHoje), color: "#ea9999" },
          { label: "A VENCER", val: fmtCompactoOuDecimal(dados.aVencer), color: "#546e7a" },
          { label: "PAGOS", val: fmtCompactoOuDecimal(dados.pagos), color: "#67b887" },
          { label: "TOTAL DO PERÍODO", val: fmtNum(dados.totalPeriodo), color: "#546e7a" },
        ];
        const startColX = rightX + 24;
        const gapCol = 16;
        const colW = (rightW - 48 - gapCol * 4) / 5;

        cols.forEach((c, idx) => {
          const cx = startColX + idx * (colW + gapCol);
          const cy = y + 58;
          roundRectPath(cx, cy, colW, 74, 14);
          ctx.fillStyle = "#f8fafc";
          ctx.fill();

          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.fillStyle = "#0f172a";
          ctx.font = `800 17px ${fontSans}`;
          ctx.fillText(c.label, cx + colW / 2, cy + 9);

          ctx.fillStyle = c.color;
          ctx.font = `800 33px ${fontSans}`;
          ctx.fillText(c.val, cx + colW / 2, cy + 34);
        });
      };

      drawContasCard(
        row1Y,
        "CONTAS A PAGAR",
        relatorioAtivo.contasAPagar,
        relatorioAnterior?.contasAPagar?.totalPeriodo,
        true,
        relatorioAtivo.indicadoresIniciais?.contasAPagar
      );

      drawContasCard(
        row1Y + subCardH + 20,
        "CONTAS A RECEBER",
        relatorioAtivo.contasAReceber,
        relatorioAnterior?.contasAReceber?.totalPeriodo,
        false,
        relatorioAtivo.indicadoresIniciais?.contasAReceber
      );

      // =======================================================================
      // 4. LINHA 2: OS 3 QUADROS ALINHADOS NA MESMA LINHA INFERIOR
      // =======================================================================
      const row2Y = 475;
      const cardsBottomY = 1245;
      const row2H = cardsBottomY - row2Y; // 770px exatos para os 3 quadros

      const col1X = 36;
      const col1W = 1140;
      const col2X = col1X + col1W + 24;
      const col2W = 475;
      const col3X = col2X + col2W + 24;
      const col3W = W - col3X - 36; // 665px

      // --- QUADRO 1: A RECEBER EM ATRASO ---
      fillCard(col1X, row2Y, col1W, row2H, 24);
      ctx.beginPath();
      ctx.arc(col1X + 38, row2Y + 36, 20, 0, Math.PI * 2);
      ctx.fillStyle = "#80c4c8";
      ctx.fill();
      drawIcone("date_range", col1X + 38, row2Y + 36, 26, "#ffffff");
      ctx.textBaseline = "middle";

      ctx.textAlign = "left";
      ctx.fillStyle = "#1e293b";
      ctx.font = `500 24px ${fontSans}`;
      ctx.fillText("A RECEBER EM ATRASO", col1X + 68, row2Y + 37);

      drawIndicadorSeta(
        col1X + 376,
        row2Y + 36,
        22,
        relatorioAtivo.totalAtraso,
        relatorioAnterior?.totalAtraso,
        true,
        relatorioAtivo.indicadoresIniciais?.aReceberEmAtraso
      );

      // Tabela A Receber em Atraso
      const t1X = col1X + 20;
      const t1Y = row2Y + 72;
      const t1W = col1W - 40;
      const t1HeaderH = 34;
      const t1FootH = 36;
      const rowsAtraso = relatorioAtivo.aReceberEmAtraso;
      const t1BodyH = row2H - 72 - 20 - t1HeaderH - t1FootH;
      const t1RowH = rowsAtraso.length > 0 ? t1BodyH / rowsAtraso.length : 30;

      // Colunas Atraso
      const cAtraso = [
        { label: "REALIZADO", w: 112, align: "center" as const },
        { label: "FATURADO", w: 112, align: "center" as const },
        { label: "PROJETO", w: 396, align: "center" as const },
        { label: "PERFIL", w: 104, align: "center" as const },
        { label: "Nº NOTA", w: 92, align: "center" as const },
        { label: "VALOR", w: 118, align: "right" as const },
        { label: "DIAS", w: 66, align: "center" as const },
        { label: "VENCIMENTO", w: 100, align: "center" as const },
      ];

      ctx.fillStyle = "#0a3254";
      ctx.fillRect(t1X, t1Y, t1W, t1HeaderH);

      let curX = t1X;
      ctx.fillStyle = "#ffffff";
      ctx.font = `700 13px ${fontSans}`;
      ctx.textBaseline = "middle";
      cAtraso.forEach((col) => {
        ctx.textAlign = col.align === "right" ? "right" : "center";
        const tx = col.align === "right" ? curX + col.w - 10 : curX + col.w / 2;
        ctx.fillText(col.label, tx, t1Y + t1HeaderH / 2);
        curX += col.w;
      });

      rowsAtraso.forEach((item, idx) => {
        const ry = t1Y + t1HeaderH + idx * t1RowH;
        ctx.fillStyle = idx % 2 === 0 ? "#ffffff" : "#f1f5f9";
        ctx.fillRect(t1X, ry, t1W, t1RowH);

        ctx.strokeStyle = "#e2e8f0";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(t1X, ry + t1RowH);
        ctx.lineTo(t1X + t1W, ry + t1RowH);
        ctx.stroke();

        const vals = [
          { v: item.realizado, bold: false, color: "#475569" },
          { v: item.faturado, bold: false, color: "#475569" },
          { v: item.projeto, bold: true, color: "#334155" },
          { v: item.perfil, bold: false, color: "#475569" },
          { v: item.numeroNota, bold: false, color: "#475569" },
          { v: fmtNum(item.valor), bold: true, color: "#334155" },
          { v: String(item.dias), bold: true, color: "#c00000" },
          { v: formatarDataBR(item.vencimento), bold: false, color: "#475569" },
        ];

        let cx = t1X;
        vals.forEach((cell, cIdx) => {
          const col = cAtraso[cIdx];
          ctx.font = `${cell.bold ? 700 : 500} 13px ${fontSans}`;
          ctx.fillStyle = cell.color;
          ctx.textAlign = col.align === "right" ? "right" : "center";
          const tx = col.align === "right" ? cx + col.w - 10 : cx + col.w / 2;
          ctx.fillText(cell.v, tx, ry + t1RowH / 2);
          cx += col.w;
        });
      });

      // Rodapé TOTAL A Receber em Atraso
      const foot1Y = t1Y + t1HeaderH + t1BodyH;
      ctx.fillStyle = "#0a3254";
      ctx.fillRect(t1X, foot1Y, t1W, t1FootH);
      ctx.fillStyle = "#ffffff";
      ctx.font = `800 15px ${fontSans}`;
      ctx.textAlign = "right";
      ctx.fillText("TOTAL", t1X + 800, foot1Y + t1FootH / 2);
      ctx.fillText(fmtNum(relatorioAtivo.totalAtraso), t1X + 934 - 10, foot1Y + t1FootH / 2);
      ctx.textAlign = "center";
      ctx.fillText("-", t1X + 934 + 83, foot1Y + t1FootH / 2);

      // --- QUADRO 2: CASH BACK & CLARA DESCONTO NA FATURA ---
      fillCard(col2X, row2Y, col2W, row2H, 24);

      const drawGraficoBloco = (
        by: number,
        titulo: string,
        subtitulo: string | null,
        totalVal: number,
        anosObj: Record<"2023" | "2024" | "2025" | "2026", number>,
        maxVal: number,
        corBarra: string,
        usarLogoClara: boolean
      ) => {
        const bx = col2X + 24;
        const bw = col2W - 48;

        if (usarLogoClara && logoClara) {
          drawImgContain(logoClara, bx + 62, by + 21, 125, 35);
          if (subtitulo) {
            ctx.textAlign = "right";
            ctx.textBaseline = "middle";
            ctx.fillStyle = "#1e293b";
            ctx.font = `500 16px ${fontSans}`;
            ctx.fillText(subtitulo, bx + bw, by + 22);
          }
        } else {
          // Círculo com degradê verde-azul e ícone flight_takeoff (igual ao sistema)
          const gradCb = ctx.createLinearGradient(bx, by, bx + 44, by + 44);
          gradCb.addColorStop(0, "#c2f0c2");
          gradCb.addColorStop(1, "#68b8e8");
          ctx.beginPath();
          ctx.arc(bx + 22, by + 22, 22, 0, Math.PI * 2);
          ctx.fillStyle = gradCb;
          ctx.fill();
          drawIcone("flight_takeoff", bx + 22, by + 22, 29, "#1d4ed8");
          ctx.textBaseline = "middle";

          ctx.textAlign = "left";
          ctx.fillStyle = "#1e293b";
          ctx.font = `500 23px ${fontSans}`;
          ctx.fillText(titulo, bx + 56, by + 23);
        }

        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillStyle = "#09314b";
        ctx.font = `800 36px ${fontSans}`;
        ctx.fillText(fmtNum(totalVal), bx, by + 50);

        // Área do Gráfico
        const chartY = by + 104;
        const chartH = 176;
        const axisW = 72;
        const plotX = bx + axisW;
        const plotW = bw - axisW;

        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.font = `500 12px ${fontSans}`;
        ctx.fillStyle = "#64748b";
        const steps = 4;
        for (let s = 0; s <= steps; s++) {
          const sy = chartY + (chartH / steps) * s;
          const vStep = maxVal * (1 - s / steps);
          ctx.fillText(fmtNum(vStep, 2), plotX - 8, sy);
          ctx.strokeStyle = s === steps ? "#cbd5e1" : "#f1f5f9";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(plotX, sy);
          ctx.lineTo(plotX + plotW, sy);
          ctx.stroke();
        }

        const colPlotW = plotW / 4;
        anosGrafico.forEach((ano, aIdx) => {
          const val = Number(anosObj[ano]) || 0;
          const barH = Math.max(4, Math.min(chartH, (val / maxVal) * chartH));
          const barW = 34;
          const barX = plotX + aIdx * colPlotW + (colPlotW - barW) / 2;
          const barY = chartY + chartH - barH;
          ctx.fillStyle = corBarra;
          ctx.fillRect(barX, barY, barW, barH);
        });

        // Tabela da base do gráfico
        const tbY = chartY + chartH + 8;
        const tbRowH = 26;
        ctx.strokeStyle = "#e2e8f0";
        ctx.lineWidth = 1.2;

        // Header Anos
        ctx.strokeRect(bx, tbY, axisW, tbRowH);
        anosGrafico.forEach((ano, aIdx) => {
          const cx = plotX + aIdx * colPlotW;
          ctx.strokeRect(cx, tbY, colPlotW, tbRowH);
          ctx.fillStyle = "#475569";
          ctx.font = `700 12px ${fontSans}`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(ano, cx + colPlotW / 2, tbY + tbRowH / 2);
        });

        // Linha Total
        const tbY2 = tbY + tbRowH;
        ctx.strokeRect(bx, tbY2, axisW, tbRowH);
        ctx.fillStyle = corBarra;
        ctx.fillRect(bx + 8, tbY2 + 9, 8, 8);
        ctx.fillStyle = "#475569";
        ctx.font = `700 12px ${fontSans}`;
        ctx.textAlign = "left";
        ctx.fillText("Total", bx + 20, tbY2 + tbRowH / 2);

        anosGrafico.forEach((ano, aIdx) => {
          const cx = plotX + aIdx * colPlotW;
          ctx.strokeRect(cx, tbY2, colPlotW, tbRowH);
          ctx.fillStyle = "#475569";
          ctx.font = `600 12px ${fontSans}`;
          ctx.textAlign = "center";
          ctx.fillText(fmtNum(anosObj[ano]), cx + colPlotW / 2, tbY2 + tbRowH / 2);
        });
      };

      drawGraficoBloco(
        row2Y + 22,
        "CASH BACK",
        null,
        relatorioAtivo.cashBack.totalAcumulado,
        relatorioAtivo.cashBack.anos,
        maxCashBack,
        "#1b84d4",
        false
      );

      // Linha divisória tracejada entre Cash Back e Clara
      ctx.save();
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(col2X + 24, row2Y + 388);
      ctx.lineTo(col2X + col2W - 24, row2Y + 388);
      ctx.stroke();
      ctx.restore();

      drawGraficoBloco(
        row2Y + 408,
        "CLARA",
        "DESCONTO NA FATURA",
        relatorioAtivo.claraDesconto.totalAcumulado,
        relatorioAtivo.claraDesconto.anos,
        maxClara,
        "#0c3c52",
        true
      );

      // --- QUADRO 3: PROJETOS | VALORES ---
      fillCard(col3X, row2Y, col3W, row2H, 24);
      ctx.beginPath();
      ctx.arc(col3X + 38, row2Y + 36, 20, 0, Math.PI * 2);
      ctx.fillStyle = "#80c4c8";
      ctx.fill();
      drawIcone("analytics", col3X + 38, row2Y + 36, 27, "#ffffff");
      ctx.textBaseline = "middle";

      ctx.textAlign = "left";
      ctx.fillStyle = "#1e293b";
      ctx.font = `500 25px ${fontSans}`;
      ctx.fillText("PROJETOS", col3X + 68, row2Y + 37);

      drawIndicadorSeta(
        col3X + col3W / 2 + 10,
        row2Y + 36,
        24,
        relatorioAtivo.totalProjetos,
        relatorioAnterior?.totalProjetos,
        false,
        relatorioAtivo.indicadoresIniciais?.projetosMes
      );

      ctx.textAlign = "right";
      ctx.fillStyle = "#1e293b";
      ctx.font = `500 25px ${fontSans}`;
      ctx.fillText("VALORES", col3X + col3W - 24, row2Y + 37);

      // Lista de Projetos alinhada com a barra TOTAL da esquerda
      const pX = col3X + 20;
      const pY = row2Y + 72;
      const pW = col3W - 40;
      const pFootH = 36;
      const projs = relatorioAtivo.projetosMes;
      const pBodyH = row2H - 72 - 20 - pFootH;
      const pRowH = projs.length > 0 ? pBodyH / projs.length : 28;

      projs.forEach((p, idx) => {
        const ry = pY + idx * pRowH;
        ctx.fillStyle = idx % 2 === 0 ? "#f0f7fa" : "#ffffff";
        ctx.fillRect(pX, ry, pW, pRowH);

        ctx.font = `500 14px ${fontSans}`;
        ctx.fillStyle = "#64748b";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(p.projeto.toUpperCase(), pX + 12, ry + pRowH / 2);

        ctx.font = `600 14px ${fontSans}`;
        ctx.fillStyle = "#475569";
        ctx.textAlign = "right";
        ctx.fillText(fmtNum(p.valor), pX + pW - 12, ry + pRowH / 2);
      });

      const foot3Y = pY + pBodyH;
      ctx.fillStyle = "#0a3254";
      ctx.fillRect(pX, foot3Y, pW, pFootH);
      ctx.fillStyle = "#ffffff";
      ctx.font = `800 16px ${fontSans}`;
      ctx.textAlign = "left";
      ctx.fillText("TOTAL", pX + 12, foot3Y + pFootH / 2);
      ctx.textAlign = "right";
      ctx.fillText(fmtNum(relatorioAtivo.totalProjetos), pX + pW - 12, foot3Y + pFootH / 2);

      // =======================================================================
      // 5. RODAPÉ INFERIOR ESQUERDO: TOTAL A RECEBER & A VENCER EM ABERTO
      // =======================================================================
      const botY = 1264;
      const drawBottomKpi = (bx: number, label: string, valor: number, icone: string) => {
        ctx.beginPath();
        ctx.arc(bx + 24, botY + 34, 22, 0, Math.PI * 2);
        ctx.fillStyle = "#80c4c8";
        ctx.fill();
        drawIcone(icone, bx + 24, botY + 34, 27, "#ffffff");

        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillStyle = "#1e293b";
        ctx.font = `500 22px ${fontSans}`;
        ctx.fillText(label, bx + 58, botY + 6);

        ctx.fillStyle = "#0f172a";
        ctx.font = `800 36px ${fontSans}`;
        ctx.fillText(fmtNum(valor), bx + 58, botY + 34);
      };

      drawBottomKpi(44, "TOTAL A RECEBER", relatorioAtivo.totalAReceber, "date_range");
      drawBottomKpi(615, "A VENCER EM ABERTO", relatorioAtivo.aVencerEmAberto, "schedule");

      // Dispara o download do arquivo .PNG
      const dataFmt = formatarDataBR(relatorioAtivo.dataReferencia).replace(/\//g, "-");
      const dataUrl = canvas.toDataURL("image/png", 1.0);
      const link = document.createElement("a");
      link.download = `Acompanhamento_Semanal_${dataFmt}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      mostrarToast(`Imagem PNG de Alta Definição (Acompanhamento_Semanal_${dataFmt}.png) baixada com sucesso!`);
    } catch (e: any) {
      console.error("Erro ao gerar PNG HD:", e);
      alert("Não foi possível gerar o arquivo PNG: " + (e?.message || "erro inesperado"));
    } finally {
      setBaixandoPng(false);
    }
  };

  const handleExcluirRelatorio = async (id: string, dataRef: string) => {
    if (!podeEditarRelatorio) return;
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

  // Bloqueio estrito para perfis que não sejam Diretoria Executiva ou Admin
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

      {/* Barra de Ferramentas Executiva: Seletor de Histórico, Comparativo e Ações do Admin */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "nowrap",
          whiteSpace: "nowrap",
          overflow: "visible",
          position: "relative",
          zIndex: 50,
          gap: "10px",
          padding: "10px 14px",
          borderRadius: "14px",
          background: "var(--surface-container-lowest, #ffffff)",
          border: "1px solid var(--border, #e2e8f0)",
          boxShadow: "0 2px 8px rgba(15, 42, 74, 0.04)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "nowrap", flexShrink: 0 }}>
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
              Relatório:
            </span>
          </div>

          <ModernDropdown
            value={relatorioSelecionadoId}
            onChange={(val) => setRelatorioSelecionadoId(String(val))}
            options={opcoesHistoricoDropdown}
            icon="event_note"
            minWidth="270px"
          />

          {relatorioAnterior && (
            <span
              title="As setas dos indicadores comparam com este relatório anterior"
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
              Comparando com: <strong>{formatarDataBR(relatorioAnterior.dataReferencia)}</strong>
            </span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "nowrap", flexShrink: 0 }}>
          <button
            type="button"
            onClick={handleBaixarPngAltaDefinicao}
            disabled={baixandoPng}
            className="btn-secondary"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              borderRadius: "10px",
              fontSize: "12px",
              fontWeight: 700,
              cursor: baixandoPng ? "wait" : "pointer",
              border: "1px solid #0284c7",
              color: "#0284c7",
              backgroundColor: "rgba(2, 132, 199, 0.08)",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "17px" }}>
              download
            </span>
            <span>{baixandoPng ? "Gerando PNG..." : "Baixar PNG"}</span>
          </button>

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
              folder_open
            </span>
            <span>Histórico de Envios ({historico.length})</span>
          </button>

          {podeEditarRelatorio && (
            <>
              <button
                type="button"
                onClick={handleTestarEmailIndividual}
                disabled={testandoEmail}
                className="btn-secondary"
                title="Envia um e-mail de teste apenas para o seu usuário e exibe a prévia do Resumo Executivo"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 12px",
                  borderRadius: "10px",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: testandoEmail ? "wait" : "pointer",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "17px", color: "#0284c7" }}>
                  forward_to_inbox
                </span>
                <span>{testandoEmail ? "Enviando..." : "Testar E-mail"}</span>
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
            </>
          )}
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
              style={{
                height: "54px",
                width: "auto",
                objectFit: "contain",
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
                  overrideSemAnterior={relatorioAtivo.indicadoresIniciais?.posicaoFinanceira}
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
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <img
                      src="/logo-sicoob.png"
                      alt="Sicoob"
                      style={{ width: "92px", height: "26px", objectFit: "contain", display: "block" }}
                    />
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
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <img
                      src="/logo-clara.png"
                      alt="Clara"
                      style={{ width: "86px", height: "24px", objectFit: "contain", display: "block" }}
                    />
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
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <img
                      src="/logo-itau.png"
                      alt="Itaú"
                      style={{ width: "30px", height: "30px", objectFit: "contain", display: "block" }}
                    />
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
                  {/* Indicador reposicionado ao lado do título para liberar espaço aos cards */}
                  <div style={{ marginLeft: "6px" }}>
                    <IndicadorVariacaoSeta
                      atual={relatorioAtivo.contasAPagar.totalPeriodo}
                      anterior={relatorioAnterior?.contasAPagar?.totalPeriodo}
                      inverterSemantica={true}
                      overrideSemAnterior={relatorioAtivo.indicadoresIniciais?.contasAPagar}
                      tamanho="sm"
                    />
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(5, 1fr)",
                    gap: "10px",
                    alignItems: "center",
                  }}
                >

                  {/* Vencidos */}
                  <div
                    style={{
                      backgroundColor: "#f8fafc",
                      borderRadius: "12px",
                      padding: "8px 10px",
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: 800,
                        color: "#0f172a",
                        textTransform: "uppercase",
                        whiteSpace: "nowrap",
                      }}
                    >
                      VENCIDOS
                    </div>
                    <div style={{ fontSize: "24px", whiteSpace: "nowrap", fontWeight: 800, color: "#ea9999", marginTop: "2px" }}>
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
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: 800,
                        color: "#0f172a",
                        textTransform: "uppercase",
                        whiteSpace: "nowrap",
                      }}
                    >
                      VENCEM HOJE
                    </div>
                    <div style={{ fontSize: "24px", whiteSpace: "nowrap", fontWeight: 800, color: "#ea9999", marginTop: "2px" }}>
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
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: 800,
                        color: "#0f172a",
                        textTransform: "uppercase",
                        whiteSpace: "nowrap",
                      }}
                    >
                      A VENCER
                    </div>
                    <div style={{ fontSize: "24px", whiteSpace: "nowrap", fontWeight: 800, color: "#546e7a", marginTop: "2px" }}>
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
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: 800,
                        color: "#0f172a",
                        textTransform: "uppercase",
                        whiteSpace: "nowrap",
                      }}
                    >
                      PAGOS
                    </div>
                    <div style={{ fontSize: "24px", whiteSpace: "nowrap", fontWeight: 800, color: "#67b887", marginTop: "2px" }}>
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
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: 800,
                        color: "#0f172a",
                        textTransform: "uppercase",
                        whiteSpace: "nowrap",
                      }}
                    >
                      TOTAL DO PERÍODO
                    </div>
                    <div style={{ fontSize: "24px", whiteSpace: "nowrap", fontWeight: 800, color: "#546e7a", marginTop: "2px" }}>
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
                  {/* Indicador reposicionado ao lado do título para liberar espaço aos cards */}
                  <div style={{ marginLeft: "6px" }}>
                    <IndicadorVariacaoSeta
                      atual={relatorioAtivo.contasAReceber.totalPeriodo}
                      anterior={relatorioAnterior?.contasAReceber?.totalPeriodo}
                      overrideSemAnterior={relatorioAtivo.indicadoresIniciais?.contasAReceber}
                      tamanho="sm"
                    />
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(5, 1fr)",
                    gap: "10px",
                    alignItems: "center",
                  }}
                >

                  {/* Vencidos */}
                  <div
                    style={{
                      backgroundColor: "#f8fafc",
                      borderRadius: "12px",
                      padding: "8px 10px",
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: 800,
                        color: "#0f172a",
                        textTransform: "uppercase",
                        whiteSpace: "nowrap",
                      }}
                    >
                      VENCIDOS
                    </div>
                    <div style={{ fontSize: "24px", whiteSpace: "nowrap", fontWeight: 800, color: "#ea9999", marginTop: "2px" }}>
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
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: 800,
                        color: "#0f172a",
                        textTransform: "uppercase",
                        whiteSpace: "nowrap",
                      }}
                    >
                      VENCEM HOJE
                    </div>
                    <div style={{ fontSize: "24px", whiteSpace: "nowrap", fontWeight: 800, color: "#ea9999", marginTop: "2px" }}>
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
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: 800,
                        color: "#0f172a",
                        textTransform: "uppercase",
                        whiteSpace: "nowrap",
                      }}
                    >
                      A VENCER
                    </div>
                    <div style={{ fontSize: "24px", whiteSpace: "nowrap", fontWeight: 800, color: "#546e7a", marginTop: "2px" }}>
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
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: 800,
                        color: "#0f172a",
                        textTransform: "uppercase",
                        whiteSpace: "nowrap",
                      }}
                    >
                      PAGOS
                    </div>
                    <div style={{ fontSize: "24px", whiteSpace: "nowrap", fontWeight: 800, color: "#67b887", marginTop: "2px" }}>
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
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: 800,
                        color: "#0f172a",
                        textTransform: "uppercase",
                        whiteSpace: "nowrap",
                      }}
                    >
                      TOTAL DO PERÍODO
                    </div>
                    <div style={{ fontSize: "24px", whiteSpace: "nowrap", fontWeight: 800, color: "#546e7a", marginTop: "2px" }}>
                      {fmtNum(relatorioAtivo.contasAReceber.totalPeriodo)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* =================================================================
              LINHA 2: OS 3 QUADROS BRANCOS ALINHADOS NA MESMA LINHA INFERIOR
              (A RECEBER EM ATRASO + CASH BACK / CLARA + PROJETOS | VALORES)
             ================================================================= */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(520px, 1.95fr) minmax(235px, 0.82fr) minmax(290px, 1.12fr)",
              gap: "18px",
              alignItems: "stretch",
            }}
          >
            {/* QUADRO 1: A RECEBER EM ATRASO (Alinhado na base com Cash Back e Projetos) */}
            <div
              style={{
                backgroundColor: "#ffffff",
                borderRadius: "16px",
                padding: "14px 16px",
                boxShadow: "0 2px 10px rgba(15, 42, 74, 0.04)",
                border: "1px solid #e2e8f0",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              {/* Cabeçalho com Título + Indicador Posicionado Conforme Seta do Print 1 */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  marginBottom: "8px",
                }}
              >
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
                <div style={{ marginLeft: "4px" }}>
                  <IndicadorVariacaoSeta
                    atual={relatorioAtivo.totalAtraso}
                    anterior={relatorioAnterior?.totalAtraso}
                    inverterSemantica={true}
                    overrideSemAnterior={relatorioAtivo.indicadoresIniciais?.aReceberEmAtraso}
                    tamanho="sm"
                  />
                </div>
              </div>

              {/* Tabela A Receber em Atraso Ocupando 100% da Altura Restante do Card */}
              <div
                style={{
                  width: "100%",
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  overflowX: "auto",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                }}
              >
                <table style={{ width: "100%", height: "100%", borderCollapse: "collapse", fontSize: "10px" }}>
                  <thead>
                    <tr
                      style={{
                        backgroundColor: "#0a3254",
                        color: "#ffffff",
                        textTransform: "uppercase",
                        fontWeight: 700,
                        fontSize: "9.5px",
                        letterSpacing: "0.02em",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <th style={{ padding: "6px 6px", textAlign: "center" }}>REALIZADO</th>
                      <th style={{ padding: "6px 6px", textAlign: "center" }}>FATURADO</th>
                      <th style={{ padding: "6px 8px", textAlign: "center" }}>PROJETO</th>
                      <th style={{ padding: "6px 6px", textAlign: "center" }}>PERFIL</th>
                      <th style={{ padding: "6px 6px", textAlign: "center", whiteSpace: "nowrap" }}>Nº NOTA</th>
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
                            fontSize: "9.2px",
                            whiteSpace: "nowrap",
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
                        fontSize: "10.5px",
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

            {/* QUADRO 2: CASH BACK & CLARA DESCONTO NA FATURA (Alinhado na base com A Receber e Projetos) */}
            <div
              style={{
                backgroundColor: "#ffffff",
                borderRadius: "16px",
                padding: "14px 16px",
                boxShadow: "0 2px 10px rgba(15, 42, 74, 0.04)",
                border: "1px solid #e2e8f0",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: "14px",
              }}
            >
              {/* BLOCO SUPERIOR: CASH BACK */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "50%",
                      background: "linear-gradient(135deg, #c2f0c2 0%, #68b8e8 100%)",
                      color: "#1d4ed8",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "21px" }}>
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
                <div style={{ marginTop: "2px" }}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "48px 1fr",
                      gap: "4px",
                      alignItems: "stretch",
                      height: "118px",
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

              {/* BLOCO INFERIOR: CLARA DESCONTO NA FATURA (Logo abaixo do Cash Back) */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  borderTop: "1px dashed #e2e8f0",
                  paddingTop: "14px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <img
                      src="/logo-clara.png"
                      alt="Clara"
                      style={{ width: "86px", height: "24px", objectFit: "contain", display: "block" }}
                    />
                  </div>
                  <span style={{ fontSize: "11.5px", fontWeight: 500, color: "#1e293b", textTransform: "uppercase" }}>
                    DESCONTO NA FATURA
                  </span>
                </div>

                <div style={{ fontSize: "24px", fontWeight: 800, color: "#09314b" }}>
                  {fmtNum(relatorioAtivo.claraDesconto.totalAcumulado)}
                </div>

                {/* Gráfico Dinâmico de Colunas Clara Desconto (2023-2026) */}
                <div style={{ marginTop: "2px" }}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "48px 1fr",
                      gap: "4px",
                      alignItems: "stretch",
                      height: "118px",
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
                padding: "14px 16px",
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
                  marginBottom: "8px",
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
                  overrideSemAnterior={relatorioAtivo.indicadoresIniciais?.projetosMes}
                  tamanho="md"
                />

                <span style={{ fontSize: "18px", fontWeight: 500, color: "#1e293b", textTransform: "uppercase" }}>
                  VALORES
                </span>
              </div>

              {/* Lista de Projetos do Mês Corrente Alinhada na Base com A Receber em Atraso */}
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  borderRadius: "6px",
                  overflow: "hidden",
                }}
              >
                <table style={{ width: "100%", height: "100%", borderCollapse: "collapse", fontSize: "9.8px" }}>
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
                            padding: "2.8px 8px",
                            color: "#64748b",
                            fontWeight: 500,
                            textTransform: "uppercase",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {p.projeto}
                        </td>
                        <td
                          style={{
                            padding: "2.8px 8px",
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
                        fontSize: "10.5px",
                      }}
                    >
                      <td style={{ padding: "6px 10px" }}>TOTAL</td>
                      <td style={{ padding: "6px 10px", textAlign: "right", whiteSpace: "nowrap" }}>
                        {fmtNum(relatorioAtivo.totalProjetos)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>

          {/* =================================================================
              LINHA 3 (ABAIXO DO QUADRO A RECEBER EM ATRASO):
              TOTAL A RECEBER & A VENCER EM ABERTO (Via Base de Dados)
             ================================================================= */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(520px, 1.95fr) minmax(235px, 0.82fr) minmax(290px, 1.12fr)",
              gap: "18px",
              alignItems: "center",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "16px",
                padding: "2px 8px",
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
            <div />
            <div />
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
              maxWidth: "1120px",
              backgroundColor: "var(--surface-container-lowest, #ffffff)",
              borderRadius: "18px",
              border: "1px solid var(--border, #e2e8f0)",
              overflow: "hidden",
              boxShadow: "0 24px 60px rgba(0, 0, 0, 0.3)",
              fontFamily: "var(--font-jakarta, 'Plus Jakarta Sans', sans-serif)",
            }}
          >
            {/* Header sem classe .modal-header h3 global para garantir texto 100% branco legível */}
            <div
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
                <span className="material-symbols-outlined" style={{ color: "#38bdf8", fontSize: "22px" }}>
                  history
                </span>
                <div
                  style={{
                    margin: 0,
                    fontSize: "16.5px",
                    fontWeight: 800,
                    color: "#ffffff",
                    letterSpacing: "-0.01em",
                  }}
                >
                  Histórico de Relatórios de Acompanhamento Semanal Enviados
                </div>
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

            <div style={{ padding: "20px 24px", maxHeight: "75vh", overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr
                    style={{
                      backgroundColor: "var(--surface-container-low, #f8fafc)",
                      borderBottom: "1px solid var(--border, #e2e8f0)",
                      textAlign: "left",
                      fontSize: "11px",
                      textTransform: "uppercase",
                      color: "var(--on-surface-variant)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <th style={{ padding: "11px 14px", whiteSpace: "nowrap" }}>Data do Relatório</th>
                    <th style={{ padding: "11px 14px", whiteSpace: "nowrap" }}>Mês Ref.</th>
                    <th style={{ padding: "11px 14px", textAlign: "right", whiteSpace: "nowrap" }}>
                      Posição Financeira
                    </th>
                    <th style={{ padding: "11px 14px", textAlign: "right", whiteSpace: "nowrap" }}>Contas a Pagar</th>
                    <th style={{ padding: "11px 14px", textAlign: "right", whiteSpace: "nowrap" }}>Total a Receber</th>
                    <th style={{ padding: "11px 14px", textAlign: "right", whiteSpace: "nowrap" }}>Projetos (Mês)</th>
                    <th style={{ padding: "11px 14px", textAlign: "center", whiteSpace: "nowrap" }}>Ações</th>
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
                          whiteSpace: "nowrap",
                        }}
                      >
                        <td style={{ padding: "13px 14px", fontWeight: 800, whiteSpace: "nowrap" }}>
                          <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", whiteSpace: "nowrap" }}>
                            <span>{formatarDataBR(item.dataReferencia)}</span>
                            {idx === 0 && (
                              <span
                                style={{
                                  padding: "2px 9px",
                                  borderRadius: "999px",
                                  fontSize: "10.5px",
                                  backgroundColor: "#dcfce7",
                                  color: "#15803d",
                                  fontWeight: 800,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                Último Enviado
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: "13px 14px", fontWeight: 600, whiteSpace: "nowrap" }}>
                          {item.mesReferencia}/{item.anoReferencia}
                        </td>
                        <td style={{ padding: "13px 14px", textAlign: "right", fontWeight: 700, whiteSpace: "nowrap" }}>
                          R$ {fmtNum(item.posicaoFinanceira.total)}
                        </td>
                        <td style={{ padding: "13px 14px", textAlign: "right", fontWeight: 600, whiteSpace: "nowrap" }}>
                          R$ {fmtNum(item.contasAPagar.totalPeriodo)}
                        </td>
                        <td
                          style={{
                            padding: "13px 14px",
                            textAlign: "right",
                            fontWeight: 700,
                            color: "#0284c7",
                            whiteSpace: "nowrap",
                          }}
                        >
                          R$ {fmtNum(item.totalAReceber)}
                        </td>
                        <td
                          style={{
                            padding: "13px 14px",
                            textAlign: "right",
                            fontWeight: 700,
                            color: "#059669",
                            whiteSpace: "nowrap",
                          }}
                        >
                          R$ {fmtNum(item.totalProjetos)}
                        </td>
                        <td style={{ padding: "13px 14px", textAlign: "center", whiteSpace: "nowrap" }}>
                          <div style={{ display: "inline-flex", gap: "8px", whiteSpace: "nowrap" }}>
                            <button
                              type="button"
                              onClick={() => {
                                setRelatorioSelecionadoId(item.id);
                                setModalHistoricoAberto(false);
                              }}
                              style={{
                                padding: "6px 12px",
                                borderRadius: "7px",
                                border: "1px solid #0284c7",
                                backgroundColor: isAtual ? "#0284c7" : "transparent",
                                color: isAtual ? "#ffffff" : "#0284c7",
                                fontSize: "11.5px",
                                fontWeight: 700,
                                cursor: "pointer",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {isAtual ? "Em Exibição" : "Visualizar"}
                            </button>
                            {podeEditarRelatorio && historico.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleExcluirRelatorio(item.id, item.dataReferencia)}
                                title="Excluir este envio do histórico"
                                style={{
                                  padding: "6px 10px",
                                  borderRadius: "7px",
                                  border: "1px solid #fecaca",
                                  backgroundColor: "transparent",
                                  color: "#dc2626",
                                  fontSize: "11.5px",
                                  fontWeight: 600,
                                  cursor: "pointer",
                                  whiteSpace: "nowrap",
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
          MODAL 2: PREENCHIMENTO MANUAL & SINCRONIZAÇÃO COM A BASE (EXCLUSIVO ADMIN)
         ===================================================================== */}
      {modalEdicaoAberto && podeEditarRelatorio && (
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
              fontFamily: "var(--font-jakarta, 'Plus Jakarta Sans', sans-serif)",
            }}
          >
            {/* Header do Modal (Fonte 100% Branca Nítida sem override de .modal-header h3) */}
            <div
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
                  <div style={{ margin: 0, fontSize: "16.5px", fontWeight: 800, color: "#ffffff" }}>
                    Configurar &amp; Publicar Relatório de Acompanhamento Semanal
                  </div>
                  <span style={{ fontSize: "12px", color: "#e0f2fe", fontWeight: 500 }}>
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
              {/* 1. Data de Referência (Mesma Fonte dos Demais Campos), Mês Corrente e Botão de Sincronização */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "190px 190px 1fr",
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
                    style={{
                      width: "100%",
                      padding: "7px 10px",
                      borderRadius: "7px",
                      border: "1px solid #cbd5e1",
                      fontFamily: "var(--font-jakarta, 'Plus Jakarta Sans', sans-serif)",
                      fontSize: "13px",
                      fontWeight: 600,
                    }}
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
                    style={{
                      width: "100%",
                      padding: "7px 10px",
                      borderRadius: "7px",
                      border: "1px solid #cbd5e1",
                      fontFamily: "var(--font-jakarta, 'Plus Jakarta Sans', sans-serif)",
                      fontSize: "13px",
                      fontWeight: 600,
                    }}
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
                      fontFamily: "var(--font-jakarta, 'Plus Jakarta Sans', sans-serif)",
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

              {/* 2. POSIÇÃO FINANCEIRA (Preenchimento Manual em formato 0.000,00) */}
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
                      gridTemplateColumns: "110px 1fr 1fr 150px",
                      gap: "10px",
                      alignItems: "center",
                    }}
                  >
                    <span style={{ fontWeight: 800, textTransform: "uppercase", fontSize: "12px" }}>
                      {inst === "itau" ? "ITAÚ" : inst.toUpperCase()}
                    </span>
                    <div>
                      <label style={{ fontSize: "10px", fontWeight: 700, display: "block", marginBottom: "2px" }}>
                        CAIXA (R$)
                      </label>
                      <InputMoedaBR
                        value={formRelatorio.posicaoFinanceira[inst].caixa}
                        onChange={(val) =>
                          setFormRelatorio((prev) => ({
                            ...prev,
                            posicaoFinanceira: {
                              ...prev.posicaoFinanceira,
                              [inst]: { ...prev.posicaoFinanceira[inst], caixa: val },
                            },
                          }))
                        }
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "10px", fontWeight: 700, display: "block", marginBottom: "2px" }}>
                        APLICAÇÃO (R$)
                      </label>
                      <InputMoedaBR
                        value={formRelatorio.posicaoFinanceira[inst].aplicacao}
                        onChange={(val) =>
                          setFormRelatorio((prev) => ({
                            ...prev,
                            posicaoFinanceira: {
                              ...prev.posicaoFinanceira,
                              [inst]: { ...prev.posicaoFinanceira[inst], aplicacao: val },
                            },
                          }))
                        }
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "10px", fontWeight: 700, display: "block", marginBottom: "2px" }}>
                        RENTABILIDADE
                      </label>
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
                        style={{
                          width: "100%",
                          padding: "7px 10px",
                          borderRadius: "7px",
                          border: "1px solid #cbd5e1",
                          fontFamily: "var(--font-jakarta, 'Plus Jakarta Sans', sans-serif)",
                          fontSize: "13px",
                          fontWeight: 600,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* 3. CONTAS A PAGAR & CONTAS A RECEBER (Preenchimento Manual em formato 0.000,00) */}
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
                      <label style={{ fontSize: "10px", fontWeight: 700, display: "block", marginBottom: "2px" }}>
                        VENCIDOS (R$)
                      </label>
                      <InputMoedaBR
                        value={formRelatorio.contasAPagar.vencidos}
                        onChange={(v) =>
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
                          }))
                        }
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "10px", fontWeight: 700, display: "block", marginBottom: "2px" }}>
                        VENCEM HOJE (R$)
                      </label>
                      <InputMoedaBR
                        value={formRelatorio.contasAPagar.vencemHoje}
                        onChange={(v) =>
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
                          }))
                        }
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "10px", fontWeight: 700, display: "block", marginBottom: "2px" }}>
                        A VENCER (R$)
                      </label>
                      <InputMoedaBR
                        value={formRelatorio.contasAPagar.aVencer}
                        onChange={(v) =>
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
                          }))
                        }
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "10px", fontWeight: 700, display: "block", marginBottom: "2px" }}>
                        PAGOS (R$)
                      </label>
                      <InputMoedaBR
                        value={formRelatorio.contasAPagar.pagos}
                        onChange={(v) =>
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
                          }))
                        }
                      />
                    </div>
                    <div style={{ gridColumn: "1 / -1" }}>
                      <label style={{ fontSize: "10px", fontWeight: 800, display: "block", marginBottom: "2px" }}>
                        TOTAL DO PERÍODO (R$)
                      </label>
                      <InputMoedaBR
                        value={formRelatorio.contasAPagar.totalPeriodo}
                        onChange={(v) =>
                          setFormRelatorio((prev) => ({
                            ...prev,
                            contasAPagar: { ...prev.contasAPagar, totalPeriodo: v },
                          }))
                        }
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
                      <label style={{ fontSize: "10px", fontWeight: 700, display: "block", marginBottom: "2px" }}>
                        VENCIDOS (R$)
                      </label>
                      <InputMoedaBR
                        value={formRelatorio.contasAReceber.vencidos}
                        onChange={(v) =>
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
                          }))
                        }
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "10px", fontWeight: 700, display: "block", marginBottom: "2px" }}>
                        VENCEM HOJE (R$)
                      </label>
                      <InputMoedaBR
                        value={formRelatorio.contasAReceber.vencemHoje}
                        onChange={(v) =>
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
                          }))
                        }
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "10px", fontWeight: 700, display: "block", marginBottom: "2px" }}>
                        A VENCER (R$)
                      </label>
                      <InputMoedaBR
                        value={formRelatorio.contasAReceber.aVencer}
                        onChange={(v) =>
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
                          }))
                        }
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "10px", fontWeight: 700, display: "block", marginBottom: "2px" }}>
                        PAGOS (R$)
                      </label>
                      <InputMoedaBR
                        value={formRelatorio.contasAReceber.pagos}
                        onChange={(v) =>
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
                          }))
                        }
                      />
                    </div>
                    <div style={{ gridColumn: "1 / -1" }}>
                      <label style={{ fontSize: "10px", fontWeight: 800, display: "block", marginBottom: "2px" }}>
                        TOTAL DO PERÍODO (R$)
                      </label>
                      <InputMoedaBR
                        value={formRelatorio.contasAReceber.totalPeriodo}
                        onChange={(v) =>
                          setFormRelatorio((prev) => ({
                            ...prev,
                            contasAReceber: { ...prev.contasAReceber, totalPeriodo: v },
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 4. CASH BACK & CLARA DESCONTO (Preenchimento Manual em formato 0.000,00 -> Gráfico Ajustado Automaticamente) */}
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
                        <label style={{ fontSize: "10px", fontWeight: 700, display: "block", marginBottom: "2px" }}>
                          {ano} (R$)
                        </label>
                        <InputMoedaBR
                          value={formRelatorio.cashBack.anos[ano]}
                          onChange={(v) =>
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
                            })
                          }
                        />
                      </div>
                    ))}
                  </div>
                  <div>
                    <label style={{ fontSize: "10px", fontWeight: 800, display: "block", marginBottom: "2px" }}>
                      VALOR TOTAL EXIBIDO NO CARD (R$)
                    </label>
                    <InputMoedaBR
                      value={formRelatorio.cashBack.totalAcumulado}
                      onChange={(v) =>
                        setFormRelatorio((prev) => ({
                          ...prev,
                          cashBack: { ...prev.cashBack, totalAcumulado: v },
                        }))
                      }
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
                        <label style={{ fontSize: "10px", fontWeight: 700, display: "block", marginBottom: "2px" }}>
                          {ano} (R$)
                        </label>
                        <InputMoedaBR
                          value={formRelatorio.claraDesconto.anos[ano]}
                          onChange={(v) =>
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
                            })
                          }
                        />
                      </div>
                    ))}
                  </div>
                  <div>
                    <label style={{ fontSize: "10px", fontWeight: 800, display: "block", marginBottom: "2px" }}>
                      VALOR TOTAL EXIBIDO NO CARD (R$)
                    </label>
                    <InputMoedaBR
                      value={formRelatorio.claraDesconto.totalAcumulado}
                      onChange={(v) =>
                        setFormRelatorio((prev) => ({
                          ...prev,
                          claraDesconto: { ...prev.claraDesconto, totalAcumulado: v },
                        }))
                      }
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

      {/* =====================================================================
          MODAL 3: PRÉVIA & VALIDAÇÃO DO E-MAIL DE RESUMO EXECUTIVO PERSONALIZADO
         ===================================================================== */}
      {modalPreviewEmail?.aberto && (
        <div
          className="modal-backdrop"
          onClick={() => setModalPreviewEmail(null)}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(9, 21, 38, 0.65)",
            backdropFilter: "blur(4px)",
            zIndex: 9500,
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
              maxWidth: "780px",
              maxHeight: "92vh",
              backgroundColor: "var(--surface-container-lowest, #ffffff)",
              borderRadius: "18px",
              border: "1px solid var(--border, #e2e8f0)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              boxShadow: "0 24px 60px rgba(0, 0, 0, 0.35)",
              fontFamily: "var(--font-jakarta, 'Plus Jakarta Sans', sans-serif)",
            }}
          >
            <div
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
                <span className="material-symbols-outlined" style={{ color: "#38bdf8", fontSize: "22px" }}>
                  mark_email_read
                </span>
                <div>
                  <div style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#ffffff" }}>
                    Prévia &amp; Disparo do E-mail Executivo Personalizado
                  </div>
                  <div style={{ fontSize: "12px", color: "#bae6fd", fontWeight: 500 }}>
                    Para: <strong>{modalPreviewEmail.destinatario}</strong> • Assunto: {modalPreviewEmail.assunto}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalPreviewEmail(null)}
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

            <div style={{ padding: "16px 20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "12px" }}>
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: "10px",
                  backgroundColor: modalPreviewEmail.sucesso ? "#ecfdf5" : "#fff7ed",
                  border: modalPreviewEmail.sucesso ? "1px solid #a7f3d0" : "1px solid #fed7aa",
                  color: modalPreviewEmail.sucesso ? "#065f46" : "#9a3412",
                  fontSize: "12.5px",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                    {modalPreviewEmail.sucesso ? "check_circle" : "info"}
                  </span>
                  <span>
                    {modalPreviewEmail.sucesso
                      ? `E-mail disparado para ${modalPreviewEmail.destinatario} (modo: ${modalPreviewEmail.modo?.toUpperCase() || "SMTP"})!`
                      : `Prévia gerada para ${modalPreviewEmail.destinatario}. Status SMTP: ${modalPreviewEmail.mensagem || "Verifique credenciais de aplicativo do Office 365 / Resend"}`}
                  </span>
                </div>
              </div>

              {/* Renderização fiel do HTML enviado por e-mail */}
              <div
                style={{
                  borderRadius: "12px",
                  border: "1px solid #cbd5e1",
                  overflow: "hidden",
                  backgroundColor: "#f1f5f9",
                }}
                dangerouslySetInnerHTML={{ __html: modalPreviewEmail.html }}
              />
            </div>

            <div
              style={{
                padding: "12px 20px",
                borderTop: "1px solid var(--border, #e2e8f0)",
                display: "flex",
                justifyContent: "flex-end",
                gap: "10px",
              }}
            >
              <button
                type="button"
                onClick={() => setModalPreviewEmail(null)}
                className="btn-primary"
                style={{
                  padding: "8px 20px",
                  borderRadius: "10px",
                  fontWeight: 800,
                  cursor: "pointer",
                  background: "#0a3254",
                  color: "#ffffff",
                  border: "none",
                }}
              >
                Fechar Prévia
              </button>
            </div>
          </div>
        </div>
      )}
    </RelatorioShell>
  );
}
