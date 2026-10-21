export type CategoriaLogistica = "AEREO" | "HOTEL" | "CARRO" | "SEGURO";

export type StatusViagem =
  | "AGUARDANDO_COTACAO"
  | "EM_COTACAO"
  | "AGUARDANDO_APROVACAO"
  | "APROVADO_AGUARDANDO_COMPRA"
  | "AGUARDANDO_REAPROVACAO"
  | "EM_CONTRATACAO"
  | "VOUCHERS_PENDENTES"
  | "VOUCHERS_ENVIADOS"
  | "AGUARDANDO_PRESTACAO_CONTAS"
  | "CONCLUIDO"
  | "CANCELADO";

export interface AnexoDocumento {
  id: string;
  nome: string;
  tipo: "ORCAMENTO" | "PROPOSTA" | "VOUCHER";
  url: string; // Base64 Data URL ou Link HTTP
  mimeType: string;
  tamanhoFormatado: string;
  criadoEm: string;
}

export interface AlternativaCotacao {
  id: string;
  alternativaNumero: 1 | 2 | 3;
  fornecedor: string;
  descricao: string;
  valor: number;
  dataCotacao: string;
  selecionada: boolean;
  observacoes?: string;
  anexos: AnexoDocumento[];
  // Dados de contratação pela agência
  valorContratado?: number;
  localizadorOuReserva?: string;
  vouchersDefinitivos?: AnexoDocumento[];
  contratadoEm?: string;
  observacoesContratacao?: string;
}

export interface CategoriaCotacoes {
  categoria: CategoriaLogistica;
  nomeExibicao: string;
  icone: string;
  necessaria: boolean;
  alternativas: AlternativaCotacao[];
  alternativaAprovadaId?: string;
}

export interface AuditoriaEvento {
  id: string;
  dataHora: string;
  perfilUsuario: "AGENCIA" | "LIDER" | "FINANCEIRO";
  usuarioNome: string;
  acao: string;
  detalhes?: string;
  valorAnterior?: number;
  novoValor?: number;
}

export interface ViagemSolicitacao {
  id: string; // Ex: sol-{lancamentoId}
  lancamentoId: string;
  viagemId?: string;
  projeto: string;
  atividade: string;
  consultor: string;
  consultorEmail?: string;
  perfilConsultor?: string;
  origem: string;
  destino: string;
  dataInicial: string;
  dataFinal: string;
  horas?: number;
  status: StatusViagem;
  agenciaNome: string;
  necessidades: {
    aereo: boolean;
    hotel: boolean;
    carro: boolean;
    seguro: boolean;
  };
  observacoesSolicitante: string;
  categorias: CategoriaCotacoes[];
  
  // Totais orçamentários e financeiros
  totalCotado: number;
  totalAprovado: number;
  totalContratado: number;
  custoAlimentacaoDiaria: number; // Gerido exclusivamente pelo Financeiro
  totalRealizado: number; // Contratado + Diárias
  
  // Reaprovação e divergências
  requerReaprovacao: boolean;
  motivoReaprovacao?: string;
  diferencaValor: number;

  // Aprovação
  aprovadoPor?: string;
  aprovadoEm?: string;
  justificativasLider?: Record<string, string>;

  // Vouchers e e-mail
  vouchersEnviadosEm?: string;
  destinatariosEnvio?: string[];

  // Prestação de contas
  prestacaoContasConcluidaEm?: string;
  prestacaoContasObservacao?: string;

  auditoria: AuditoriaEvento[];
  criadoEm: string;
  atualizadoEm: string;
}
