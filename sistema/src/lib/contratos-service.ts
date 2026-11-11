import fs from "fs";
import path from "path";
import {
  ContratoCompleto,
  SituacaoContratual,
  SeveridadeAlerta,
} from "./contratos-types";
import { formatarDataBR, formatarDataHoraBR } from "./date-utils";

const DATA_FILE = path.join(process.cwd(), "src/lib/contratos-base.json");

/**
 * Retorna a data atual ajustada para o fuso horário America/Sao_Paulo (YYYY-MM-DD)
 */
export function obterHojeBrasil(): string {
  const agora = new Date();
  const formatador = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatador.format(agora); // YYYY-MM-DD
}

/**
 * Calcula a diferença em dias entre duas datas (YYYY-MM-DD)
 */
export function calcularDiferencaDias(dataFimStr: string, dataInicioStr?: string): number {
  const ref = dataInicioStr ? new Date(`${dataInicioStr}T00:00:00-03:00`) : new Date(`${obterHojeBrasil()}T00:00:00-03:00`);
  const fim = new Date(`${dataFimStr}T00:00:00-03:00`);
  const diffMs = fim.getTime() - ref.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Gera sementes de contratos para testes reais (Porsche Brasil Contratos A e B)
 */
export function gerarContratosIniciais(): ContratoCompleto[] {
  return [
    {
      id: "CTR-2025-PORSCHE-001",
      codigo: "CTR-PORSCHE-TREINAMENTO",
      numeroContrato: {
        valor: "POR-NNOS-2025/082",
        paginaOrigem: 1,
        clausulaOrigem: "Preâmbulo / Cláusula 1ª",
        confianca: 0.98,
      },
      cliente: {
        valor: "Porsche Brasil",
        paginaOrigem: 1,
        clausulaOrigem: "Qualificação das Partes",
        confianca: 1.0,
      },
      razaoSocialContratada: {
        valor: "NNÓS Consultoria e Treinamento Ltda",
        paginaOrigem: 1,
        clausulaOrigem: "Qualificação das Partes",
        confianca: 1.0,
      },
      cnpjCliente: {
        valor: "00.370.470/0001-08",
        paginaOrigem: 1,
        clausulaOrigem: "Qualificação das Partes",
        confianca: 0.95,
      },
      cnpjContratada: {
        valor: "36.443.716/0001-00",
        paginaOrigem: 1,
        clausulaOrigem: "Qualificação das Partes",
        confianca: 1.0,
      },
      projeto: {
        valor: "Treinamento e Consultoria Porsche",
        paginaOrigem: 2,
        clausulaOrigem: "Cláusula 1ª - Do Objeto",
        confianca: 0.95,
      },
      objeto: {
        valor:
          "Prestação de serviços especializados de consultoria técnica, facilitação de workshops e treinamentos corporativos de capacitação para a rede Porsche Brasil.",
        paginaOrigem: 2,
        clausulaOrigem: "Cláusula 1ª - Do Objeto",
        confianca: 0.97,
      },
      responsavelInterno: {
        valor: "Leonardo Campos",
        paginaOrigem: 12,
        clausulaOrigem: "Cláusula 14ª - Dos Gestores do Contrato",
        confianca: 0.9,
      },
      responsavelCliente: {
        valor: "Gerência de Treinamento Porsche",
        paginaOrigem: 12,
        clausulaOrigem: "Cláusula 14ª - Dos Gestores do Contrato",
        confianca: 0.9,
      },
      tipoContrato: {
        valor: "Prestação de Serviços Especializados",
        paginaOrigem: 1,
        clausulaOrigem: "Epígrafe",
        confianca: 0.95,
      },
      situacaoAssinatura: {
        valor: "ASSINADO",
        paginaOrigem: 14,
        clausulaOrigem: "Termo de Encerramento e Assinaturas",
        confianca: 1.0,
      },

      // Vigência
      dataAssinatura: {
        valor: "2025-02-28",
        paginaOrigem: 14,
        clausulaOrigem: "Datação Final",
        confianca: 0.98,
      },
      dataInicio: {
        valor: "2025-02-28",
        paginaOrigem: 3,
        clausulaOrigem: "Cláusula 3ª - Da Vigência (Item 3.1)",
        confianca: 0.95,
      },
      dataEncerramento: {
        valor: "2027-02-27",
        paginaOrigem: 3,
        clausulaOrigem: "Cláusula 3ª - Da Vigência (Item 3.2)",
        confianca: 0.88,
      },
      dataEncerramentoOficial: "2027-02-27",
      prazoMeses: {
        valor: 24,
        paginaOrigem: 3,
        clausulaOrigem: "Cláusula 3ª - Prazo Contratual",
        confianca: 0.99,
      },
      possibilidadeRenovacao: {
        valor: true,
        paginaOrigem: 4,
        clausulaOrigem: "Cláusula 3ª - Prorrogação mediante termo aditivo",
        confianca: 0.95,
      },
      condicoesProrrogacao: {
        valor: "Mediante celebração prévia de termo aditivo com manifestação expressa com até 60 dias de antecedência.",
        paginaOrigem: 4,
        clausulaOrigem: "Cláusula 3.3",
        confianca: 0.95,
      },
      avisoPrevioDias: {
        valor: 60,
        paginaOrigem: 5,
        clausulaOrigem: "Cláusula 7ª - Da Rescisão Sem Justa Causa",
        confianca: 0.95,
      },
      condicoesRescisao: {
        valor: "Rescisão motivada por descumprimento contratual imediata; rescisão imotivada mediante aviso prévio de 60 dias sem penalidades financeiras.",
        paginaOrigem: 5,
        clausulaOrigem: "Cláusula 7ª",
        confianca: 0.9,
      },
      renovacaoAutomatica: {
        valor: false,
        paginaOrigem: 4,
        clausulaOrigem: "Cláusula 3.4 - Vedada renovação tácita",
        confianca: 0.98,
      },

      // Financeiro
      valorGlobal: {
        valor: 721200.0,
        paginaOrigem: 6,
        clausulaOrigem: "Cláusula 5ª - Do Preço Global Estimado",
        confianca: 1.0,
      },
      valorMensalFixo: {
        valor: null, // Não possui mensalidade fixa garantida - é por demanda
        paginaOrigem: 6,
        clausulaOrigem: "Cláusula 5ª - Do Faturamento por Demanda Realizada",
        confianca: 1.0,
      },
      valorAnualEstimado: {
        valor: 360600.0,
        paginaOrigem: 6,
        clausulaOrigem: "Estimativa Anual Pro-Rata",
        confianca: 0.95,
      },
      modalidadeCobranca: {
        valor: "DEMANDA_SERVICOS",
        paginaOrigem: 6,
        clausulaOrigem: "Cláusula 5.2 - Medição Mensal por Atividades Executadas",
        confianca: 1.0,
      },
      periodicidadeFaturamento: {
        valor: "Mensal, conforme horas e turmas atestadas em Boletim de Medição",
        paginaOrigem: 7,
        clausulaOrigem: "Cláusula 6ª - Do Faturamento e BM",
        confianca: 0.95,
      },
      condicoesPagamento: {
        valor: "30 dias fora a dezena após aprovação do BM e emissão da NFSe",
        paginaOrigem: 7,
        clausulaOrigem: "Cláusula 6.3 - Condições de Liquidação",
        confianca: 0.95,
      },
      indiceReajuste: {
        valor: "IPCA / IBGE",
        paginaOrigem: 8,
        clausulaOrigem: "Cláusula 8ª - Do Reajuste Anual",
        confianca: 0.98,
      },
      dataBaseReajuste: {
        valor: "Fevereiro (a cada 12 meses de vigência)",
        paginaOrigem: 8,
        clausulaOrigem: "Cláusula 8.2",
        confianca: 0.95,
      },
      regrasAtualizacaoPrecos: {
        valor: "Aplicação da variação acumulada do IPCA no período de 12 meses ou índice oficial que venha a substituí-lo.",
        paginaOrigem: 8,
        clausulaOrigem: "Cláusula 8ª",
        confianca: 0.95,
      },
      multasPenalidades: {
        valor: "Multa moratória de 2% e juros de 1% ao mês por atraso injustificado.",
        paginaOrigem: 9,
        clausulaOrigem: "Cláusula 10ª - Das Penalidades",
        confianca: 0.9,
      },
      composicaoPerfis: [
        {
          perfil: "Consultor Sênior / Instrutor Técnico",
          valorMensal: 30050.0,
          observacao: "Média mensal estimada sobre o valor global (faturamento conforme turmas realizadas)",
        },
      ],

      // Jurídico e Operacional
      obrigacoesPrincipais: {
        valor: "Manter equipe qualificada, respeitar cronograma de treinamentos e emitir relatórios de avaliação após cada módulo.",
        paginaOrigem: 4,
        clausulaOrigem: "Cláusula 4ª - Das Obrigações da Contratada",
        confianca: 0.95,
      },
      clausulaConfidencialidade: {
        valor: true,
        paginaOrigem: 10,
        clausulaOrigem: "Cláusula 12ª - Do Sigilo e LGPD",
        confianca: 1.0,
      },
      condicoesExclusividade: {
        valor: "Não exclusiva. A contratada pode prestar serviços a outras montadoras, resguardado sigilo sobre informações estratégicas.",
        paginaOrigem: 11,
        clausulaOrigem: "Cláusula 13ª",
        confianca: 0.92,
      },
      permiteSubcontratacao: {
        valor: true,
        paginaOrigem: 4,
        clausulaOrigem: "Cláusula 4.4 - Autorizada subcontratação de consultores parceiros homologados",
        confianca: 0.95,
      },
      responsabilidadesEspecificas: {
        valor: "Fornecimento de apostilas digitais e suporte técnico aos participantes da rede autorizada.",
        paginaOrigem: 3,
        clausulaOrigem: "Anexo I - Escopo Técnico",
        confianca: 0.9,
      },
      riscosIdentificados: [
        {
          risco: "Faturamento variável: receita depende exclusivamente da demanda de turmas convocadas pelo cliente.",
          severidade: "MEDIO",
          clausula: "Cláusula 5.2",
        },
      ],
      anexos: ["Anexo I - Escopo Técnico de Treinamentos", "Anexo II - Tabela de Tarifas por Carga Horária"],

      // Gestão de Ciclo de Vida
      situacao: "VIGENTE",
      statusRenovacao: "NAO_INICIADA",
      inconsistencias: [
        {
          id: "INC-POR-001",
          tipo: "DIVERGENCIA_DATAS",
          titulo: "Divergência de Encerramento (Fevereiro × Março de 2027)",
          descricao:
            "Identificada possível divergência entre a cláusula de vigência (24 meses a partir de 28/02/2025 = encerramento em 27/02/2027) e a solicitação contratual formal que indica encerramento em março de 2027. Recomenda-se validação com o contratante.",
          clausulaA: "Cláusula 3ª - Prazo de 24 meses contados de 28/02/2025",
          paginaA: 3,
          clausulaB: "Solicitação Contratual / Cronograma Anexo III (Março/2027)",
          paginaB: 15,
          resolvida: false,
        },
      ],
      aditivos: [],
      alertas: [],
      arquivoPdfNome: "Contrato_Porsche_Brasil_Treinamento_2025.pdf",
      origemExtracao: "IA_GEMINI",
      criadoEm: "2025-02-28T10:00:00-03:00",
      atualizadoEm: "2026-11-10T10:00:00-03:00",
      criadoPor: "Leonardo Campos",
      aprovadoPor: "Leonardo Campos",
      aprovadoEm: "2025-02-28T14:30:00-03:00",
    },
    {
      id: "CTR-2026-PORSCHE-002",
      codigo: "CTR-PORSCHE-POS-VENDAS-POE",
      numeroContrato: {
        valor: "POR-POE-2026/014",
        paginaOrigem: 1,
        clausulaOrigem: "Preâmbulo",
        confianca: 0.99,
      },
      cliente: {
        valor: "Porsche Brasil",
        paginaOrigem: 1,
        clausulaOrigem: "Qualificação das Partes",
        confianca: 1.0,
      },
      razaoSocialContratada: {
        valor: "NNÓS Consultoria e Treinamento Ltda",
        paginaOrigem: 1,
        clausulaOrigem: "Qualificação das Partes",
        confianca: 1.0,
      },
      cnpjCliente: {
        valor: "00.370.470/0001-08",
        paginaOrigem: 1,
        clausulaOrigem: "Qualificação das Partes",
        confianca: 0.95,
      },
      cnpjContratada: {
        valor: "36.443.716/0001-00",
        paginaOrigem: 1,
        clausulaOrigem: "Qualificação das Partes",
        confianca: 1.0,
      },
      projeto: {
        valor: "Consultoria Pós-Vendas POE",
        paginaOrigem: 1,
        clausulaOrigem: "Cláusula 1ª - Do Objeto",
        confianca: 1.0,
      },
      objeto: {
        valor:
          "Prestação de serviços contínuos de consultoria operacional, auditoria de pós-vendas e suporte administrativo ao programa Porsche Operational Excellence (POE).",
        paginaOrigem: 2,
        clausulaOrigem: "Cláusula 1ª",
        confianca: 0.98,
      },
      responsavelInterno: {
        valor: "Leonardo Campos",
        paginaOrigem: 10,
        clausulaOrigem: "Cláusula 12ª - Da Gestão Contratual",
        confianca: 0.95,
      },
      responsavelCliente: {
        valor: "Diretoria de Pós-Vendas Porsche",
        paginaOrigem: 10,
        clausulaOrigem: "Cláusula 12ª",
        confianca: 0.9,
      },
      tipoContrato: {
        valor: "Prestação de Serviços com Mensalidade Fixa",
        paginaOrigem: 1,
        clausulaOrigem: "Epígrafe",
        confianca: 0.98,
      },
      situacaoAssinatura: {
        valor: "ASSINADO",
        paginaOrigem: 12,
        clausulaOrigem: "Folha de Assinaturas",
        confianca: 1.0,
      },

      // Vigência
      dataAssinatura: {
        valor: "2026-04-14",
        paginaOrigem: 12,
        clausulaOrigem: "Data de Assinatura",
        confianca: 1.0,
      },
      dataInicio: {
        valor: "2026-04-14",
        paginaOrigem: 2,
        clausulaOrigem: "Cláusula 2ª - Início dos Serviços",
        confianca: 1.0,
      },
      dataEncerramento: {
        valor: "2028-04-13",
        paginaOrigem: 2,
        clausulaOrigem: "Cláusula 2ª - Prazo de 24 meses",
        confianca: 1.0,
      },
      dataEncerramentoOficial: "2028-04-13",
      prazoMeses: {
        valor: 24,
        paginaOrigem: 2,
        clausulaOrigem: "Cláusula 2.1",
        confianca: 1.0,
      },
      possibilidadeRenovacao: {
        valor: true,
        paginaOrigem: 3,
        clausulaOrigem: "Cláusula 2.3",
        confianca: 0.95,
      },
      condicoesProrrogacao: {
        valor: "Renovação por mútuo acordo mediante termo aditivo formalizado com antecedência mínima de 90 dias.",
        paginaOrigem: 3,
        clausulaOrigem: "Cláusula 2.3",
        confianca: 0.95,
      },
      avisoPrevioDias: {
        valor: 90,
        paginaOrigem: 6,
        clausulaOrigem: "Cláusula 9ª - Rescisão Imotivada",
        confianca: 0.98,
      },
      condicoesRescisao: {
        valor: "Aviso prévio obrigatório de 90 dias. Multa compensatória equivalente a 1 mensalidade caso desrespeitado o aviso prévio.",
        paginaOrigem: 6,
        clausulaOrigem: "Cláusula 9.2",
        confianca: 0.94,
      },
      renovacaoAutomatica: {
        valor: false,
        paginaOrigem: 3,
        clausulaOrigem: "Cláusula 2.4",
        confianca: 0.99,
      },

      // Financeiro
      valorGlobal: {
        valor: 974064.0,
        paginaOrigem: 4,
        clausulaOrigem: "Cláusula 4ª - Do Preço Total",
        confianca: 1.0,
      },
      valorMensalFixo: {
        valor: 40586.0,
        paginaOrigem: 4,
        clausulaOrigem: "Cláusula 4.1 - Da Remuneração Mensal Fixa",
        confianca: 1.0,
      },
      valorAnualEstimado: {
        valor: 487032.0,
        paginaOrigem: 4,
        clausulaOrigem: "Cálculo 12 parcelas mensais",
        confianca: 1.0,
      },
      modalidadeCobranca: {
        valor: "MENSAL_FIXO",
        paginaOrigem: 4,
        clausulaOrigem: "Cláusula 4.1",
        confianca: 1.0,
      },
      periodicidadeFaturamento: {
        valor: "Mensal e recorrente",
        paginaOrigem: 4,
        clausulaOrigem: "Cláusula 4.2",
        confianca: 1.0,
      },
      condicoesPagamento: {
        valor: "Todo dia 25 do mês subsequente à prestação dos serviços",
        paginaOrigem: 5,
        clausulaOrigem: "Cláusula 5ª",
        confianca: 0.95,
      },
      indiceReajuste: {
        valor: "IPCA / IBGE",
        paginaOrigem: 5,
        clausulaOrigem: "Cláusula 6ª - Do Reajuste",
        confianca: 0.98,
      },
      dataBaseReajuste: {
        valor: "Abril (anual)",
        paginaOrigem: 5,
        clausulaOrigem: "Cláusula 6.1",
        confianca: 0.95,
      },
      regrasAtualizacaoPrecos: {
        valor: "Reajuste anual pelo índice oficial acumulado nos 12 meses anteriores.",
        paginaOrigem: 5,
        clausulaOrigem: "Cláusula 6.2",
        confianca: 0.95,
      },
      multasPenalidades: {
        valor: "Multa de 2% e juros de 1% a.m. por inadimplemento.",
        paginaOrigem: 7,
        clausulaOrigem: "Cláusula 11ª",
        confianca: 0.9,
      },
      composicaoPerfis: [
        {
          perfil: "Consultor Especialista Pós-Vendas",
          quantidade: 1,
          valorMensal: 26800.0,
          observacao: "Dedicação integral ao programa POE",
        },
        {
          perfil: "Assistente Administrativo / Operações",
          quantidade: 1,
          valorMensal: 13786.0,
          observacao: "Suporte aos relatórios e auditorias",
        },
      ],

      // Jurídico e Operacional
      obrigacoesPrincipais: {
        valor: "Auditoria in loco em concessionárias Porsche, análise de processos de garantia e suporte ao portal POE.",
        paginaOrigem: 2,
        clausulaOrigem: "Cláusula 1ª e Anexo I",
        confianca: 0.98,
      },
      clausulaConfidencialidade: {
        valor: true,
        paginaOrigem: 8,
        clausulaOrigem: "Cláusula 13ª - Do Sigilo Profissional e LGPD",
        confianca: 1.0,
      },
      condicoesExclusividade: {
        valor: "Exclusividade de equipe alocada: profissionais dedicados não podem atuar simultaneamente em concorrentes diretos de luxo.",
        paginaOrigem: 9,
        clausulaOrigem: "Cláusula 14ª",
        confianca: 0.94,
      },
      permiteSubcontratacao: {
        valor: false,
        paginaOrigem: 3,
        clausulaOrigem: "Cláusula 3.2 - Vedada subcontratação sem anuência formal",
        confianca: 0.96,
      },
      responsabilidadesEspecificas: {
        valor: "Apresentação de relatório executivo mensal de conformidade à diretoria de pós-vendas.",
        paginaOrigem: 3,
        clausulaOrigem: "Cláusula 3.5",
        confianca: 0.9,
      },
      riscosIdentificados: [
        {
          risco: "Vedação à subcontratação exige alocação direta de profissionais cadastrados.",
          severidade: "BAIXO",
          clausula: "Cláusula 3.2",
        },
      ],
      anexos: ["Anexo I - Escopo POE 2026/2028", "Anexo II - Acordo de Nível de Serviço (SLA)"],

      // Gestão de Ciclo de Vida
      situacao: "VIGENTE",
      statusRenovacao: "NAO_INICIADA",
      inconsistencias: [],
      aditivos: [],
      alertas: [],
      arquivoPdfNome: "Contrato_Porsche_Brasil_Pos_Vendas_POE_2026.pdf",
      origemExtracao: "IA_GEMINI",
      criadoEm: "2026-04-14T09:00:00-03:00",
      atualizadoEm: "2026-11-10T10:00:00-03:00",
      criadoPor: "Leonardo Campos",
      aprovadoPor: "Leonardo Campos",
      aprovadoEm: "2026-04-14T11:00:00-03:00",
    },
  ];
}

/**
 * Lê o arquivo JSON com persistência atômica e garante que os contratos existam.
 */
export function carregarContratos(): ContratoCompleto[] {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      const iniciais = gerarContratosIniciais();
      salvarContratos(iniciais);
      return processarSituacaoEAlertas(iniciais);
    }
    const conteudo = fs.readFileSync(DATA_FILE, "utf-8");
    const lista: ContratoCompleto[] = JSON.parse(conteudo);
    if (!Array.isArray(lista) || lista.length === 0) {
      const iniciais = gerarContratosIniciais();
      salvarContratos(iniciais);
      return processarSituacaoEAlertas(iniciais);
    }
    return processarSituacaoEAlertas(lista);
  } catch (err) {
    console.warn("Erro ao carregar contratos:", err);
    return processarSituacaoEAlertas(gerarContratosIniciais());
  }
}

/**
 * Salva a lista de contratos no arquivo JSON.
 */
export function salvarContratos(lista: ContratoCompleto[]): void {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(lista, null, 2), "utf-8");
  } catch (err) {
    console.error("Erro ao salvar contratos-base.json:", err);
    throw err;
  }
}

/**
 * Identifica e sinaliza possível duplicidade de contratos cadastrados para o mesmo cliente
 * com vigência coincidente ou mesmo projeto/objeto.
 */
export function identificarDuplicidades(contratos: ContratoCompleto[]): ContratoCompleto[] {
  return contratos.map((c, i) => {
    const cli = String(c.cliente?.valor || "").trim().toLowerCase();
    const ini = String(c.dataInicio?.valor || "");
    const proj = String(c.projeto?.valor || "").trim().toLowerCase();
    const num = String(c.numeroContrato?.valor || "").trim().toLowerCase();

    const outro = contratos.find((o, j) => {
      if (i === j) return false;
      const oCli = String(o.cliente?.valor || "").trim().toLowerCase();
      if (!cli || !oCli || cli !== oCli) return false;

      const oIni = String(o.dataInicio?.valor || "");
      const oProj = String(o.projeto?.valor || "").trim().toLowerCase();
      const oNum = String(o.numeroContrato?.valor || "").trim().toLowerCase();

      // Mesma data de início
      const mesmaDataInicio = ini && oIni && ini === oIni;
      // Número idêntico ou muito similar
      const mesmoNumero = num && oNum && (num === oNum || num.includes(oNum) || oNum.includes(num));
      // Projeto com palavras-chave coincidentes
      const palavrasC = proj.split(/\s+/).filter((w) => w.length > 4);
      const coincideProjeto = palavrasC.some((w) => oProj.includes(w));

      return mesmaDataInicio || mesmoNumero || (coincideProjeto && mesmaDataInicio);
    });

    if (outro) {
      return {
        ...c,
        possivelDuplicidade: true,
        contratoDuplicadoRef: String(outro.numeroContrato?.valor || outro.codigo),
        motivoDuplicidade: `Identificado contrato similar (${outro.numeroContrato?.valor || outro.codigo}) para o mesmo cliente com vigência a partir de ${formatarDataBR(ini)}.`,
      };
    }

    return {
      ...c,
      possivelDuplicidade: false,
      contratoDuplicadoRef: undefined,
      motivoDuplicidade: undefined,
    };
  });
}

/**
 * Processa dinamicamente a situação e os alertas de cada contrato com base na data de encerramento
 * e na regra obrigatória dos 90, 60, 30, 15 e 0 dias.
 */
export function processarSituacaoEAlertas(contratos: ContratoCompleto[]): ContratoCompleto[] {
  const contratosComDuplicidade = identificarDuplicidades(contratos);
  const hoje = obterHojeBrasil();

  return contratosComDuplicidade.map((c) => {
    const dataFimStr = c.dataEncerramentoOficial || String(c.dataEncerramento.valor || "");
    if (!dataFimStr) return c;

    const diasRestantes = calcularDiferencaDias(dataFimStr, hoje);

    // Determina a Situação Contratual
    let novaSituacao: SituacaoContratual = c.situacao;
    if (c.situacao !== "ENCERRADO" && c.situacao !== "RESCINDIDO" && c.situacao !== "RENOVADO") {
      if (diasRestantes < 0) {
        novaSituacao = "VENCIDO";
      } else if (diasRestantes <= 90) {
        novaSituacao = "VENCIMENTO_PROXIMO";
      } else {
        novaSituacao = "VIGENTE";
      }
    }

    // Calcula os Alertas do Ciclo de Vida (não gera alerta se já rescindido ou encerrado)
    const alertasAtualizados = [...(c.alertas || [])];

    if (novaSituacao !== "ENCERRADO" && novaSituacao !== "RESCINDIDO") {
      // Marcos oficiais: 90, 60, 30, 15, 0 dias
      const marcos: Array<{
        diasMax: number;
        diasMin: number;
        classificacao: SeveridadeAlerta;
        acao: string;
      }> = [
        {
          diasMax: 90,
          diasMin: 61,
          classificacao: "ATENCAO",
          acao: "Iniciar negociação de renovação",
        },
        {
          diasMax: 60,
          diasMin: 31,
          classificacao: "PRIORIDADE",
          acao: "Acompanhar negociação com cliente",
        },
        {
          diasMax: 30,
          diasMin: 16,
          classificacao: "CRITICO",
          acao: "Solicitar definição sobre renovação",
        },
        {
          diasMax: 15,
          diasMin: 1,
          classificacao: "URGENTE",
          acao: "Escalonar para responsável",
        },
        {
          diasMax: 0,
          diasMin: -9999,
          classificacao: "VENCIMENTO",
          acao: "Informar encerramento da vigência",
        },
      ];

      for (const marco of marcos) {
        if (diasRestantes <= marco.diasMax && diasRestantes >= marco.diasMin) {
          const jaExiste = alertasAtualizados.some(
            (a) => a.classificacao === marco.classificacao
          );
          if (!jaExiste) {
            alertasAtualizados.push({
              id: `ALT-${c.id}-${marco.classificacao}`,
              contratoId: c.id,
              contratoNumero: String(c.numeroContrato.valor || c.codigo),
              cliente: String(c.cliente.valor || "Cliente"),
              projeto: String(c.projeto.valor || "Projeto"),
              diasRestantes,
              dataAlerta: hoje,
              classificacao: marco.classificacao,
              acaoRecomendada: marco.acao,
              status: "PENDENTE",
              destinatario: String(c.responsavelInterno.valor || "Diretoria"),
              responsavel: String(c.responsavelInterno.valor || "Leonardo Campos"),
              historicoAcoes: [
                {
                  data: formatarDataHoraBR(new Date().toISOString()),
                  usuario: "Sistema Automático NNÓS",
                  acao: `Alerta de ${marco.classificacao} disparado (${diasRestantes} dias restantes).`,
                },
              ],
            });
          }
        }
      }
    }

    return {
      ...c,
      situacao: novaSituacao,
      alertas: alertasAtualizados,
    };
  });
}

/**
 * Indicadores Executivos Agregados para o Dashboard
 */
export function calcularMetricasDashboard(contratos: ContratoCompleto[]) {
  const hoje = obterHojeBrasil();

  const total = contratos.length;
  let vigentes = 0;
  let vencidos = 0;
  let vencimentoProximo = 0;
  let renovados = 0;
  let encerrados = 0;

  let valorGlobalCarteira = 0;
  let receitaMensalRecorrenteMRR = 0; // Somente MENSAL_FIXO e parcelas fixas, NUNCA demanda pura!
  let receitaAnualEstimada = 0;
  let contratosComPendencias = 0;

  contratos.forEach((c) => {
    const dataFim = c.dataEncerramentoOficial || String(c.dataEncerramento.valor || "");
    const dias = calcularDiferencaDias(dataFim, hoje);

    if (c.situacao === "VIGENTE") vigentes++;
    else if (c.situacao === "VENCIDO" || (c.situacao !== "ENCERRADO" && dias < 0)) vencidos++;
    else if (c.situacao === "VENCIMENTO_PROXIMO" || (dias >= 0 && dias <= 90)) vencimentoProximo++;
    else if (c.situacao === "RENOVADO") renovados++;
    else if (c.situacao === "ENCERRADO") encerrados++;

    const valGlobal = Number(c.valorGlobal.valor) || 0;
    valorGlobalCarteira += valGlobal;

    const modalidade = c.modalidadeCobranca.valor;
    const valMensal = Number(c.valorMensalFixo.valor) || 0;

    // Regra Obrigatória: Não considerar contratos por demanda como receita mensal fixa recorrente!
    if (modalidade === "MENSAL_FIXO" && valMensal > 0) {
      receitaMensalRecorrenteMRR += valMensal;
    }

    const valAnual = Number(c.valorAnualEstimado.valor) || (valMensal > 0 ? valMensal * 12 : valGlobal / 2);
    receitaAnualEstimada += valAnual;

    const temInconsistenciaNaoResolvida = (c.inconsistencias || []).some((i) => !i.resolvida);
    const temAlertaCritico = (c.alertas || []).some((a) => a.status === "PENDENTE" && (a.classificacao === "CRITICO" || a.classificacao === "URGENTE"));
    if (temInconsistenciaNaoResolvida || temAlertaCritico) {
      contratosComPendencias++;
    }
  });

  return {
    total,
    vigentes,
    vencidos,
    vencimentoProximo,
    renovados,
    encerrados,
    valorGlobalCarteira,
    receitaMensalRecorrenteMRR,
    receitaAnualEstimada,
    contratosComPendencias,
  };
}

