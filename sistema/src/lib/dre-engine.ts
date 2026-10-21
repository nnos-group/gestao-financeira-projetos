// Motor de cálculo do Financial Analysis e da DRE Gerencial.
// Substitui a planilha "Financial Analysis": tudo é recalculado a partir dos lançamentos do sistema
// + parâmetros mensais (salários, despesas operacionais, resultado financeiro etc.).

export const UNIDADES = [
  "HRD",
  "DEALER DEVELOPMENT",
  "BUSINESS SOLUTIONS",
  "INNOVATION",
  "EDUCAÇÃO",
  "OUTSOURCING",
  "ADMINISTRATION",
] as const;
export type Unidade = (typeof UNIDADES)[number];

export const NOMES_UNIDADE: Record<Unidade, string> = {
  HRD: "HRD",
  "DEALER DEVELOPMENT": "Dealer Development",
  "BUSINESS SOLUTIONS": "Business Solutions",
  INNOVATION: "Innovation",
  EDUCAÇÃO: "Educação",
  OUTSOURCING: "Outsourcing",
  ADMINISTRATION: "Administration",
};

export interface LancamentoDRE {
  competencia: string | null;
  horas: number | string | null;
  faturar: number | string | null;
  repasse: number | string | null;
  custo_consultor: number | string | null;
  projetos?: { centros_custo?: { areas?: { nome?: string | null } | null } | null } | null;
  viagens?: { total?: number | string | null } | null;
}

export interface ParametrosMes {
  salarios: number;
  despesasOperacionais: number;
  publicidade: number;
  outras: number;
  resultadoFinanceiro: number;
}
export interface ParametrosAno {
  aliquotaImpostos: number; // %
  percentualComissao: number; // %
  meses: Record<string, ParametrosMes>;
}

export interface ColunaFA {
  dias: number;
  receita: number;
  impostos: number;
  receitaLiquida: number;
  custoConsultoria: number;
  comissoes: number;
  gastosVariaveis: number;
  margemContribuicao: number;
  salarios: number;
  logistica: number;
  repasse: number; // negativo (reduz o gasto)
  publicidade: number;
  despesasOperacionais: number;
  outras: number;
  gastosFixos: number;
  lucroOperacional: number;
  rateioAdm: number;
  lopGerencial: number;
}

export interface ResultadoFA {
  unidades: Record<Unidade, ColunaFA>;
  total: ColunaFA;
  resultadoFinanceiro: number;
  lair: number;
  provisaoIr: number;
  lucroLiquido: number;
}

export interface ResultadoDRE {
  receita: number;
  impostos: number;
  receitaLiquida: number;
  custoConsultoria: number;
  comissoes: number;
  lucroBruto: number;
  despesasLogistica: number;
  repasseLogistica: number;
  margemContribuicao: number;
  custoFixo: number;
  resultadoFinanceiro: number;
  provisaoIr: number;
  lucroLiquido: number;
}

export interface MesAdministration {
  mes: number;
  nomeMes: string;
  salarios: number;
  logistica: number;
  repasse: number;
  publicidade: number;
  despesasOperacionais: number;
  outras: number;
  gastosFixos: number;
  lucroOperacional: number;
  resultadoFinanceiro: number;
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function normalizarUnidade(area?: string | null): Unidade {
  const a = (area || "").trim().toUpperCase();
  if (a.startsWith("HRD")) return "HRD";
  if (a.includes("DEALER")) return "DEALER DEVELOPMENT";
  if (a.includes("BUSINESS")) return "BUSINESS SOLUTIONS";
  if (a.includes("INNOVATION")) return "INNOVATION";
  if (a.includes("EDUCA")) return "EDUCAÇÃO";
  if (a.includes("OUTSOURCING")) return "OUTSOURCING";
  // DIRETORIA, ADM E CONTROLE e áreas não mapeadas compõem Administration
  return "ADMINISTRATION";
}

const colunaVazia = (): ColunaFA => ({
  dias: 0, receita: 0, impostos: 0, receitaLiquida: 0, custoConsultoria: 0, comissoes: 0,
  gastosVariaveis: 0, margemContribuicao: 0, salarios: 0, logistica: 0, repasse: 0,
  publicidade: 0, despesasOperacionais: 0, outras: 0, gastosFixos: 0, lucroOperacional: 0,
  rateioAdm: 0, lopGerencial: 0,
});

const somar = (cols: ColunaFA[]): ColunaFA => {
  const t = colunaVazia();
  (Object.keys(t) as (keyof ColunaFA)[]).forEach((k) => {
    t[k] = cols.reduce((a, c) => a + c[k], 0);
  });
  return t;
};

function mesDe(comp: string | null): number {
  const m = Number((comp || "").split("-")[1]);
  return m >= 1 && m <= 12 ? m : 0;
}

export function calcularFinancialAnalysis(
  lancs: LancamentoDRE[],
  params: ParametrosAno,
  mesInicial = 1,
  mesFinal = 12,
  receitasFaturadas?: Partial<Record<Unidade, number>>
): ResultadoFA {
  const aliq = num(params.aliquotaImpostos) / 100;
  const comis = num(params.percentualComissao) / 100;
  const un = Object.fromEntries(UNIDADES.map((u) => [u, colunaVazia()])) as Record<Unidade, ColunaFA>;

  // 1) Agregação dos lançamentos
  for (const l of lancs) {
    const m = mesDe(l.competencia);
    if (m < mesInicial || m > mesFinal) continue;
    const u = normalizarUnidade(l.projetos?.centros_custo?.areas?.nome);
    const c = un[u];
    c.dias += num(l.horas) / 8;
    c.receita += num(l.faturar);
    c.custoConsultoria += num(l.custo_consultor);
    c.logistica += num(l.viagens?.total);
    c.repasse -= num(l.repasse);
  }

  // Se estiver na visão FATURADO, substitui a receita prevista pela receita faturada nas NFs
  if (receitasFaturadas) {
    for (const u of UNIDADES) {
      un[u].receita = num(receitasFaturadas[u]);
    }
  }

  // 2) Parâmetros mensais (Administration) somados no período
  let salarios = 0, despOp = 0, publi = 0, outras = 0, resFin = 0;
  for (let m = mesInicial; m <= mesFinal; m++) {
    const p = params.meses?.[String(m)];
    if (!p) continue;
    salarios += num(p.salarios);
    despOp += num(p.despesasOperacionais);
    publi += num(p.publicidade);
    outras += num(p.outras);
    resFin += num(p.resultadoFinanceiro);
  }
  un.ADMINISTRATION.salarios = salarios;
  un.ADMINISTRATION.despesasOperacionais = despOp;
  un.ADMINISTRATION.publicidade = publi;
  un.ADMINISTRATION.outras = outras;

  // Regra da planilha: custo de consultoria da INNOVATION é tratado como despesa operacional (gasto fixo)
  un.INNOVATION.despesasOperacionais += un.INNOVATION.custoConsultoria;
  un.INNOVATION.custoConsultoria = 0;

  // Regra da planilha: o custo de pessoas da ADMINISTRATION (Diretoria e ADM e Controle) já está
  // contido nas Despesas Operacionais informadas nos parâmetros; não entra em Custo Consultoria.
  un.ADMINISTRATION.custoConsultoria = 0;

  // 3) Cascata por unidade
  for (const u of UNIDADES) {
    const c = un[u];
    c.impostos = c.receita * aliq;
    c.receitaLiquida = c.receita - c.impostos;
    c.comissoes = c.receita * comis;
    c.gastosVariaveis = c.custoConsultoria + c.comissoes;
    c.margemContribuicao = c.receitaLiquida - c.gastosVariaveis;
    c.gastosFixos = c.salarios + c.logistica + c.repasse + c.publicidade + c.despesasOperacionais + c.outras;
    c.lucroOperacional = c.margemContribuicao - c.gastosFixos;
  }

  const total = somar(UNIDADES.map((u) => un[u]));

  // 4) Rateio da Administration proporcional à margem de contribuição
  const lopAdm = un.ADMINISTRATION.lucroOperacional;
  const unidadesOperacionais = UNIDADES.filter((u) => u !== "ADMINISTRATION");
  const margemOpTotal = unidadesOperacionais.reduce((acc, u) => acc + un[u].margemContribuicao, 0);

  for (const u of UNIDADES) {
    const c = un[u];
    if (u === "ADMINISTRATION") {
      c.rateioAdm = 0;
      c.lopGerencial = 0;
      continue;
    }
    const share = margemOpTotal !== 0 ? c.margemContribuicao / margemOpTotal : 0;
    c.rateioAdm = (lopAdm * -1) * share;
    c.lopGerencial = c.lucroOperacional - c.rateioAdm;
  }
  total.rateioAdm = 0;
  total.lopGerencial = total.lucroOperacional;

  const lair = total.lucroOperacional + resFin;
  const provisaoIr = lair < 0 ? 0 : lair <= 20000 ? lair * 0.15 : lair * 0.25;
  return { unidades: un, total, resultadoFinanceiro: resFin, lair, provisaoIr, lucroLiquido: lair - provisaoIr };
}

export function calcularDRE(fa: ResultadoFA): ResultadoDRE {
  const t = fa.total;
  const lucroBruto = t.receitaLiquida - t.custoConsultoria - t.comissoes;
  const margemContribuicao = lucroBruto - (t.logistica + t.repasse);
  const custoFixo = t.salarios + t.publicidade + t.despesasOperacionais + t.outras;
  return {
    receita: t.receita,
    impostos: t.impostos,
    receitaLiquida: t.receitaLiquida,
    custoConsultoria: t.custoConsultoria,
    comissoes: t.comissoes,
    lucroBruto,
    despesasLogistica: t.logistica,
    repasseLogistica: t.repasse,
    margemContribuicao,
    custoFixo,
    resultadoFinanceiro: fa.resultadoFinanceiro,
    provisaoIr: fa.provisaoIr,
    lucroLiquido: fa.lucroLiquido, // Sincronizado para ter o mesmo resultado
  };
}

export function calcularAdministrationMensal(lancs: LancamentoDRE[], params: ParametrosAno): MesAdministration[] {
  const nomesMeses = [
    "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO",
    "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO",
  ];

  return nomesMeses.map((nomeMes, idx) => {
    const mesNum = idx + 1;
    let logistica = 0;
    let repasse = 0;

    for (const l of lancs) {
      if (mesDe(l.competencia) !== mesNum) continue;
      const u = normalizarUnidade(l.projetos?.centros_custo?.areas?.nome);
      if (u === "ADMINISTRATION") {
        logistica += num(l.viagens?.total);
        repasse -= num(l.repasse);
      }
    }

    const p = params.meses?.[String(mesNum)] || {
      salarios: 0,
      despesasOperacionais: 0,
      publicidade: 0,
      outras: 0,
      resultadoFinanceiro: 0,
    };

    const salarios = num(p.salarios);
    const publicidade = num(p.publicidade);
    const despesasOperacionais = num(p.despesasOperacionais);
    const outras = num(p.outras);
    const resultadoFinanceiro = num(p.resultadoFinanceiro);

    const gastosFixos = salarios + logistica + repasse + publicidade + despesasOperacionais + outras;
    const lucroOperacional = -gastosFixos;

    return {
      mes: mesNum,
      nomeMes,
      salarios,
      logistica,
      repasse,
      publicidade,
      despesasOperacionais,
      outras,
      gastosFixos,
      lucroOperacional,
      resultadoFinanceiro,
    };
  });
}

export function parametrosPadrao(): ParametrosAno {
  const meses: Record<string, ParametrosMes> = {};
  for (let m = 1; m <= 12; m++) {
    meses[String(m)] = { salarios: 0, despesasOperacionais: 0, publicidade: 0, outras: 0, resultadoFinanceiro: 0 };
  }
  return { aliquotaImpostos: 12.25, percentualComissao: 0, meses };
}
