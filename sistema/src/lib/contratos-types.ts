/**
 * Tipos e Interfaces para o Módulo de Gestão de Contratos da NNÓS
 * Suporta ciclo de vida contratual, extração por IA, rastreabilidade de cláusulas,
 * inconsistências, linha do tempo (Gantt) e sistema de alertas de 90 dias.
 */

export type SituacaoContratual =
  | "VIGENTE"
  | "VENCIMENTO_PROXIMO"
  | "VENCIDO"
  | "RENOVADO"
  | "ENCERRADO"
  | "RESCINDIDO"
  | "EM_APROVACAO";

export type ModalidadeCobranca =
  | "MENSAL_FIXO"
  | "DEMANDA_SERVICOS"
  | "HIBRIDO"
  | "HORA_HOMEM"
  | "VALOR_GLOBAL_PARCELADO";

export type StatusRenovacao =
  | "NAO_INICIADA"
  | "EM_NEGOCIACAO"
  | "PROPOSTA_ENVIADA"
  | "AGUARDANDO_APROVACAO"
  | "RENOVADO"
  | "NAO_RENOVADO";

export type SeveridadeAlerta =
  | "ATENCAO"    // 90 dias
  | "PRIORIDADE" // 60 dias
  | "CRITICO"    // 30 dias
  | "URGENTE"    // 15 dias
  | "VENCIMENTO" // 0 dia
  | "DIVERGENCIA"; // Inconsistência contratual

export interface CampoRastreado<T = string | number | boolean | null> {
  valor: T;
  paginaOrigem?: number | string;
  clausulaOrigem?: string;
  confianca?: number; // 0 a 1
  naoLocalizado?: boolean;
}

export interface ComposicaoPerfilItem {
  perfil: string;
  quantidade?: number;
  valorMensal: number;
  valorHora?: number;
  observacao?: string;
}

export interface InconsistenciaContratual {
  id: string;
  tipo: "DIVERGENCIA_DATAS" | "DIVERGENCIA_VALORES" | "REAJUSTE_SEM_INDICE" | "CAMPO_AUSENTE" | "RISCO_JURIDICO";
  titulo: string;
  descricao: string;
  clausulaA?: string;
  paginaA?: number;
  clausulaB?: string;
  paginaB?: number;
  resolvida: boolean;
  resolucaoNota?: string;
  validadoPor?: string;
  validadoEm?: string;
}

export interface AlertaContratual {
  id: string;
  contratoId: string;
  contratoNumero: string;
  cliente: string;
  projeto: string;
  diasRestantes: number;
  dataAlerta: string;
  classificacao: SeveridadeAlerta;
  acaoRecomendada: string;
  status: "PENDENTE" | "VISUALIZADO" | "EM_TRATAMENTO" | "CONCLUIDO";
  destinatario: string;
  responsavel?: string;
  observacoes?: string;
  dataResolucao?: string;
  historicoAcoes?: Array<{
    data: string;
    usuario: string;
    acao: string;
    nota?: string;
  }>;
}

export interface AditivoContratual {
  id: string;
  contratoId: string;
  numeroAditivo: string;
  dataAssinatura: string;
  dataInicioVigencia: string;
  novaDataEncerramento?: string;
  objeto: string;
  valorAcrescimo?: number;
  novoValorGlobal?: number;
  novoValorMensal?: number;
  arquivoUrl?: string;
  arquivoNome?: string;
  alteracoes: {
    vigencia?: { antes: string; depois: string };
    valorGlobal?: { antes: number; depois: number };
    valorMensal?: { antes: number; depois: number };
    escopo?: { antes: string; depois: string };
    outros?: string;
  };
  criadoEm: string;
  criadoPor: string;
}

export interface ContratoCompleto {
  id: string;
  codigo: string;
  numeroContrato: CampoRastreado<string>;
  cliente: CampoRastreado<string>;
  razaoSocialContratada: CampoRastreado<string>;
  cnpjCliente: CampoRastreado<string>;
  cnpjContratada: CampoRastreado<string>;
  projeto: CampoRastreado<string>;
  objeto: CampoRastreado<string>;
  responsavelInterno: CampoRastreado<string>;
  responsavelCliente: CampoRastreado<string>;
  tipoContrato: CampoRastreado<string>;
  situacaoAssinatura: CampoRastreado<"ASSINADO" | "EM_ASSINATURA" | "MINUTA" | "RENOVADO">;

  // Vigência
  dataAssinatura: CampoRastreado<string>; // YYYY-MM-DD
  dataInicio: CampoRastreado<string>;     // YYYY-MM-DD
  dataEncerramento: CampoRastreado<string>; // YYYY-MM-DD
  dataEncerramentoOficial?: string; // validada pelo usuário se houver divergência
  prazoMeses: CampoRastreado<number>;
  possibilidadeRenovacao: CampoRastreado<boolean>;
  condicoesProrrogacao: CampoRastreado<string>;
  avisoPrevioDias: CampoRastreado<number>;
  condicoesRescisao: CampoRastreado<string>;
  renovacaoAutomatica: CampoRastreado<boolean>;

  // Financeiro
  valorGlobal: CampoRastreado<number>;
  valorMensalFixo: CampoRastreado<number | null>;
  valorAnualEstimado: CampoRastreado<number>;
  modalidadeCobranca: CampoRastreado<ModalidadeCobranca>;
  periodicidadeFaturamento: CampoRastreado<string>;
  condicoesPagamento: CampoRastreado<string>;
  indiceReajuste: CampoRastreado<string>;
  dataBaseReajuste: CampoRastreado<string>;
  regrasAtualizacaoPrecos: CampoRastreado<string>;
  multasPenalidades: CampoRastreado<string>;
  composicaoPerfis: ComposicaoPerfilItem[];

  // Jurídico e Operacional
  obrigacoesPrincipais: CampoRastreado<string>;
  clausulaConfidencialidade: CampoRastreado<boolean>;
  condicoesExclusividade: CampoRastreado<string>;
  permiteSubcontratacao: CampoRastreado<boolean>;
  responsabilidadesEspecificas: CampoRastreado<string>;
  riscosIdentificados: Array<{
    risco: string;
    severidade: "BAIXO" | "MEDIO" | "ALTO";
    clausula?: string;
  }>;
  anexos: string[];

  // Gestão de Ciclo de Vida
  situacao: SituacaoContratual;
  statusRenovacao: StatusRenovacao;
  inconsistencias: InconsistenciaContratual[];
  aditivos: AditivoContratual[];
  alertas: AlertaContratual[];
  possivelDuplicidade?: boolean;
  contratoDuplicadoRef?: string;
  motivoDuplicidade?: string;
  arquivoPdfNome?: string;
  arquivoPdfUrl?: string;
  arquivoPdfTamanhoBytes?: number;

  // Metadados
  origemExtracao: "IA_GEMINI" | "MANUAL" | "OCR_LOCAL";
  criadoEm: string;
  atualizadoEm: string;
  criadoPor: string;
  aprovadoPor?: string;
  aprovadoEm?: string;
}

