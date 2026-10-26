/**
 * Utilitários de formatação para Viagens e Logística (compatíveis com Client e Server Components)
 */

export function formatarObservacoesAgenciaCard(obsBruta?: string | null): string {
  if (!obsBruta || !obsBruta.trim()) return "Nenhuma instrução adicional registrada.";

  // Se não contém tags estruturadas [PASSAGEIRO], [AÉREO], etc., é uma observação simples
  if (!obsBruta.includes("[")) {
    return obsBruta.trim();
  }

  const partes: string[] = [];

  const matchAereoObs = obsBruta.match(/\[A[EÉ]REO\][^\[]*?\|\s*OBS:\s*([^|\n]+)/i);
  if (matchAereoObs && matchAereoObs[1].trim() && matchAereoObs[1].trim().toLowerCase() !== "nenhuma") {
    partes.push(`Aéreo: ${matchAereoObs[1].trim()}`);
  }

  const matchHotelObs = obsBruta.match(/\[HOTEL\][^\[]*?\|\s*OBS:\s*([^|\n]+)/i);
  if (matchHotelObs && matchHotelObs[1].trim() && matchHotelObs[1].trim().toLowerCase() !== "nenhuma") {
    partes.push(`Hotel: ${matchHotelObs[1].trim()}`);
  }

  const matchVeiculoObs = obsBruta.match(/\[VE[IÍ]CULO[^\]]*?\][^\[]*?\|\s*OBS:\s*([^|\n]+)/i);
  if (matchVeiculoObs && matchVeiculoObs[1].trim() && matchVeiculoObs[1].trim().toLowerCase() !== "nenhuma") {
    partes.push(`Veículo: ${matchVeiculoObs[1].trim()}`);
  }

  const matchPassageiroObs = obsBruta.match(/\[PASSAGEIRO\][^\[]*?\|\s*OBS:\s*([^|\n]+)/i);
  if (matchPassageiroObs && matchPassageiroObs[1].trim() && matchPassageiroObs[1].trim().toLowerCase() !== "nenhuma") {
    partes.push(`Passageiro: ${matchPassageiroObs[1].trim()}`);
  }

  if (partes.length === 0) {
    return "Nenhuma instrução adicional registrada.";
  }

  return partes.join(" • ");
}
