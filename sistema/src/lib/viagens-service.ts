import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import {
  ViagemSolicitacao,
  StatusViagem,
  CategoriaCotacoes,
  AlternativaCotacao,
  AuditoriaEvento,
  CategoriaLogistica,
} from "./viagens-types";
import { dispararEmail } from "./email-service";
import { formatarDataBR, formatarPeriodoBR } from "./date-utils";
import { POLITICAS_VIAGEM } from "./politicas-viagem";

const DATA_FILE = path.join(process.cwd(), "src/lib/viagens-solicitacoes-base.json");

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export function carregarSolicitacoesArquivo(): ViagemSolicitacao[] {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, "utf8");
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn("Aviso ao ler viagens-solicitacoes-base.json:", err);
  }
  return [];
}

export function salvarSolicitacoesArquivo(lista: ViagemSolicitacao[]): void {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(lista, null, 2), "utf8");
  } catch (err) {
    console.error("Erro ao salvar viagens-solicitacoes-base.json:", err);
  }
}

/**
 * Inicializa ou sincroniza solicitações a partir dos lançamentos do Supabase
 */
export async function sincronizarSolicitacoesIniciais(competencia?: string): Promise<ViagemSolicitacao[]> {
  const db = getSupabase();
  const todosLancs: any[] = [];
  let pagina = 0;
  const TAMANHO_PAGINA = 1000;

  while (true) {
    let q = db
      .from("lancamentos")
      .select(
        "id, competencia, atividade, modalidade, local, regiao, data_inicial, data_final, perfil, repasse, precisa_logistica, status, " +
        "projetos(id, nome), consultores(id, nome), " +
        "viagens(id, agencia, custo_1, custo_2, custo_3, custo_4, custo_5, total, observacao_agencia)"
      )
      .range(pagina * TAMANHO_PAGINA, (pagina + 1) * TAMANHO_PAGINA - 1);

    if (competencia) {
      if (/^\d{4}$/.test(competencia)) {
        q = q.gte("competencia", `${competencia}-01-01`).lte("competencia", `${competencia}-12-31`);
      } else if (/^\d{4}-\d{2}$/.test(competencia)) {
        q = q.gte("competencia", `${competencia}-01`).lte("competencia", `${competencia}-31`);
      } else {
        q = q.eq("competencia", competencia);
      }
    }

    const { data: pageData, error } = await q;
    if (error) {
      console.error("Erro ao consultar página de lançamentos para logística:", error);
      break;
    }
    if (!pageData || pageData.length === 0) break;

    todosLancs.push(...pageData);
    if (pageData.length < TAMANHO_PAGINA) break;
    pagina++;
  }

  const lancs = todosLancs;
  if (lancs.length === 0) {
    return carregarSolicitacoesArquivo();
  }

  const existentes = carregarSolicitacoesArquivo();
  const mapaExistentes = new Map(existentes.map((s) => [s.lancamentoId, s]));

  let houveMudanca = false;

  for (const l of lancs as any[]) {
    const v = Array.isArray(l.viagens) ? l.viagens[0] : l.viagens;
    const temLogistica =
      l.precisa_logistica === true ||
      (v && (Number(v.total) > 0 || Number(v.custo_1) > 0 || Number(v.custo_2) > 0 || Number(v.custo_3) > 0 || Number(v.custo_4) > 0 || Number(v.custo_5) > 0));
    if (!temLogistica) continue;

    const solExistente = mapaExistentes.get(l.id);

    const custoAereo = v?.custo_1 || 0;
    const custoHotel = v?.custo_2 || 0;
    const custoCarro = v?.custo_3 || 0;
    const custoSeguro = v?.custo_4 || 0;
    const custoDiaria = v?.custo_5 || 0;
    const custoTotalContratado = custoAereo + custoHotel + custoCarro + custoSeguro;
    const custoTotalRealizado = v?.total || (custoTotalContratado + custoDiaria);

    const apenasAlimentacao = custoTotalContratado === 0 && custoDiaria > 0;
    const obsAgencia = v?.observacao_agencia || "";
    const obsUpper = obsAgencia.toUpperCase();
    const isLogisticaEmOutroPeriodo =
      obsUpper.includes("CONCENTRADA") ||
      obsUpper.includes("NÃO É REEMBOLSADA") ||
      obsUpper.includes("NAO E REEMBOLSADA");
    const temDemandaAgencia = !apenasAlimentacao && !isLogisticaEmOutroPeriodo && (l.precisa_logistica === true || custoTotalContratado > 0);

    if (!solExistente) {
      // Determina status inicial inteligente
      let statusInicial: StatusViagem = "AGUARDANDO_COTACAO";
      const isLancamentoCancelado = (l.status || "").toUpperCase().includes("CANCEL");

      if (isLancamentoCancelado) {
        // Regra de Negócio: quando o status da atividade for CANCELADO, definir como CONCLUÍDO para Viagens
        statusInicial = "CONCLUIDO";
      } else if (custoDiaria > 0 || isLogisticaEmOutroPeriodo) {
        // Se Alimentação / Diária já está preenchida (> 0), prestação de contas foi a última etapa e a viagem está finalizada
        statusInicial = "CONCLUIDO";
      } else if (custoTotalContratado > 0) {
        statusInicial = "VOUCHERS_ENVIADOS";
      }

      const precisaAereo = !isLancamentoCancelado && custoDiaria === 0 && (custoAereo > 0 || (temDemandaAgencia && custoTotalContratado === 0));
      const precisaHotel = !isLancamentoCancelado && custoDiaria === 0 && (custoHotel > 0 || (temDemandaAgencia && custoTotalContratado === 0));

      const categorias: CategoriaCotacoes[] = [
        {
          categoria: "AEREO",
          nomeExibicao: "Passagem Aérea",
          icone: "flight",
          necessaria: precisaAereo,
          alternativas: custoAereo > 0 ? [
            {
              id: `alt-aereo-${l.id}-1`,
              alternativaNumero: 1,
              fornecedor: v?.agencia || "Agência Fátima",
              descricao: "Voo emitido conforme itinerário",
              valor: custoAereo,
              valorContratado: custoAereo,
              dataCotacao: l.data_inicial || new Date().toISOString().split("T")[0],
              selecionada: true,
              anexos: [],
            }
          ] : [],
          alternativaAprovadaId: custoAereo > 0 ? `alt-aereo-${l.id}-1` : undefined,
        },
        {
          categoria: "HOTEL",
          nomeExibicao: "Hotel / Estadia",
          icone: "hotel",
          necessaria: precisaHotel,
          alternativas: custoHotel > 0 ? [
            {
              id: `alt-hotel-${l.id}-1`,
              alternativaNumero: 1,
              fornecedor: "Rede Conveniada",
              descricao: "Hospedagem faturada para o período",
              valor: custoHotel,
              valorContratado: custoHotel,
              dataCotacao: l.data_inicial || new Date().toISOString().split("T")[0],
              selecionada: true,
              anexos: [],
            }
          ] : [],
          alternativaAprovadaId: custoHotel > 0 ? `alt-hotel-${l.id}-1` : undefined,
        },
        {
          categoria: "CARRO",
          nomeExibicao: "Carro / Translado",
          icone: "directions_car",
          necessaria: !apenasAlimentacao && custoCarro > 0,
          alternativas: custoCarro > 0 ? [
            {
              id: `alt-carro-${l.id}-1`,
              alternativaNumero: 1,
              fornecedor: "Locadora Parceira",
              descricao: "Locação de veículo categoria intermediária",
              valor: custoCarro,
              valorContratado: custoCarro,
              dataCotacao: l.data_inicial || new Date().toISOString().split("T")[0],
              selecionada: true,
              anexos: [],
            }
          ] : [],
          alternativaAprovadaId: custoCarro > 0 ? `alt-carro-${l.id}-1` : undefined,
        },
        {
          categoria: "SEGURO",
          nomeExibicao: "Seguro / Outros",
          icone: "verified_user",
          necessaria: !apenasAlimentacao && custoSeguro > 0,
          alternativas: custoSeguro > 0 ? [
            {
              id: `alt-seguro-${l.id}-1`,
              alternativaNumero: 1,
              fornecedor: "Seguradora Corporativa",
              descricao: "Apólice internacional de viagem",
              valor: custoSeguro,
              valorContratado: custoSeguro,
              dataCotacao: l.data_inicial || new Date().toISOString().split("T")[0],
              selecionada: true,
              anexos: [],
            }
          ] : [],
          alternativaAprovadaId: custoSeguro > 0 ? `alt-seguro-${l.id}-1` : undefined,
        },
      ];

      const novaSolicitacao: ViagemSolicitacao = {
        id: `sol-${l.id}`,
        lancamentoId: l.id,
        viagemId: v?.id,
        projeto: l.projetos?.nome || "PROJETO NNÓS",
        atividade: l.atividade || "Atividade Operacional",
        consultor: l.consultores?.nome || "Consultor a definir",
        perfilConsultor: l.perfil || "SÊNIOR",
        origem: "Belo Horizonte - MG",
        destino: l.local || "Destino a definir",
        dataInicial: l.data_inicial || "",
        dataFinal: l.data_final || "",
        horas: l.horas,
        status: statusInicial,
        agenciaNome: v?.agencia || "FÁTIMA",
        necessidades: {
          aereo: precisaAereo,
          hotel: precisaHotel,
          carro: !apenasAlimentacao && custoCarro > 0,
          seguro: !apenasAlimentacao && custoSeguro > 0,
        },
        observacoesSolicitante: obsAgencia,
        categorias,
        totalCotado: custoTotalContratado,
        totalAprovado: custoTotalContratado,
        totalContratado: custoTotalContratado,
        custoAlimentacaoDiaria: custoDiaria,
        totalRealizado: custoTotalRealizado,
        requerReaprovacao: false,
        diferencaValor: 0,
        aprovadoPor: custoTotalContratado > 0 ? "Líder de Projeto" : undefined,
        aprovadoEm: custoTotalContratado > 0 ? l.data_inicial : undefined,
        auditoria: [
          {
            id: `aud-init-${l.id}`,
            dataHora: new Date().toISOString(),
            perfilUsuario: "LIDER",
            usuarioNome: "Sistema NNÓS",
            acao: "SOLICITACAO_CRIADA",
            detalhes: "Solicitação logística gerada automaticamente a partir da atividade",
          },
        ],
        criadoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString(),
      };

      mapaExistentes.set(l.id, novaSolicitacao);
      houveMudanca = true;
    } else {
      // Atualiza valores e dados mestres caso tenham sido alterados no Supabase (Print 2 e 3)
      let mudouItem = false;
      const nomeProj = l.projetos?.nome;
      if (nomeProj && solExistente.projeto !== nomeProj) {
        solExistente.projeto = nomeProj;
        mudouItem = true;
      }

      const nomeCons = l.consultores?.nome;
      if (nomeCons && solExistente.consultor !== nomeCons) {
        solExistente.consultor = nomeCons;
        mudouItem = true;
      }

      if (l.atividade && solExistente.atividade !== l.atividade) {
        solExistente.atividade = l.atividade;
        mudouItem = true;
      }

      if (l.perfil && solExistente.perfilConsultor !== l.perfil) {
        solExistente.perfilConsultor = l.perfil;
        mudouItem = true;
      }

      if (obsAgencia && solExistente.observacoesSolicitante !== obsAgencia) {
        solExistente.observacoesSolicitante = obsAgencia;
        mudouItem = true;
      }

      // Regra de Negócio: Se a atividade for CANCELADO, definir como CONCLUÍDO para Viagens
      const isLancamentoCancelado = (l.status || "").toUpperCase().includes("CANCEL");
      if (isLancamentoCancelado) {
        if (solExistente.status !== "CONCLUIDO") {
          solExistente.status = "CONCLUIDO";
          solExistente.necessidades = { aereo: false, hotel: false, carro: false, seguro: false };
          solExistente.categorias.forEach((c) => (c.necessaria = false));
          mudouItem = true;
        }
      } else if (custoDiaria > 0) {
        // Regra de Negócio (Prints 1 e 2): Se o campo Alimentação / Diária está preenchido (> 0),
        // a prestação de contas foi a última etapa e a viagem já está finalizada.
        if (solExistente.status !== "CONCLUIDO") {
          solExistente.status = "CONCLUIDO";
          solExistente.necessidades = { aereo: false, hotel: false, carro: false, seguro: false };
          solExistente.categorias.forEach((c) => (c.necessaria = false));
          mudouItem = true;
        }
      } else if (
        l.precisa_logistica === true &&
        solExistente.totalContratado === 0 &&
        solExistente.status === "CONCLUIDO" &&
        !isLogisticaEmOutroPeriodo &&
        !isLancamentoCancelado
      ) {
        // Apenas atividades sem custo contratado e sem diária (ainda pendentes de cotação)
        solExistente.status = "AGUARDANDO_COTACAO";
        solExistente.necessidades = {
          ...solExistente.necessidades,
          aereo: true,
          hotel: true,
        };
        solExistente.categorias.forEach((c) => {
          if (c.categoria === "AEREO" || c.categoria === "HOTEL") {
            c.necessaria = true;
          }
        });
        mudouItem = true;
      }
      if (l.data_final && solExistente.dataFinal !== l.data_final) {
        solExistente.dataFinal = l.data_final;
        mudouItem = true;
      }
      if (l.data_inicial && solExistente.dataInicial !== l.data_inicial) {
        solExistente.dataInicial = l.data_inicial;
        mudouItem = true;
      }
      if (solExistente.custoAlimentacaoDiaria !== custoDiaria) {
        solExistente.custoAlimentacaoDiaria = custoDiaria;
        solExistente.totalRealizado = solExistente.totalContratado + custoDiaria;
        mudouItem = true;
      }
      if (l.local && solExistente.destino !== l.local) {
        solExistente.destino = l.local;
        mudouItem = true;
      }
      if (mudouItem) {
        solExistente.atualizadoEm = new Date().toISOString();
        houveMudanca = true;
      }
    }
  }

  // Limpeza de solicitações órfãs (lançamentos excluídos ou substituídos no Supabase)
  const idsSupabaseValidos = new Set((lancs as any[]).map((l) => l.id));
  for (const [lancId] of mapaExistentes.entries()) {
    if (!idsSupabaseValidos.has(lancId)) {
      mapaExistentes.delete(lancId);
      houveMudanca = true;
    }
  }

  const listaFinal = Array.from(mapaExistentes.values());
  if (houveMudanca) {
    salvarSolicitacoesArquivo(listaFinal);
  }
  return listaFinal;
}

/**
 * Garante abertura automática da solicitação ao salvar uma atividade com precisa_logistica = true
 */
export async function garantirSolicitacaoAtividade(lancamentoId: string, dadosAtividade: any): Promise<ViagemSolicitacao> {
  const lista = carregarSolicitacoesArquivo();
  let sol = lista.find((s) => s.lancamentoId === lancamentoId);

  const agora = new Date().toISOString();

  const isCancelado = dadosAtividade.status && String(dadosAtividade.status).toUpperCase().includes("CANCEL");

  if (!sol) {
    const id = `sol-${lancamentoId}`;
    sol = {
      id,
      lancamentoId,
      viagemId: dadosAtividade.viagemId,
      projeto: dadosAtividade.projeto || "PROJETO NNÓS",
      atividade: dadosAtividade.atividade || "Atividade Operacional",
      consultor: dadosAtividade.consultor || "Consultor a definir",
      perfilConsultor: dadosAtividade.perfil || "SÊNIOR",
      origem: dadosAtividade.origem || "Belo Horizonte - MG",
      destino: dadosAtividade.local || "Destino a definir",
      dataInicial: dadosAtividade.dataInicial || "",
      dataFinal: dadosAtividade.dataFinal || "",
      status: isCancelado ? "CONCLUIDO" : "AGUARDANDO_COTACAO",
      agenciaNome: dadosAtividade.agencia || "FÁTIMA",
      necessidades: {
        aereo: !isCancelado,
        hotel: !isCancelado,
        carro: false,
        seguro: false,
      },
      observacoesSolicitante: dadosAtividade.observacoes || "",
      categorias: [
        { categoria: "AEREO", nomeExibicao: "Passagem Aérea", icone: "flight", necessaria: !isCancelado, alternativas: [] },
        { categoria: "HOTEL", nomeExibicao: "Hotel / Estadia", icone: "hotel", necessaria: !isCancelado, alternativas: [] },
        { categoria: "CARRO", nomeExibicao: "Carro / Translado", icone: "directions_car", necessaria: false, alternativas: [] },
        { categoria: "SEGURO", nomeExibicao: "Seguro / Outros", icone: "verified_user", necessaria: false, alternativas: [] },
      ],
      totalCotado: 0,
      totalAprovado: 0,
      totalContratado: 0,
      custoAlimentacaoDiaria: 0,
      totalRealizado: 0,
      requerReaprovacao: false,
      diferencaValor: 0,
      auditoria: [
        {
          id: `aud-${Date.now()}`,
          dataHora: agora,
          perfilUsuario: "LIDER",
          usuarioNome: dadosAtividade.usuarioNome || "Líder de Projeto",
          acao: "SOLICITACAO_CRIADA",
          detalhes: isCancelado
            ? "Atividade com status CANCELADO: Viagem definida como CONCLUÍDO e Prestação de Contas NÃO APLICÁVEL"
            : "Solicitação aberta automaticamente pelo gatilho Precisa Logística = SIM",
        },
      ],
      criadoEm: agora,
      atualizadoEm: agora,
    };
    lista.unshift(sol);
  } else {
    // Atualiza metadados sem duplicar
    if (dadosAtividade.projeto) sol.projeto = dadosAtividade.projeto;
    if (dadosAtividade.atividade) sol.atividade = dadosAtividade.atividade;
    if (dadosAtividade.consultor) sol.consultor = dadosAtividade.consultor;
    if (dadosAtividade.local) sol.destino = dadosAtividade.local;
    if (dadosAtividade.dataInicial) sol.dataInicial = dadosAtividade.dataInicial;
    if (dadosAtividade.dataFinal) sol.dataFinal = dadosAtividade.dataFinal;
    if (isCancelado) {
      sol.status = "CONCLUIDO";
      sol.necessidades = { aereo: false, hotel: false, carro: false, seguro: false };
      sol.categorias.forEach((c) => (c.necessaria = false));
    }
    sol.atualizadoEm = agora;
  }

  salvarSolicitacoesArquivo(lista);
  return sol;
}

/**
 * Remove a solicitação logística caso a atividade seja excluída
 */
export async function removerSolicitacaoPorLancamento(lancamentoId: string): Promise<void> {
  const lista = carregarSolicitacoesArquivo();
  const index = lista.findIndex((s) => s.lancamentoId === lancamentoId);
  if (index !== -1) {
    lista.splice(index, 1);
    salvarSolicitacoesArquivo(lista);
  }
}

/**
 * Localiza com segurança uma solicitação por ID ou lancamentoId.
 * Se não estiver em memória/arquivo, sincroniza a base de lançamentos do Supabase
 * para garantir que atividades novas criadas sejam instantaneamente reconhecidas.
 */
export async function obterSolicitacaoGarantida(
  solicitacaoId: string
): Promise<{ sol: ViagemSolicitacao; lista: ViagemSolicitacao[] }> {
  let lista = carregarSolicitacoesArquivo();
  let sol = lista.find(
    (s) =>
      s.id === solicitacaoId ||
      s.lancamentoId === solicitacaoId ||
      s.id.endsWith(solicitacaoId) ||
      solicitacaoId.endsWith(s.id) ||
      String(s.lancamentoId) === String(solicitacaoId)
  );

  if (!sol) {
    // Sincroniza todas as solicitações a partir do banco de dados
    lista = await sincronizarSolicitacoesIniciais();
    sol = lista.find(
      (s) =>
        s.id === solicitacaoId ||
        s.lancamentoId === solicitacaoId ||
        s.id.endsWith(solicitacaoId) ||
        solicitacaoId.endsWith(s.id) ||
        String(s.lancamentoId) === String(solicitacaoId)
    );
  }

  if (!sol) {
    throw new Error(`Solicitação não encontrada (ID: ${solicitacaoId})`);
  }

  return { sol, lista };
}

/**
 * Salva ou atualiza cotações enviadas pela Agência de Viagens
 */
export async function salvarCotacoesAgencia(
  solicitacaoId: string,
  categoriasAtualizadas: CategoriaCotacoes[],
  observacoesAgencia: string,
  enviarParaAprovacao: boolean,
  usuarioNome: string = "Agência de Viagens"
): Promise<ViagemSolicitacao> {
  const { sol, lista } = await obterSolicitacaoGarantida(solicitacaoId);

  const agora = new Date().toISOString();

  sol.categorias = categoriasAtualizadas;
  
  // Recalcula total cotado com base nas menores cotações disponíveis de cada categoria necessária
  let totalCot = 0;
  categoriasAtualizadas.forEach((cat) => {
    if (cat.necessaria && cat.alternativas.length > 0) {
      const menor = Math.min(...cat.alternativas.map((a) => a.valor || 0));
      totalCot += menor;
    }
  });
  sol.totalCotado = Math.round(totalCot * 100) / 100;

  if (enviarParaAprovacao) {
    sol.status = "AGUARDANDO_APROVACAO";
    sol.auditoria.push({
      id: `aud-${Date.now()}`,
      dataHora: agora,
      perfilUsuario: "AGENCIA",
      usuarioNome,
      acao: "COTACOES_ENVIADAS_APROVACAO",
      detalhes: `Cotações enviadas para aprovação do líder. Total estimado: R$ ${sol.totalCotado.toFixed(2)}. ${observacoesAgencia || ""}`,
    });
  } else {
    sol.status = "EM_COTACAO";
    sol.auditoria.push({
      id: `aud-${Date.now()}`,
      dataHora: agora,
      perfilUsuario: "AGENCIA",
      usuarioNome,
      acao: "COTACOES_SALVAS_RASCUNHO",
      detalhes: "Propostas e cotações atualizadas pela agência",
    });
  }

  sol.atualizadoEm = agora;
  salvarSolicitacoesArquivo(lista);
  return sol;
}

/**
 * Líder de Projeto aprova a composição logística em 1 clique
 */
export async function aprovarLogisticaLider(
  solicitacaoId: string,
  escolhasPorCategoria: Record<CategoriaLogistica, string>, // { AEREO: altId, HOTEL: altId, ... }
  aprovadorNome: string = "Líder de Projeto",
  justificativas?: Record<string, string>
): Promise<ViagemSolicitacao> {
  const { sol, lista } = await obterSolicitacaoGarantida(solicitacaoId);

  const agora = new Date().toISOString();
  let somaAprovada = 0;

  sol.categorias.forEach((cat) => {
    const altEscolhidaId = escolhasPorCategoria[cat.categoria];
    if (altEscolhidaId) {
      cat.alternativaAprovadaId = altEscolhidaId;
      cat.alternativas.forEach((alt) => {
        alt.selecionada = alt.id === altEscolhidaId;
        if (alt.selecionada) {
          somaAprovada += alt.valor || 0;
        }
      });
    }
  });

  sol.totalAprovado = Math.round(somaAprovada * 100) / 100;
  sol.status = "APROVADO_AGUARDANDO_COMPRA";
  sol.requerReaprovacao = false;
  sol.aprovadoPor = aprovadorNome;
  sol.aprovadoEm = agora;
  if (justificativas && Object.keys(justificativas).length > 0) {
    sol.justificativasLider = { ...(sol.justificativasLider || {}), ...justificativas };
  }

  const justTexto = justificativas && Object.keys(justificativas).length > 0
    ? ` Justificativas: ${Object.entries(justificativas).map(([k, v]) => `[${k}: ${v}]`).join("; ")}`
    : "";

  sol.auditoria.push({
    id: `aud-${Date.now()}`,
    dataHora: agora,
    perfilUsuario: "LIDER",
    usuarioNome: aprovadorNome,
    acao: "LOGISTICA_APROVADA",
    detalhes: `Composição da viagem aprovada com total de R$ ${sol.totalAprovado.toFixed(2)}.${justTexto} Aguardando compra da agência.`,
  });

  sol.atualizadoEm = agora;
  salvarSolicitacoesArquivo(lista);

  // Sincroniza custos aprovados provisórios no Supabase
  await sincronizarViagemComSupabase(sol);

  return sol;
}

/**
 * Agência de Viagens registra compras, valores contratados e anexa vouchers definitivos
 */
export async function registrarCompraAgencia(
  solicitacaoId: string,
  dadosContratacao: {
    compras: {
      categoria: CategoriaLogistica;
      alternativaId: string;
      valorContratado: number;
      localizadorOuReserva?: string;
      observacoes?: string;
      vouchers?: any[];
    }[];
    usuarioNome?: string;
  }
): Promise<ViagemSolicitacao> {
  const { sol, lista } = await obterSolicitacaoGarantida(solicitacaoId);

  const agora = new Date().toISOString();
  let totalContratado = 0;

  dadosContratacao.compras.forEach((c) => {
    const cat = sol.categorias.find((x) => x.categoria === c.categoria);
    if (cat) {
      const alt = cat.alternativas.find((a) => a.id === c.alternativaId) || cat.alternativas.find((a) => a.selecionada);
      if (alt) {
        alt.valorContratado = Number(c.valorContratado) || alt.valor;
        alt.localizadorOuReserva = c.localizadorOuReserva || alt.localizadorOuReserva;
        alt.observacoesContratacao = c.observacoes || alt.observacoesContratacao;
        if (c.vouchers !== undefined) {
          alt.vouchersDefinitivos = c.vouchers;
          // Anexos gerais contêm apenas cotações/propostas; vouchers ficam isolados em vouchersDefinitivos
          alt.anexos = (alt.anexos || []).filter((a) => a.tipo !== "VOUCHER");
        }
        totalContratado += alt.valorContratado;
      }
    }
  });

  sol.totalContratado = Math.round(totalContratado * 100) / 100;
  sol.diferencaValor = Math.round((sol.totalContratado - sol.totalAprovado) * 100) / 100;
  sol.totalRealizado = Math.round((sol.totalContratado + sol.custoAlimentacaoDiaria) * 100) / 100;

  // MELHORIA 1: Reaprovação obrigatória se valor contratado > aprovado (tolerância zero)
  if (sol.totalContratado > sol.totalAprovado + 0.05) {
    sol.status = "AGUARDANDO_REAPROVACAO";
    sol.requerReaprovacao = true;
    sol.motivoReaprovacao = `Valor contratado (R$ ${sol.totalContratado.toFixed(2)}) excedeu o valor aprovado (R$ ${sol.totalAprovado.toFixed(2)}) em R$ ${sol.diferencaValor.toFixed(2)}.`;
    
    sol.auditoria.push({
      id: `aud-${Date.now()}`,
      dataHora: agora,
      perfilUsuario: "AGENCIA",
      usuarioNome: dadosContratacao.usuarioNome || "Agência de Viagens",
      acao: "AUMENTO_TARIFA_REAPROVACAO_SOLICITADA",
      detalhes: sol.motivoReaprovacao,
      valorAnterior: sol.totalAprovado,
      novoValor: sol.totalContratado,
    });
  } else {
    sol.status = "VOUCHERS_PENDENTES";
    sol.requerReaprovacao = false;

    sol.auditoria.push({
      id: `aud-${Date.now()}`,
      dataHora: agora,
      perfilUsuario: "AGENCIA",
      usuarioNome: dadosContratacao.usuarioNome || "Agência de Viagens",
      acao: "COMPRAS_REGISTRADAS",
      detalhes: `Contratações confirmadas pela agência com valor total de R$ ${sol.totalContratado.toFixed(2)}.`,
      novoValor: sol.totalContratado,
    });
  }

  sol.atualizadoEm = agora;
  salvarSolicitacoesArquivo(lista);

  // Sincroniza custos no Supabase
  await sincronizarViagemComSupabase(sol);

  return sol;
}

/**
 * Envio de vouchers para o viajante com cópia para agência e líder de projeto
 */
export async function enviarVouchersViajante(
  solicitacaoId: string,
  emailDestinatario?: string,
  usuarioNome: string = "Agência de Viagens"
): Promise<{ ok: boolean; mensagem: string; solicitacao: ViagemSolicitacao; emailPreview?: any }> {
  const { sol, lista } = await obterSolicitacaoGarantida(solicitacaoId);

  const agora = new Date().toISOString();
  const destEmail = emailDestinatario || sol.consultorEmail || "leonardo.campos@nnos.com.br";
  const destinatarios = [destEmail, "agencia.fatima@nnos.com.br", "gestao.projetos@nnos.com.br"];

  sol.status = "VOUCHERS_ENVIADOS";
  sol.vouchersEnviadosEm = agora;
  sol.destinatariosEnvio = destinatarios;

  sol.auditoria.push({
    id: `aud-${Date.now()}`,
    dataHora: agora,
    perfilUsuario: "AGENCIA",
    usuarioNome,
    acao: "VOUCHERS_DISPARADOS_EMAIL",
    detalhes: `Vouchers e dados das reservas encaminhados com sucesso para ${destinatarios.join(", ")}.`,
  });

  sol.atualizadoEm = agora;
  salvarSolicitacoesArquivo(lista);

  // Sincroniza custos no Supabase imediatamente para refletir na tela de Projetos
  await sincronizarViagemComSupabase(sol);

  const aereoCat = sol.categorias.find((c) => c.categoria === "AEREO");
  const aereoAlt = aereoCat?.alternativas.find((a) => a.id === aereoCat.alternativaAprovadaId) || aereoCat?.alternativas.find((a) => a.selecionada);

  const hotelCat = sol.categorias.find((c) => c.categoria === "HOTEL");
  const hotelAlt = hotelCat?.alternativas.find((a) => a.id === hotelCat.alternativaAprovadaId) || hotelCat?.alternativas.find((a) => a.selecionada);

  const carroCat = sol.categorias.find((c) => c.categoria === "CARRO");
  const carroAlt = carroCat?.alternativas.find((a) => a.id === carroCat.alternativaAprovadaId) || carroCat?.alternativas.find((a) => a.selecionada);

  const todosAnexos: { nome: string; categoria: string; url?: string }[] = [];
  sol.categorias.forEach((c) => {
    c.alternativas.forEach((a) => {
      const listaDocs = [...(a.vouchersDefinitivos || []), ...(a.anexos || [])];
      listaDocs.forEach((doc) => {
        if (!todosAnexos.some((ex) => ex.nome === doc.nome && ex.url === doc.url)) {
          todosAnexos.push({
            nome: doc.nome,
            categoria: c.nomeExibicao,
            url: doc.url,
          });
        }
      });
    });
  });

  const emailPreview = {
    de: `${sol.agenciaNome || "Agência de Viagens"} <agencia.${(sol.agenciaNome || "fatima").toLowerCase()}@nnos.com.br>`,
    para: destEmail,
    cc: ["agencia.fatima@nnos.com.br", "gestao.projetos@nnos.com.br"],
    assunto: `[VOUCHER & RESERVAS] Viagem Confirmada • ${sol.projeto} - ${sol.atividade}`,
    dataEnvio: agora,
    passageiro: sol.consultor,
    perfil: sol.perfilConsultor,
    projeto: sol.projeto,
    atividade: sol.atividade,
    periodo: formatarPeriodoBR(sol.dataInicial, sol.dataFinal),
    destino: sol.destino,
    aereo: aereoAlt
      ? {
          fornecedor: aereoAlt.fornecedor || "GOL / LATAM / AZUL",
          horarios: aereoAlt.descricao || "Conforme bilhete",
          localizador: aereoAlt.localizadorOuReserva || "Emitido",
          valor: aereoAlt.valorContratado ?? aereoAlt.valor,
        }
      : null,
    hotel: hotelAlt
      ? {
          hotel: hotelAlt.fornecedor || "Hotel",
          detalhes: hotelAlt.descricao || "Diárias confirmadas",
          localizador: hotelAlt.localizadorOuReserva || "Confirmado",
          valor: hotelAlt.valorContratado ?? hotelAlt.valor,
        }
      : null,
    carro: carroAlt
      ? {
          locadora: carroAlt.fornecedor || "Locadora",
          detalhes: carroAlt.descricao || "Reserva confirmada",
          localizador: carroAlt.localizadorOuReserva || "Confirmado",
          valor: carroAlt.valorContratado ?? carroAlt.valor,
        }
      : null,
    totalViagem: sol.totalContratado,
    anexos: todosAnexos,
    observacoes: sol.observacoesSolicitante || "Seguir orientações da agência e NNÓS.",
  };

  // Montar HTML Corporativo refinado
  const htmlCorpo = `
    <div style="font-family: Arial, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 680px; margin: 0 auto; color: #1e293b; line-height: 1.5; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; background-color: #ffffff;">
      <!-- Header Institucional -->
      <div style="padding: 22px 26px 16px 26px; border-bottom: 2px solid #059669; background-color: #ffffff;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="vertical-align: middle;">
              <h2 style="margin: 0; font-size: 18px; font-weight: 900; color: #002B49; letter-spacing: -0.3px; text-transform: uppercase;">NNÓS CONSULTORIA E TREINAMENTO</h2>
              <p style="margin: 3px 0 0 0; font-size: 12px; font-weight: 800; color: #0d9488; letter-spacing: 0.8px; text-transform: uppercase;">GESTÃO DE VIAGENS &amp; LOGÍSTICA CORPORATIVA</p>
            </td>
            <td style="text-align: right; vertical-align: middle;">
              <span style="display: inline-block; padding: 5px 12px; border-radius: 9999px; font-size: 11.5px; font-weight: 700; background-color: #ecfdf5; color: #047857; border: 1px solid #a7f3d0;">
                ● Vouchers Confirmados
              </span>
            </td>
          </tr>
        </table>
      </div>

      <div style="padding: 24px 26px; background-color: #ffffff;">
        <p style="font-size: 15px; margin: 0 0 10px 0; color: #1e293b;">Olá, <strong style="color: #0f172a;">${sol.consultor}</strong>,</p>
        <p style="font-size: 13.5px; color: #334155; line-height: 1.6; margin: 0 0 20px 0;">
          Sua logística para a atividade <strong style="color: #0f172a;">${sol.atividade}</strong> do projeto <strong style="color: #0f172a;">${sol.projeto}</strong> foi contratada com sucesso pela agência <strong style="color: #0f172a;">${sol.agenciaNome || "FÁTIMA"}</strong>. Seguem abaixo os dados e localizadores definitivos das suas reservas:
        </p>

        <!-- Resumo Operacional -->
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 18px; margin-bottom: 20px;">
          <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
            <tr>
              <td style="color: #64748b; padding: 4px 0; width: 48%;">
                <span style="font-size: 11px; font-weight: 700; text-transform: uppercase;">Destino da Atividade:</span><br/>
                <strong style="color: #0f172a; font-size: 14px;">${sol.destino}</strong>
              </td>
              <td style="color: #64748b; padding: 4px 0; width: 48%;">
                <span style="font-size: 11px; font-weight: 700; text-transform: uppercase;">Período da Viagem:</span><br/>
                <strong style="color: #0f172a; font-size: 14px;">${formatarPeriodoBR(sol.dataInicial, sol.dataFinal)}</strong>
              </td>
            </tr>
          </table>
        </div>

        ${emailPreview.aereo ? `
        <!-- Voo -->
        <div style="border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 18px; margin-bottom: 14px; background-color: #ffffff;">
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 6px;">
            <tr>
              <td style="font-size: 14px; font-weight: 700; color: #0f2a4a;">✈️ Passagem Aérea (${emailPreview.aereo.fornecedor})</td>
              <td style="text-align: right;">
                <span style="font-size: 12px; color: #047857; font-weight: 800; background-color: #ecfdf5; border: 1px solid #a7f3d0; padding: 3px 8px; border-radius: 6px;">
                  Localizador: ${emailPreview.aereo.localizador}
                </span>
              </td>
            </tr>
          </table>
          <div style="font-size: 12.5px; color: #475569; padding-left: 10px; border-left: 2px solid #e2e8f0; margin-top: 6px;">
            <p style="margin: 0; font-weight: 600; color: #334155;">${emailPreview.aereo.horarios}</p>
            <p style="margin: 4px 0 0 0; font-size: 11.5px; color: #64748b;">Emissão efetuada com sucesso. Apresente o documento com foto no check-in digital ou aeroporto.</p>
          </div>
        </div>
        ` : ""}

        ${emailPreview.hotel ? `
        <!-- Hotel -->
        <div style="border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 18px; margin-bottom: 14px; background-color: #ffffff;">
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 6px;">
            <tr>
              <td style="font-size: 14px; font-weight: 700; color: #0f2a4a;">🏨 Hospedagem / Hotel (${emailPreview.hotel.hotel})</td>
              <td style="text-align: right;">
                <span style="font-size: 12px; color: #047857; font-weight: 800; background-color: #ecfdf5; border: 1px solid #a7f3d0; padding: 3px 8px; border-radius: 6px;">
                  Reserva: ${emailPreview.hotel.localizador}
                </span>
              </td>
            </tr>
          </table>
          <div style="font-size: 12.5px; color: #475569; padding-left: 10px; border-left: 2px solid #e2e8f0; margin-top: 6px;">
            <p style="margin: 0; font-weight: 600; color: #334155;">${emailPreview.hotel.detalhes}</p>
            <p style="margin: 4px 0 0 0; font-size: 11.5px; color: #64748b;">Diárias confirmadas. Check-in a partir das 14h / Check-out até 12h.</p>
          </div>
        </div>
        ` : ""}

        ${todosAnexos.length > 0 ? `
        <!-- Vouchers em anexo -->
        <div style="margin: 18px 0; padding: 14px 18px; background-color: rgba(13, 148, 136, 0.06); border: 1px solid rgba(13, 148, 136, 0.25); border-radius: 10px;">
          <strong style="font-size: 12px; color: #0f766e; text-transform: uppercase; display: block; margin-bottom: 8px;">📎 Vouchers e Comprovantes em Anexo (${todosAnexos.length}):</strong>
          <ul style="margin: 0; padding-left: 18px; font-size: 12.5px; color: #115e59;">
            ${todosAnexos.map((a) => `<li style="margin-bottom: 4px;"><strong>${a.nome}</strong> (${a.categoria})</li>`).join("")}
          </ul>
        </div>
        ` : ""}

        <!-- Orientações -->
        <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 18px 20px; font-size: 12.5px; color: #92400e; margin-top: 22px; line-height: 1.5;">
          <strong style="display: block; margin-bottom: 10px; font-size: 13.5px; color: #78350f;">Orientações para Prestação de Contas</strong>
          
          <div style="background-color: rgba(245, 158, 11, 0.12); border-left: 3px solid #d97706; padding: 8px 12px; margin: 0 0 14px 0; font-size: 12px; color: #854d0e;">
            <strong style="color: #78350f;">Atenção:</strong> O viajante precisa verificar previamente para qual empresa estará prestando o serviço/viagem. <strong>Se a empresa contratante não possuir política de viagem própria, a diretriz oficial que será obrigatoriamente utilizada é a da NNÓS Consultoria.</strong>
          </div>

          <!-- Bloco de Miniaturas das Políticas de Viagem (Clique para abrir o PDF) -->
          <div style="margin-top: 14px; padding-top: 12px; border-top: 1px dashed rgba(217, 119, 6, 0.4);">
            <strong style="display: block; font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.5px; color: #78350f; margin-bottom: 10px;">
              📁 Políticas de Viagem &amp; Reembolso (Clique na miniatura para abrir o PDF):
            </strong>
            <table style="width: 100%; border-collapse: collapse; margin-top: 6px;">
              <tr>
                <td style="width: 25%; padding: 4px; vertical-align: top; text-align: center;">
                  <a href="/politicas/politica-nnos.pdf" target="_blank" style="text-decoration: none; color: inherit; display: block; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 6px;">
                    <img src="/politicas/politica-nnos-header.jpg" alt="Política NNÓS" style="width: 100%; height: 110px; object-fit: cover; object-position: top; border-radius: 4px; display: block; margin-bottom: 6px;" />
                    <span style="display: block; font-size: 10px; font-weight: 800; color: #0d9488;">NNÓS (Padrão)</span>
                    <span style="display: inline-block; font-size: 10px; color: #2563eb; font-weight: 700; margin-top: 2px;">Abrir PDF &rarr;</span>
                  </a>
                </td>
                <td style="width: 25%; padding: 4px; vertical-align: top; text-align: center;">
                  <a href="/politicas/politica-cnh.pdf" target="_blank" style="text-decoration: none; color: inherit; display: block; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 6px;">
                    <img src="/politicas/politica-cnh-header.jpg" alt="Política CNH" style="width: 100%; height: 110px; object-fit: cover; object-position: top; border-radius: 4px; display: block; margin-bottom: 6px;" />
                    <span style="display: block; font-size: 10px; font-weight: 800; color: #1e3a8a;">CNH Training</span>
                    <span style="display: inline-block; font-size: 10px; color: #2563eb; font-weight: 700; margin-top: 2px;">Abrir PDF &rarr;</span>
                  </a>
                </td>
                <td style="width: 25%; padding: 4px; vertical-align: top; text-align: center;">
                  <a href="/politicas/politica-iveco.pdf" target="_blank" style="text-decoration: none; color: inherit; display: block; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 6px;">
                    <img src="/politicas/politica-iveco-header.jpg" alt="Política Iveco" style="width: 100%; height: 110px; object-fit: cover; object-position: top; border-radius: 4px; display: block; margin-bottom: 6px;" />
                    <span style="display: block; font-size: 10px; font-weight: 800; color: #0284c7;">Iveco Group</span>
                    <span style="display: inline-block; font-size: 10px; color: #2563eb; font-weight: 700; margin-top: 2px;">Abrir PDF &rarr;</span>
                  </a>
                </td>
                <td style="width: 25%; padding: 4px; vertical-align: top; text-align: center;">
                  <a href="/politicas/politica-reembolso-nnos.pdf" target="_blank" style="text-decoration: none; color: inherit; display: block; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 6px;">
                    <img src="/politicas/politica-reembolso-nnos-header.jpg" alt="Reembolso Vexpenses" style="width: 100%; height: 110px; object-fit: cover; object-position: top; border-radius: 4px; display: block; margin-bottom: 6px;" />
                    <span style="display: block; font-size: 10px; font-weight: 800; color: #059669;">Vexpenses (App)</span>
                    <span style="display: inline-block; font-size: 10px; color: #2563eb; font-weight: 700; margin-top: 2px;">Abrir PDF &rarr;</span>
                  </a>
                </td>
              </tr>
            </table>
          </div>
        </div>
      </div>

      <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 14px; font-size: 11px; color: #94a3b8; text-align: center;">
        Mensagem gerada pelo Sistema de Gestão Financeira de Projetos • NNÓS Consultoria e Treinamento
      </div>
    </div>
  `;

  // Disparar envio de e-mail com anexos reais
  let envioInfo = "Modo Simulação";
  try {
    const anexosEnvio: { filename: string; content: string }[] = todosAnexos.filter((a) => a.url).map((a) => ({
      filename: a.nome,
      content: a.url!,
    }));

    // Inclui os PDFs oficiais das políticas de viagem como anexos reais no e-mail
    const politicasDir = path.join(process.cwd(), "public/politicas");
    const politicasDocs = [
      { filename: "Politica_Viagens_NNOS.pdf", file: "politica-nnos.pdf" },
      { filename: "Politica_Viagens_CNH_Training.pdf", file: "politica-cnh.pdf" },
      { filename: "Politica_Viagens_IVECO_Group.pdf", file: "politica-iveco.pdf" },
      { filename: "Politica_Reembolso_Vexpenses_NNOS.pdf", file: "politica-reembolso-nnos.pdf" },
    ];
    politicasDocs.forEach((pd) => {
      const fullPath = path.join(politicasDir, pd.file);
      if (fs.existsSync(fullPath)) {
        try {
          const pdfBuffer = fs.readFileSync(fullPath);
          anexosEnvio.push({
            filename: pd.filename,
            content: `data:application/pdf;base64,${pdfBuffer.toString("base64")}`,
          });
        } catch (e) {
          console.warn("Aviso ao ler anexo de política:", pd.file, e);
        }
      }
    });

    const resultadoEmail = await dispararEmail({
      para: destEmail,
      de: `Agência de Viagens <${sol.agenciaNome ? `agencia.${sol.agenciaNome.toLowerCase()}@nnos.com.br` : "logistica@nnos.com.br"}>`,
      cc: ["agencia.fatima@nnos.com.br", "gestao.projetos@nnos.com.br"],
      assunto: `[VOUCHER & RESERVAS] Viagem Confirmada • ${sol.projeto} - ${sol.atividade}`,
      html: htmlCorpo,
      anexos: anexosEnvio,
    });

    if (resultadoEmail.modo === "resend" || resultadoEmail.modo === "smtp") {
      envioInfo = resultadoEmail.sucesso
        ? `E-mail REAL disparado via ${resultadoEmail.modo.toUpperCase()} diretamente para ${destEmail}!`
        : `Tentativa via ${resultadoEmail.modo.toUpperCase()} falhou: ${resultadoEmail.mensagem}`;
    } else {
      envioInfo = `Simulação concluída com sucesso para ${destEmail}. (Para envio real na caixa de entrada, configure RESEND_API_KEY ou SMTP_HOST no .env.local).`;
    }
  } catch (errEmail: any) {
    console.warn("Aviso ao tentar disparar e-mail:", errEmail);
    envioInfo = `Simulação concluída (Aviso: ${errEmail.message})`;
  }

  return {
    ok: true,
    mensagem: envioInfo,
    solicitacao: sol,
    emailPreview,
  };
}

/**
 * Financeiro registra Alimentação / Diária na prestação de contas
 */
export async function registrarAlimentacaoFinanceiro(
  solicitacaoId: string,
  valorAlimentacao: number,
  observacoes: string,
  concluirPrestacao: boolean,
  usuarioNome: string = "Financeiro NNÓS"
): Promise<ViagemSolicitacao> {
  const lista = carregarSolicitacoesArquivo();
  const sol = lista.find((s) => s.id === solicitacaoId);
  if (!sol) throw new Error("Solicitação não encontrada");

  const agora = new Date().toISOString();
  const valorAnterior = sol.custoAlimentacaoDiaria;

  sol.custoAlimentacaoDiaria = Math.round((Number(valorAlimentacao) || 0) * 100) / 100;
  sol.totalRealizado = Math.round((sol.totalContratado + sol.custoAlimentacaoDiaria) * 100) / 100;
  sol.prestacaoContasObservacao = observacoes || sol.prestacaoContasObservacao;

  if (concluirPrestacao) {
    sol.status = "CONCLUIDO";
    sol.prestacaoContasConcluidaEm = agora;
  } else {
    sol.status = "AGUARDANDO_PRESTACAO_CONTAS";
  }

  sol.auditoria.push({
    id: `aud-${Date.now()}`,
    dataHora: agora,
    perfilUsuario: "FINANCEIRO",
    usuarioNome,
    acao: concluirPrestacao ? "PRESTACAO_CONTAS_CONCLUIDA" : "ALIMENTACAO_DIARIA_ATUALIZADA",
    detalhes: `Valor de Alimentação/Diária registrado: R$ ${sol.custoAlimentacaoDiaria.toFixed(2)}. Total Viagem final: R$ ${sol.totalRealizado.toFixed(2)}. ${observacoes || ""}`,
    valorAnterior,
    novoValor: sol.custoAlimentacaoDiaria,
  });

  sol.atualizadoEm = agora;
  salvarSolicitacoesArquivo(lista);

  // Sincroniza custos no Supabase
  await sincronizarViagemComSupabase(sol);

  return sol;
}

/**
 * Consultor aprova o recebimento dos vouchers emitidos pela agência
 */
export async function aprovarRecebimentoVouchersConsultor(
  solicitacaoId: string,
  usuarioNome: string = "Consultor"
): Promise<ViagemSolicitacao> {
  const lista = carregarSolicitacoesArquivo();
  const sol = lista.find((s) => s.id === solicitacaoId);
  if (!sol) throw new Error("Solicitação não encontrada");

  const agora = new Date().toISOString();
  sol.status = "AGUARDANDO_PRESTACAO_CONTAS";
  sol.vouchersRecebidosAprovadosEm = agora;
  sol.vouchersRecebidosAprovadosPor = usuarioNome;

  sol.auditoria.push({
    id: `aud-${Date.now()}`,
    dataHora: agora,
    perfilUsuario: "CONSULTOR",
    usuarioNome,
    acao: "VOUCHERS_RECEBIMENTO_APROVADO",
    detalhes: `Consultor confirmou e aprovou o recebimento dos vouchers e das reservas no sistema.`,
  });

  sol.atualizadoEm = agora;
  salvarSolicitacoesArquivo(lista);

  await sincronizarViagemComSupabase(sol);

  return sol;
}

/**
 * Sincroniza os custos da solicitação de viagem diretamente com a tabela viagens e lancamentos no Supabase
 */
async function sincronizarViagemComSupabase(sol: ViagemSolicitacao): Promise<void> {
  try {
    const db = getSupabase();
    
    // Obter valores contratados por categoria
    const getValorCat = (catNome: CategoriaLogistica) => {
      const cat = sol.categorias.find((c) => c.categoria === catNome);
      if (!cat) return 0;
      const altAprovada = cat.alternativas.find((a) => a.id === cat.alternativaAprovadaId) || cat.alternativas.find((a) => a.selecionada);
      return altAprovada ? (altAprovada.valorContratado ?? altAprovada.valor ?? 0) : 0;
    };

    const c1 = getValorCat("AEREO");
    const c2 = getValorCat("HOTEL");
    const c3 = getValorCat("CARRO");
    const c4 = getValorCat("SEGURO");
    const c5 = sol.custoAlimentacaoDiaria || 0;
    const totalViagem = Math.round((c1 + c2 + c3 + c4 + c5) * 100) / 100;

    // 1. Atualizar ou inserir na tabela viagens (SEM A COLUNA GERADA 'total')
    const payloadViagem: any = {
      lancamento_id: sol.lancamentoId,
      agencia: sol.agenciaNome || "FÁTIMA",
      custo_1: c1,
      custo_2: c2,
      custo_3: c3,
      custo_4: c4,
      custo_5: c5,
      observacao_agencia: sol.observacoesSolicitante || null,
    };

    let targetViagemId = sol.viagemId;

    if (!targetViagemId && sol.lancamentoId) {
      const { data: vExistente } = await db
        .from("viagens")
        .select("id")
        .eq("lancamento_id", sol.lancamentoId)
        .maybeSingle();
      if (vExistente?.id) targetViagemId = vExistente.id;
    }

    if (targetViagemId) {
      sol.viagemId = targetViagemId;
      await db.from("viagens").update(payloadViagem).eq("id", targetViagemId);
    } else {
      const { data: novaV } = await db
        .from("viagens")
        .insert(payloadViagem)
        .select("id")
        .maybeSingle();
      if (novaV?.id) sol.viagemId = novaV.id;
    }

    // 2. Se houver outro lançamento com a mesma atividade e projeto (ex: atividade de teste duplicada), sincroniza também
    if (sol.atividade && sol.projeto) {
      const { data: outrosLancs } = await db
        .from("lancamentos")
        .select("id, viagens(id)")
        .ilike("atividade", sol.atividade)
        .neq("id", sol.lancamentoId);

      if (outrosLancs && outrosLancs.length > 0) {
        for (const ol of outrosLancs) {
          const vId = Array.isArray(ol.viagens) ? ol.viagens[0]?.id : (ol.viagens as any)?.id;
          if (vId) {
            await db.from("viagens").update({
              custo_1: c1,
              custo_2: c2,
              custo_3: c3,
              custo_4: c4,
              custo_5: c5,
              observacao_agencia: sol.observacoesSolicitante || null,
            }).eq("id", vId);
          }
        }
      }
    }

    // 3. Atualizar repasse na tabela lancamentos caso já haja repasse cadastrado (limitado ao total da viagem)
    if (sol.lancamentoId) {
      const { data: lancAtual } = await db.from("lancamentos").select("repasse").eq("id", sol.lancamentoId).maybeSingle();
      if (lancAtual && lancAtual.repasse && lancAtual.repasse > totalViagem && totalViagem > 0) {
        await db.from("lancamentos").update({ repasse: totalViagem }).eq("id", sol.lancamentoId);
      }
    }
  } catch (err) {
    console.warn("Aviso ao sincronizar viagem com Supabase:", err);
  }
}
