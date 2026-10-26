/**
 * Utilitários Oficiais de Formatação de Datas em Formato Brasileiro (pt-BR)
 * Diretriz do Sistema: Todas as datas apresentadas devem seguir o formato brasileiro (DD/MM/AAAA).
 */

/**
 * Converte qualquer formato de data (ISO YYYY-MM-DD, ISO com hora, Date object, timestamp)
 * para o formato brasileiro DD/MM/AAAA.
 * Se a string já estiver no padrão DD/MM/AAAA, mantém inalterada.
 */
export function formatarDataBR(data?: string | Date | null): string {
  if (!data) return "";

  if (data instanceof Date) {
    if (isNaN(data.getTime())) return "";
    const dia = String(data.getDate()).padStart(2, "0");
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const ano = data.getFullYear();
    return `${dia}/${mes}/${ano}`;
  }

  const str = String(data).trim();
  if (!str) return "";

  // Se já for DD/MM/AAAA
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
    return str;
  }

  // Se for DD/MM/AA
  if (/^\d{2}\/\d{2}\/\d{2}$/.test(str)) {
    const [d, m, a] = str.split("/");
    return `${d}/${m}/20${a}`;
  }

  // Se contiver 'T' ou espaço (ex: ISO 2026-10-30T14:20:00Z ou 2026-10-30 14:20:00)
  const limpo = str.split("T")[0].split(" ")[0];

  // Se for YYYY-MM-DD
  const partesIso = limpo.split("-");
  if (partesIso.length === 3 && partesIso[0].length === 4) {
    const [ano, mes, dia] = partesIso;
    return `${dia.padStart(2, "0")}/${mes.padStart(2, "0")}/${ano}`;
  }

  return str;
}

/**
 * Formata um período de datas (inicial e final) no padrão brasileiro.
 * Exemplo:
 * - "2026-10-30" e "2026-10-30" -> "30/10/2026 a 30/10/2026"
 * - "2026-10-15" e "2026-10-20" -> "15/10/2026 a 20/10/2026"
 * - apenas inicial -> "30/10/2026"
 */
export function formatarPeriodoBR(
  dataInicial?: string | Date | null,
  dataFinal?: string | Date | null
): string {
  const dIni = formatarDataBR(dataInicial);
  const dFim = formatarDataBR(dataFinal);

  if (dIni && dFim) {
    return `${dIni} a ${dFim}`;
  }
  if (dIni) return dIni;
  if (dFim) return dFim;
  return "—";
}

/**
 * Converte data e hora para DD/MM/AAAA às HH:mm (pt-BR)
 */
export function formatarDataHoraBR(data?: string | Date | null): string {
  if (!data) return "";
  try {
    const d = data instanceof Date ? data : new Date(data);
    if (isNaN(d.getTime())) return formatarDataBR(data);
    const dataFmt = formatarDataBR(d);
    const horas = String(d.getHours()).padStart(2, "0");
    const minutos = String(d.getMinutes()).padStart(2, "0");
    return `${dataFmt} às ${horas}:${minutos}`;
  } catch {
    return formatarDataBR(data);
  }
}

export interface PrazoPrestacaoContasInfo {
  status: "CONCLUIDO" | "DENTRO_DO_PRAZO" | "EM_ATRASO" | "NAO_APLICAVEL";
  label: string;
  badgeTexto: string;
  diasAtraso: number;
  diasRestantes: number;
  corTexto: string;
  corBg: string;
  icone: string;
}

/**
 * Calcula o indicador oficial de Prazo de Prestação de Contas (Print 3):
 * - Acionado quando precisa_logistica for SIM / true;
 * - Inicia contagem a partir da data final da viagem;
 * - Até o 5º dia após a viagem: "DENTRO DO PRAZO" (cor azul/verde);
 * - Após o 5º dia, se Alimentação/Diária estiver 0,00: "X DIAS DE ATRASO" (cor vermelha);
 * - Com Alimentação/Diária preenchida (> 0): "CONCLUÍDO" (cor verde / secondary).
 */
export function calcularPrazoPrestacaoContas(
  precisaLogistica?: boolean | string | null,
  dataFinal?: string | Date | null,
  valorAlimentacao?: number | string | null,
  statusAtividade?: string | null
): PrazoPrestacaoContasInfo {
  // Tratamento defensivo caso os argumentos tenham sido passados invertidos: (dataFinal, precisaLogistica)
  let argLogistica = precisaLogistica;
  let argDataFinal = dataFinal;

  if (
    (typeof argLogistica === "string" && (argLogistica.includes("-") || argLogistica.includes("/"))) &&
    (typeof argDataFinal === "boolean" ||
      (typeof argDataFinal === "string" && (argDataFinal.toUpperCase() === "SIM" || argDataFinal.toUpperCase() === "NAO" || argDataFinal === "true" || argDataFinal === "false")))
  ) {
    const temp = argLogistica;
    argLogistica = argDataFinal;
    argDataFinal = temp;
  }

  // Regra de Negócio: Se o status da atividade for CANCELADO, o prazo é NÃO APLICÁVEL
  const isCancelado = (statusAtividade || "").toUpperCase().includes("CANCEL");
  if (isCancelado) {
    return {
      status: "NAO_APLICAVEL",
      label: "Prazo Prestação de Contas",
      badgeTexto: "NÃO APLICÁVEL",
      diasAtraso: 0,
      diasRestantes: 0,
      corTexto: "var(--on-surface-variant, #64748b)",
      corBg: "var(--surface-container, #f1f5f9)",
      icone: "remove",
    };
  }

  const isLogistica =
    argLogistica === true ||
    argLogistica === "SIM" ||
    argLogistica === "sim" ||
    argLogistica === "true";

  if (!isLogistica) {
    return {
      status: "NAO_APLICAVEL",
      label: "Prazo Prestação de Contas",
      badgeTexto: "NÃO APLICÁVEL",
      diasAtraso: 0,
      diasRestantes: 0,
      corTexto: "var(--on-surface-variant, #64748b)",
      corBg: "var(--surface-container, #f1f5f9)",
      icone: "remove",
    };
  }

  const vAlim = Number(valorAlimentacao) || 0;
  // Se alimentação já foi preenchida / prestada contas (> 0), encerra como CONCLUÍDO
  if (vAlim > 0) {
    return {
      status: "CONCLUIDO",
      label: "Prazo Prestação de Contas",
      badgeTexto: "CONCLUÍDO",
      diasAtraso: 0,
      diasRestantes: 0,
      corTexto: "var(--secondary, #00a896)",
      corBg: "rgba(0, 168, 150, 0.12)",
      icone: "task_alt",
    };
  }

  // Parse da data final da viagem
  let dFim: Date | null = null;
  if (argDataFinal instanceof Date) {
    dFim = new Date(argDataFinal.getTime());
  } else if (typeof argDataFinal === "string" && argDataFinal.trim()) {
    const s = argDataFinal.trim();
    if (s.includes("/")) {
      const p = s.split("/");
      if (p.length === 3) dFim = new Date(parseInt(p[2], 10), parseInt(p[1], 10) - 1, parseInt(p[0], 10));
    } else if (s.includes("-")) {
      const p = s.split("T")[0].split("-");
      if (p.length === 3) dFim = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
    }
  }

  if (!dFim || isNaN(dFim.getTime())) {
    return {
      status: "DENTRO_DO_PRAZO",
      label: "Prazo Prestação de Contas",
      badgeTexto: "DENTRO DO PRAZO",
      diasAtraso: 0,
      diasRestantes: 5,
      corTexto: "#0284c7",
      corBg: "rgba(2, 132, 199, 0.1)",
      icone: "schedule",
    };
  }

  dFim.setHours(0, 0, 0, 0);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  // Se a viagem ainda não acabou (ou termina hoje)
  if (hoje <= dFim) {
    return {
      status: "DENTRO_DO_PRAZO",
      label: "Prazo Prestação de Contas",
      badgeTexto: "DENTRO DO PRAZO",
      diasAtraso: 0,
      diasRestantes: 5,
      corTexto: "#0284c7",
      corBg: "rgba(2, 132, 199, 0.1)",
      icone: "schedule",
    };
  }

  // Dias decorridos após a data final da viagem
  const diffMs = hoje.getTime() - dFim.getTime();
  const diasCorridos = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // Até o 5º dia: DENTRO DO PRAZO
  if (diasCorridos <= 5) {
    return {
      status: "DENTRO_DO_PRAZO",
      label: "Prazo Prestação de Contas",
      badgeTexto: "DENTRO DO PRAZO",
      diasAtraso: 0,
      diasRestantes: 5 - diasCorridos,
      corTexto: "#0284c7",
      corBg: "rgba(2, 132, 199, 0.1)",
      icone: "schedule",
    };
  }

  // Passou do 5º dia e Alimentação/Diária está 0,00 -> X dias de atraso na cor vermelha
  const diasAtraso = diasCorridos - 5;
  return {
    status: "EM_ATRASO",
    label: "Prazo Prestação de Contas",
    badgeTexto: `${diasAtraso} ${diasAtraso === 1 ? "DIA" : "DIAS"} DE ATRASO`,
    diasAtraso,
    diasRestantes: 0,
    corTexto: "#ef4444",
    corBg: "rgba(239, 68, 68, 0.12)",
    icone: "warning",
  };
}
