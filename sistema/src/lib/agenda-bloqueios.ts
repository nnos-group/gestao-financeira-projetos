export interface AgendaBloqueio {
  id: string;
  consultorId?: string;
  consultorNome: string;
  dataInicial: string; // YYYY-MM-DD
  dataFinal: string;   // YYYY-MM-DD
  tipo: "OFF" | "FERIAS" | "OUTRA_ATIVIDADE" | "PARTICULAR" | "OUTRO";
  motivo: string;
  observacoes?: string;
  criadoEm: string;
}

/**
 * Normaliza strings para comparação flexível de nomes de consultor
 */
function normalizarNome(nome?: string | null): string {
  return (nome || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

/**
 * Verifica se um período de atividade entra em conflito com algum bloqueio do consultor.
 * Retorna o bloqueio conflitante caso exista, ou null caso o consultor esteja disponível.
 */
export function verificarConflitoBloqueio(
  bloqueios: AgendaBloqueio[],
  consultorNome: string,
  dataInicialAtividade: string,
  dataFinalAtividade?: string | null
): AgendaBloqueio | null {
  if (!consultorNome || !dataInicialAtividade || !bloqueios || bloqueios.length === 0) {
    return null;
  }

  const nomeBuscado = normalizarNome(consultorNome);
  const atvIni = dataInicialAtividade.slice(0, 10);
  const atvFim = (dataFinalAtividade || dataInicialAtividade).slice(0, 10);

  for (const b of bloqueios) {
    const bNome = normalizarNome(b.consultorNome);
    const mesmoConsultor =
      bNome === nomeBuscado ||
      bNome.includes(nomeBuscado) ||
      nomeBuscado.includes(bNome);

    if (mesmoConsultor) {
      const bIni = (b.dataInicial || "").slice(0, 10);
      const bFim = (b.dataFinal || b.dataInicial || "").slice(0, 10);

      if (!bIni) continue;

      // Interseção de intervalos: [atvIni, atvFim] colide com [bIni, bFim] se:
      // atvIni <= bFim && atvFim >= bIni
      const haConflito = atvIni <= bFim && atvFim >= bIni;
      if (haConflito) {
        return b;
      }
    }
  }

  return null;
}
