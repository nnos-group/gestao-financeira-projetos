import consultoresBase from "@/lib/consultores-base.json";

function cleanString(str: string): string {
  return (str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

// Mapas indexados para busca rápida O(1)
const mapNome = new Map<string, string>();
const mapNomeCompleto = new Map<string, string>();
const mapCnpj = new Map<string, string>();

(consultoresBase as any[]).forEach((c) => {
  if (c.nome) {
    const nomeCurto = String(c.nome).trim().toUpperCase();
    mapNome.set(cleanString(c.nome), nomeCurto);
    if (c.cnpj) {
      const cnpjLimpo = String(c.cnpj).replace(/\D/g, "");
      if (cnpjLimpo) mapCnpj.set(cnpjLimpo, nomeCurto);
    }
  }
  if (c.nome_completo) {
    const nomeCurto = String(c.nome || c.nome_completo).trim().toUpperCase();
    mapNomeCompleto.set(cleanString(c.nome_completo), nomeCurto);
  }
});

// Sinônimos operacionais entre PDFs de BMs, faturamento e contabilidade
const SINONIMOS_CONSULTORES: Record<string, string> = {
  [cleanString("William Bonfim Nunes Santos")]: "WILLIAM SANTOS",
  [cleanString("WILLIAM BONFIM NUNES SANTOS")]: "WILLIAM SANTOS",
  [cleanString("WILLIAM SANTOS")]: "WILLIAM SANTOS",
  [cleanString("MARCELO LARA DA SILVA")]: "MARCELO LARA",
  [cleanString("MARCELO LARA")]: "MARCELO LARA",
  [cleanString("JOÃO GILBERTO DE MELLO SANTOS JUNIOR")]: "GIBA - JOÃO GILBERTO",
  [cleanString("JOAO GILBERTO DE MELLO SANTOS JUNIOR")]: "GIBA - JOÃO GILBERTO",
  [cleanString("GIBA")]: "GIBA - JOÃO GILBERTO",
  [cleanString("MARIA BEATRIZ PICORELLI SANTOS SILVA")]: "BEATRIZ PICORELLI",
  [cleanString("BEATRIZ PICORELLI")]: "BEATRIZ PICORELLI",
  [cleanString("PEDRO HENRIQUE DE SOUZA LAGE")]: "PEDRO LAGE",
  [cleanString("PEDRO LAGE")]: "PEDRO LAGE",
  [cleanString("PEDRO ERNESTO COLARES DE PAULA")]: "PEDRO COLARES",
  [cleanString("PEDRO COLARES")]: "PEDRO COLARES",
  [cleanString("TIAGO ANGELO DE QUEIROZ LOPES")]: "TIAGO ANGELO",
  [cleanString("TIAGO ANGELO")]: "TIAGO ANGELO",
  [cleanString("MARISTELA NEVES GARCIA")]: "MARISTELA GARCIA",
  [cleanString("MARISTELA GARCIA")]: "MARISTELA GARCIA",
  [cleanString("ANTONIO PEREZ AMIEVA")]: "ANTONIO PEREZ",
  [cleanString("ANTONIO PEREZ")]: "ANTONIO PEREZ",
  [cleanString("LEONARDO FERREIRA CAMPOS")]: "LEONARDO CAMPOS",
  [cleanString("LEONARDO CAMPOS")]: "LEONARDO CAMPOS",
  [cleanString("JEFFERSON DE ANDRADE SOUZA")]: "JEFFERSON SOUZA",
  [cleanString("JEFFERSON SOUZA")]: "JEFFERSON SOUZA",
  [cleanString("CLEIVSON MOURA VIEIRA")]: "CLEIVSON VIEIRA",
  [cleanString("CLEIVSON VIEIRA")]: "CLEIVSON VIEIRA",
  [cleanString("RODRIGO MARTINELLI KAIRALLA")]: "RODRIGO KAIRALLA",
  [cleanString("RODRIGO KAIRALLA")]: "RODRIGO KAIRALLA",
  [cleanString("RODRIGO MARQUES BARDIM")]: "RODRIGO BARDIM",
  [cleanString("RODRIGO BARDIM")]: "RODRIGO BARDIM",
  [cleanString("CEZAR TEIXEIRA HENRIQUE")]: "CEZAR HENRIQUE",
  [cleanString("CEZAR HENRIQUE")]: "CEZAR HENRIQUE",
  [cleanString("FABIO LUIS CANASSA")]: "FÁBIO CANASSA",
  [cleanString("FABIO CANASSA")]: "FÁBIO CANASSA",
  [cleanString("FABIO MORENO")]: "FÁBIO MORENO",
  [cleanString("ROBSON NASCENTES PASSINI")]: "ROBSON PASSINI",
  [cleanString("ROBSON PASSINI")]: "ROBSON PASSINI",
  [cleanString("IGOR PICORELLI SANTOS E SILVA")]: "IGOR PICORELLI",
  [cleanString("IGOR PICORELLI")]: "IGOR PICORELLI",
  [cleanString("FELIPE ALVES FRANCA CAMPOS")]: "FELIPE FRANÇA",
  [cleanString("FELIPE DE MELLO MARTINS")]: "FELIPE MELLO",
  [cleanString("LILIA APARECIDA DE OLIVEIRA")]: "LILIA OLIVEIRA",
  [cleanString("ELIZA FORTUNA TORRES ROSA")]: "ELIZA ROSA",
  [cleanString("GABRIEL IGNACIO GIUSSANI")]: "GABRIEL GIUSSANI",
  [cleanString("ALEJANDO LAPUENTE")]: "ALEJANDRO LAPUENTE",
  [cleanString("ALEJANDRO DANIEL LAPUENTE DURANTE")]: "ALEJANDRO LAPUENTE",
  [cleanString("ADILSON PASINI")]: "ADILSON PASINI",
  [cleanString("ADAO LADEIRA")]: "ADÃO LADEIRA",
  [cleanString("FLAVIO SOUZA")]: "FLÁVIO SOUZA",
  [cleanString("VINICIUS DIEGUEZ")]: "VINICIUS DIEGUEZ",
  [cleanString("VINICIUS SOUZA")]: "VINICIUS SOUZA",
  [cleanString("JOICE LAGE")]: "JOICE LAGE",
  [cleanString("TATIANA AZEVEDO")]: "TATIANA AZEVEDO",
  [cleanString("DOLORES LITZA")]: "DOLORES LITZA",
  [cleanString("CHARLES MORAIS")]: "CHARLES MORAIS",
  [cleanString("ERIC LAIA")]: "ERIC LAIA",
  [cleanString("LUIS OTAVIO")]: "LUÍS OTÁVIO",
};

/**
 * Retorna o formato curto padronizado do nome de um consultor / prestador
 * Ex: "William Bonfim Nunes Santos" -> "WILLIAM SANTOS"
 * Ex: "MARCELO LARA DA SILVA" -> "MARCELO LARA"
 */
export function formatarNomeCurto(nome?: string, cnpj?: string): string {
  if (!nome || !nome.trim()) return "";
  const limpo = cleanString(nome);

  // 1. Tentar correspondência direta em sinônimos conhecidos
  if (SINONIMOS_CONSULTORES[limpo]) {
    return SINONIMOS_CONSULTORES[limpo];
  }

  // 2. Tentar correspondência pelo nome completo no cadastro oficial
  if (mapNomeCompleto.has(limpo)) {
    return mapNomeCompleto.get(limpo)!;
  }

  // 3. Tentar correspondência pelo nome no cadastro oficial
  if (mapNome.has(limpo)) {
    return mapNome.get(limpo)!;
  }

  // 4. Tentar correspondência pelo CNPJ do prestador
  if (cnpj) {
    const rawCnpj = cnpj.replace(/\D/g, "");
    if (rawCnpj && mapCnpj.has(rawCnpj)) {
      return mapCnpj.get(rawCnpj)!;
    }
  }

  // 5. Heurística fallback: Primeiro e Último Nome em Maiúsculas
  const parts = nome.trim().split(/\s+/);
  if (parts.length > 2) {
    return `${parts[0]} ${parts[parts.length - 1]}`.toUpperCase();
  }

  return nome.trim().toUpperCase();
}
