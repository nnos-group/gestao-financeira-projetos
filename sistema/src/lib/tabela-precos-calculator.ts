import tabelaPrecosData from "./tabela-precos.json";

export interface RegraPrecoCliente {
  valorHora: number;
  valorDia: number;
  valorMensal?: number;
}

export interface RegraConsultor {
  perfil: string;
  clienteBrasil: { valorHora: number; valorDia: number };
  clienteLatam: { valorHora: number; valorDia: number };
  socioBrasil: number;
  socioLatam: number;
  parceiroBrasil: number;
  parceiroLatam: number;
}

export interface ResultadoCalculoAtividade {
  contratoCodigo: string;
  contratoNome: string;
  ehContratoTabelado: boolean;
  
  // Faturamento Cliente
  valorHoraCliente: number | null;
  valorDiaCliente: number | null;
  totalFaturar: number | null;

  // Custo Consultoria
  ehSocio: boolean;
  ehComissao: boolean;
  tarifaConsultorBase: number | null;
  acrescimoSocioAplicado: boolean;
  percentualAcrescimoSocio: number;
  tarifaConsultorFinal: number | null;
  totalCustoConsultor: number | null;

  // Explicações e Rastreabilidade
  detalhes: {
    regraAplicada: string;
    excecaoComissaoAtiva: boolean;
    observacao: string;
  };
}

/**
 * Normaliza perfil (remove acentos, uppercase)
 */
export function normalizarPerfil(perfil?: string | null): "JÚNIOR" | "PLENO" | "SÊNIOR" | "BACK OFFICE" | string {
  if (!perfil) return "SÊNIOR";
  const p = perfil.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (p.includes("JUNIOR") || p.includes("JÚNIOR")) return "JÚNIOR";
  if (p.includes("PLENO")) return "PLENO";
  if (p.includes("SENIOR") || p.includes("SÊNIOR")) return "SÊNIOR";
  if (p.includes("BACK") || p.includes("OFFICE")) return "BACK OFFICE";
  return perfil.trim().toUpperCase();
}

/**
 * Retorna o contrato associado a um centro de custo ou código de contrato.
 * Considera os aliases De: Para: (ex: DM, COMERCIAL, CRM -> CNH INDUSTRIAL).
 */
export function obterContratoPorCentroCusto(codigoCC?: string | null, codigoContrato?: string | null): {
  id: string;
  codigo: string;
  nome: string;
  ehTabelado: boolean;
  contratoObj?: any;
} {
  const codContratoUpper = (codigoContrato || "").trim().toUpperCase();
  const codCCLimpo = (codigoCC || "").trim();

  // Se for explicitamente AVULSO, não aplicar tabela
  if (codContratoUpper === "AVULSO") {
    return { id: "contrato-avulso", codigo: "AVULSO", nome: "CONTRATO - AVULSO", ehTabelado: false };
  }

  // 1. Busca por código ou alias direto
  if (codContratoUpper) {
    const porCodigo = tabelaPrecosData.contratos.find((c: any) => {
      if (c.codigo.toUpperCase() === codContratoUpper || c.id === codigoContrato) return true;
      const aliases = (c.alias || []).map((a: string) => a.toUpperCase());
      return aliases.includes(codContratoUpper);
    });

    if (porCodigo && porCodigo.codigo !== "AVULSO") {
      return {
        id: porCodigo.id,
        codigo: porCodigo.codigo,
        nome: porCodigo.nome,
        ehTabelado: true,
        contratoObj: porCodigo,
      };
    }
  }

  // 2. Busca pelo Centro de Custo vinculado
  if (codCCLimpo) {
    const porCC = tabelaPrecosData.contratos.find((c: any) => {
      return Array.isArray(c.centrosDeCusto) && c.centrosDeCusto.includes(codCCLimpo);
    });

    if (porCC && porCC.codigo !== "AVULSO") {
      return {
        id: porCC.id,
        codigo: porCC.codigo,
        nome: porCC.nome,
        ehTabelado: true,
        contratoObj: porCC,
      };
    }
  }

  // 3. Fallback inteligente: se o nome do projeto tiver DM, COMERCIAL, CRM ou CNH
  if (codContratoUpper.includes("DM") || codContratoUpper.includes("COMERCIAL") || codContratoUpper.includes("CRM") || codContratoUpper.includes("CNH")) {
    const cnh = tabelaPrecosData.contratos.find((c: any) => c.codigo === "CNH INDUSTRIAL" || c.id === "contrato-cnh" || c.codigo === "DM");
    if (cnh) {
      return {
        id: cnh.id,
        codigo: cnh.codigo,
        nome: cnh.nome,
        ehTabelado: true,
        contratoObj: cnh,
      };
    }
  }

  return { id: "contrato-avulso", codigo: "AVULSO", nome: "CONTRATO - AVULSO", ehTabelado: false };
}

/**
 * Verifica se um consultor é classificado como Sócio.
 */
export function verificarEhSocio(consultorNome?: string | null, tipoInformado?: string | null): boolean {
  if (!consultorNome) return false;

  const nomeNorm = consultorNome.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Exceções explícitas de negócio: regra de 6% de sócio NÃO se aplica para Marcelo Lara, Pedro Lage e Pedro Colares
  const excecoes = ["MARCELO LARA", "PEDRO LAGE", "PEDRO COLARES"];
  if (excecoes.some((exc) => nomeNorm.includes(exc.normalize("NFD")))) {
    return false;
  }

  if (tipoInformado && tipoInformado.toLowerCase() === "socio") {
    return true;
  }

  const socios = (tabelaPrecosData.consultoresClassificacao?.socios || []) as string[];
  
  return socios.some((s) => {
    const sNorm = s.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return nomeNorm.includes(sNorm) || sNorm.includes(nomeNorm);
  });
}

/**
 * Verifica se a descrição da atividade contém a palavra COMISSÃO / COMISSAO
 */
export function verificarEhComissao(atividadeDescricao?: string | null): boolean {
  if (!atividadeDescricao) return false;
  const descNorm = atividadeDescricao.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return descNorm.includes("COMISSAO") || descNorm.includes("COMISSA");
}

/**
 * Calcula os valores de faturamento e custo de consultoria com base nas regras contratuais.
 */
export function calcularValoresAtividade(params: {
  codigoCC?: string | null;
  codigoContrato?: string | null;
  perfil?: string | null;
  consultorNome?: string | null;
  consultorTipo?: string | null;
  regiao?: "BRA" | "LATAM" | string | null;
  atividadeDescricao?: string | null;
  horas?: number | null;
  ano?: number | string | null;
}): ResultadoCalculoAtividade {
  const {
    codigoCC,
    codigoContrato,
    perfil,
    consultorNome,
    consultorTipo,
    regiao = "BRA",
    atividadeDescricao = "",
    horas = 0,
    ano = 2026,
  } = params;

  // Determinar contrato
  const contratoInfo = obterContratoPorCentroCusto(codigoCC, codigoContrato);
  const contratoAtivo = contratoInfo.contratoObj || tabelaPrecosData.contratos[0];

  const perfilNorm = normalizarPerfil(perfil);
  const anoStr = String(ano || 2026);
  const isLatam = (regiao || "").toUpperCase() === "LATAM";

  const ehSocio = verificarEhSocio(consultorNome, consultorTipo);
  const ehComissao = verificarEhComissao(atividadeDescricao);

  if (!contratoInfo.ehTabelado || !contratoAtivo) {
    // Contrato Avulso: não força valores de tabela fixa
    return {
      contratoCodigo: "AVULSO",
      contratoNome: "CONTRATO - AVULSO",
      ehContratoTabelado: false,
      valorHoraCliente: null,
      valorDiaCliente: null,
      totalFaturar: null,
      ehSocio,
      ehComissao,
      tarifaConsultorBase: null,
      acrescimoSocioAplicado: false,
      percentualAcrescimoSocio: ehSocio && !ehComissao ? 6.0 : 0.0,
      tarifaConsultorFinal: null,
      totalCustoConsultor: null,
      detalhes: {
        regraAplicada: "CONTRATO - AVULSO: valores preenchidos manualmente pelo usuário.",
        excecaoComissaoAtiva: ehComissao,
        observacao: ehSocio && !ehComissao 
          ? "Consultor Sócio: lembrar de aplicar acréscimo de 6% sobre a tarifa acordada." 
          : "Lançamento livre sem amarração com tabela de preços pré-fixada.",
      },
    };
  }

  // 1. Tabela Preço Cliente
  let valorHoraCliente: number | null = null;
  let valorDiaCliente: number | null = null;

  if (contratoAtivo.tabelaPrecoCliente && Array.isArray(contratoAtivo.tabelaPrecoCliente)) {
    const itemPreco = contratoAtivo.tabelaPrecoCliente.find((p: any) => {
      const pNorm = normalizarPerfil(p.perfil);
      return pNorm === perfilNorm;
    }) || contratoAtivo.tabelaPrecoCliente[0];

    if (itemPreco && itemPreco.anos) {
      const anosObj = itemPreco.anos as Record<string, { valorHora: number; valorDia: number }>;
      const precoAno = anosObj[anoStr] || anosObj["2026"] || anosObj[Object.keys(anosObj)[0]];

      if (precoAno) {
        valorHoraCliente = precoAno.valorHora;
        valorDiaCliente = precoAno.valorDia || Math.round(precoAno.valorHora * 8 * 100) / 100;
      }
    }
  }

  const horasNum = Number(horas) || 0;
  const totalFaturar = valorHoraCliente != null && horasNum > 0
    ? Math.round(valorHoraCliente * horasNum * 100) / 100
    : null;

  // 2. Tabela Consultor
  let tarifaConsultorBase: number | null = null;
  if (contratoAtivo.tabelaConsultores && Array.isArray(contratoAtivo.tabelaConsultores)) {
    const itemConsultor = contratoAtivo.tabelaConsultores.find((tc: any) => {
      return normalizarPerfil(tc.perfil) === perfilNorm;
    }) || contratoAtivo.tabelaConsultores.find((tc: any) => normalizarPerfil(tc.perfil) === "SÊNIOR") || contratoAtivo.tabelaConsultores[0];

    if (itemConsultor) {
      if (ehSocio) {
        tarifaConsultorBase = isLatam ? itemConsultor.socioLatam : itemConsultor.socioBrasil;
      } else {
        tarifaConsultorBase = isLatam ? itemConsultor.parceiroLatam : itemConsultor.parceiroBrasil;
      }
    }
  }

  // 3. Regra de +6% para Sócios (exceto comissão)
  let tarifaConsultorFinal: number | null = tarifaConsultorBase;
  let acrescimoSocioAplicado = false;
  let percentualAcrescimoSocio = 0;

  if (ehSocio && tarifaConsultorBase != null) {
    if (ehComissao) {
      // Exceção: palavra COMISSÃO na atividade -> NÃO incide os 6%
      tarifaConsultorFinal = tarifaConsultorBase;
      acrescimoSocioAplicado = false;
      percentualAcrescimoSocio = 0;
    } else {
      // Incide acréscimo de 6% para compensar emissão de Nota Fiscal
      tarifaConsultorFinal = Math.round(tarifaConsultorBase * 1.06 * 100) / 100;
      acrescimoSocioAplicado = true;
      percentualAcrescimoSocio = 6.0;
    }
  }

  const totalCustoConsultor = tarifaConsultorFinal != null && horasNum > 0
    ? Math.round(tarifaConsultorFinal * horasNum * 100) / 100
    : null;

  return {
    contratoCodigo: contratoInfo.codigo,
    contratoNome: contratoInfo.nome,
    ehContratoTabelado: true,
    valorHoraCliente,
    valorDiaCliente,
    totalFaturar,
    ehSocio,
    ehComissao,
    tarifaConsultorBase,
    acrescimoSocioAplicado,
    percentualAcrescimoSocio,
    tarifaConsultorFinal,
    totalCustoConsultor,
    detalhes: {
      regraAplicada: `${contratoInfo.nome} (${anoStr}) - Perfil ${perfilNorm} - Região ${isLatam ? "LATAM" : "BRASIL"}`,
      excecaoComissaoAtiva: ehComissao,
      observacao: ehSocio
        ? ehComissao
          ? "Sócio: tarifa base sem acréscimo (Atividade classificada como COMISSÃO)."
          : "Sócio: tarifa base com acréscimo de +6% (compensação NF)."
        : "Consultor Parceiro: tarifa de tabela padrão sem retenção de sócio.",
    },
  };
}
