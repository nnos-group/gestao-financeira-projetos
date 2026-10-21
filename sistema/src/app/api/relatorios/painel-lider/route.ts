import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const MESES = [
  "JANEIRO",
  "FEVEREIRO",
  "MARÇO",
  "ABRIL",
  "MAIO",
  "JUNHO",
  "JULHO",
  "AGOSTO",
  "SETEMBRO",
  "OUTUBRO",
  "NOVEMBRO",
  "DEZEMBRO",
];

const METAS_OFICIAIS: Record<string, number> = {
  "INNOVATION": 300000,
  "DEALER DEVELOPMENT": 1500000,
  "OUTSOURCING": 8000000,
  "HRD - HUMAN RESOURCE DEVELOPMENT": 3500000,
  "BUSINESS SOLUTIONS": 1700000,
  "EDUCAÇÃO": 0,
};

function normalizarAreaNome(area: string): string {
  const a = (area || "").toUpperCase().trim();
  if (a.includes("HRD") || a.includes("HUMAN")) return "HRD - HUMAN RESOURCE DEVELOPMENT";
  if (a.includes("DEALER")) return "DEALER DEVELOPMENT";
  if (a.includes("OUTSOURCING")) return "OUTSOURCING";
  if (a.includes("BUSINESS") || a.includes("SOLUTIONS")) return "BUSINESS SOLUTIONS";
  if (a.includes("INNOVAT")) return "INNOVATION";
  if (a.includes("EDUCA")) return "EDUCAÇÃO";
  if (a.includes("TI")) return "TI";
  if (a.includes("ADM") || a.includes("CONTROLE")) return "ADM E CONTROLE";
  if (a.includes("DIRETORIA")) return "DIRETORIA";
  return a || "OUTROS";
}

function getAvatarGradiente(iniciais: string): string {
  const cores = [
    "from-purple-600 to-indigo-600",
    "from-blue-600 to-cyan-600",
    "from-emerald-600 to-teal-600",
    "from-amber-500 to-orange-600",
    "from-rose-600 to-pink-600",
    "from-sky-600 to-blue-700",
    "from-indigo-600 to-purple-700",
  ];
  let hash = 0;
  for (let i = 0; i < iniciais.length; i++) {
    hash = (hash << 5) - hash + iniciais.charCodeAt(i);
  }
  return cores[Math.abs(hash) % cores.length];
}

function getIniciais(nome: string): string {
  const parts = (nome || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "NN";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatarNome(nome: string): string {
  if (!nome) return "Sem Líder";
  return nome
    .toLowerCase()
    .split(" ")
    .map((w) => {
      if (["de", "da", "do", "das", "dos", "e"].includes(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(" ");
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const db = supabaseAdmin();

    // 1. Descobrir anos disponíveis
    const { data: compList } = await db
      .from("lancamentos")
      .select("competencia")
      .not("competencia", "is", null)
      .limit(3000);

    const anosDisponiveis = Array.from(
      new Set(
        (compList || [])
          .map((l) => (l.competencia ? Number(l.competencia.split("-")[0]) : null))
          .filter((a): a is number => typeof a === "number" && !isNaN(a) && a >= 2020)
      )
    ).sort((a, b) => b - a);

    if (anosDisponiveis.length === 0) anosDisponiveis.push(2026);

    const anoParam = Number(searchParams.get("ano"));
    const anoSelecionado = anosDisponiveis.includes(anoParam)
      ? anoParam
      : anosDisponiveis.includes(2026)
      ? 2026
      : anosDisponiveis[0];

    // 2. Alíquota de impostos oficial
    let impostoPct = 12.25;
    try {
      const { data: cfg } = await db
        .from("configuracoes")
        .select("valor")
        .eq("chave", "imposto_pct")
        .maybeSingle();
      if (cfg?.valor) impostoPct = Number(cfg.valor);
    } catch {
      // fallback 12.25
    }

    // 3. Buscar todos os lançamentos do ano com paginação
    const todosLancamentos: any[] = [];
    for (let from = 0; ; from += 1000) {
      const { data: chunk, error } = await db
        .from("lancamentos")
        .select(`
          id, competencia, faturar, repasse, custo_consultor, status,
          projetos (
            id, nome,
            centros_custo (
              codigo,
              areas (id, nome),
              lideres (id, nome)
            )
          ),
          viagens (total)
        `)
        .gte("competencia", `${anoSelecionado}-01-01`)
        .lte("competencia", `${anoSelecionado}-12-31`)
        .range(from, from + 999);

      if (error) throw new Error(error.message);
      todosLancamentos.push(...(chunk || []));
      if (!chunk || chunk.length < 1000) break;
    }

    // 4. Buscar faturamento detalhado se existir (para painel previsto vs realizado)
    let faturamentoBase: any[] = [];
    try {
      const fatPath = path.join(process.cwd(), "src", "lib", "faturamento-base.json");
      if (fs.existsSync(fatPath)) {
        faturamentoBase = JSON.parse(fs.readFileSync(fatPath, "utf8"));
      }
    } catch (e) {
      console.warn("Aviso ao ler faturamento-base.json:", e);
    }

    // 5. Agrupamento por Líder e Projeto
    const lideresMap: Record<string, {
      id: string;
      nome: string;
      iniciais: string;
      cargo: string;
      avatarGradiente: string;
      receita: number;
      custosConsultores: number;
      custosLogistica: number;
      repasse: number;
      custosConsolidados: number;
      custosPct: number;
      impostos: number;
      margem: number;
      margemPct: number;
      statusMargem: "saudavel" | "estavel" | "alerta" | "prejuizo";
      projetosMap: Record<string, any>;
    }> = {};

    const projetosTotais: any[] = [];
    const receitasPorArea: Record<string, number> = {
      "INNOVATION": 0,
      "DEALER DEVELOPMENT": 0,
      "OUTSOURCING": 0,
      "HRD - HUMAN RESOURCE DEVELOPMENT": 0,
      "BUSINESS SOLUTIONS": 0,
      "EDUCAÇÃO": 0,
      "TI": 0,
      "ADM E CONTROLE": 0,
      "DIRETORIA": 0,
    };

    // Dados mensais para Faturamento Previsto vs Realizado
    const faturamentoProjetosMap: Record<string, {
      titulo: string;
      lider: string;
      area: string;
      previsto: Record<string, number>;
      realizado: Record<string, number>;
      aberto: Record<string, number>;
      atrasado: Record<string, number>;
    }> = {};

    for (const l of todosLancamentos) {
      const proj = l.projetos;
      const cc = proj?.centros_custo;
      const liderObj = cc?.lideres;
      const areaObj = cc?.areas;

      const liderNomeCru = liderObj?.nome || "SEM LÍDER";
      const liderNome = formatarNome(liderNomeCru);
      const projNome = proj?.nome || "Projeto Sem Nome";
      const areaNome = normalizarAreaNome(areaObj?.nome || "");

      const faturar = Number(l.faturar) || 0;
      const custo = Number(l.custo_consultor) || 0;
      const logistica = Number(l.viagens?.[0]?.total || l.viagens?.total) || 0;
      const repasse = Number(l.repasse) || 0;

      // Inicializa Líder
      if (!lideresMap[liderNome]) {
        const iniciais = getIniciais(liderNomeCru);
        lideresMap[liderNome] = {
          id: liderObj?.id || liderNome.toLowerCase().replace(/\s+/g, "-"),
          nome: liderNome,
          iniciais,
          cargo: "Líder de Projetos Corporativos",
          avatarGradiente: getAvatarGradiente(iniciais),
          receita: 0,
          custosConsultores: 0,
          custosLogistica: 0,
          repasse: 0,
          custosConsolidados: 0,
          custosPct: 0,
          impostos: 0,
          margem: 0,
          margemPct: 0,
          statusMargem: "saudavel",
          projetosMap: {},
        };
      }

      const liderData = lideresMap[liderNome];
      liderData.receita += faturar;
      liderData.custosConsultores += custo;
      liderData.custosLogistica += logistica;
      liderData.repasse += repasse;

      // Inicializa Projeto do Líder
      if (!liderData.projetosMap[projNome]) {
        liderData.projetosMap[projNome] = {
          id: proj?.id || projNome,
          titulo: projNome,
          lider: liderNome,
          area: areaNome,
          centroCusto: cc?.codigo || "—",
          receita: 0,
          custoConsultor: 0,
          custoLogistica: 0,
          repasse: 0,
          custoTotal: 0,
          impostos: 0,
          margem: 0,
          margemPct: 0,
          pctImpostos: 0,
          pctCustos: 0,
          pctLogistica: 0,
          pctRepasse: 0,
        };
      }

      const pData = liderData.projetosMap[projNome];
      pData.receita += faturar;
      pData.custoConsultor += custo;
      pData.custoLogistica += logistica;
      pData.repasse += repasse;

      // Acumula na área
      receitasPorArea[areaNome] = (receitasPorArea[areaNome] || 0) + faturar;

      // Mês da competência para faturamento
      if (l.competencia) {
        const mesIndex = Number(l.competencia.split("-")[1]) - 1;
        const mesNome = MESES[mesIndex] || "JANEIRO";

        if (!faturamentoProjetosMap[projNome]) {
          const initMeses = () => ({
            TOTAL: 0,
            JANEIRO: 0,
            FEVEREIRO: 0,
            MARÇO: 0,
            ABRIL: 0,
            MAIO: 0,
            JUNHO: 0,
            JULHO: 0,
            AGOSTO: 0,
            SETEMBRO: 0,
            OUTUBRO: 0,
            NOVEMBRO: 0,
            DEZEMBRO: 0,
          });
          faturamentoProjetosMap[projNome] = {
            titulo: projNome,
            lider: liderNome,
            area: areaNome,
            previsto: initMeses(),
            realizado: initMeses(),
            aberto: initMeses(),
            atrasado: initMeses(),
          };
        }

        const fatProj = faturamentoProjetosMap[projNome];
        // Previsto nos lançamentos equivale ao faturar planejado
        fatProj.previsto[mesNome] = (fatProj.previsto[mesNome] || 0) + faturar;
        fatProj.previsto.TOTAL += faturar;

        // Se o status indicar concluído ou pago, entra como realizado
        const st = (l.status || "").toUpperCase();
        if (st.includes("FATURAD") || st.includes("PAG") || st.includes("REALIZ") || st.includes("CONCLU")) {
          fatProj.realizado[mesNome] = (fatProj.realizado[mesNome] || 0) + faturar;
          fatProj.realizado.TOTAL += faturar;
        } else if (faturar > 0) {
          fatProj.aberto[mesNome] = (fatProj.aberto[mesNome] || 0) + faturar;
          fatProj.aberto.TOTAL += faturar;
        }
      }
    }

    // Se houver notas no faturamento-base, podemos sincronizar faturamento realizado real
    if (faturamentoBase && faturamentoBase.length > 0) {
      for (const f of faturamentoBase) {
        const pNome = (f.projeto || "").trim().toUpperCase();
        if (!pNome) continue;

        // Encontrar o projeto correspondente no map
        const key = Object.keys(faturamentoProjetosMap).find(
          (k) => k.trim().toUpperCase() === pNome
        );

        if (key) {
          const fatProj = faturamentoProjetosMap[key];
          const valor = Number(f.valor) || 0;
          const realMes = (f.realizado || "").trim().toUpperCase();

          if (MESES.includes(realMes)) {
            // Se já tínhamos calculado do Supabase, o faturamento-base atua como calibração contábil
            const st = (f.status || "").toLowerCase();
            if (st === "pago") {
              fatProj.realizado[realMes] = (fatProj.realizado[realMes] || 0);
            } else if (st === "aberto") {
              fatProj.aberto[realMes] = (fatProj.aberto[realMes] || 0);
            } else if (st.includes("atras")) {
              fatProj.atrasado[realMes] = (fatProj.atrasado[realMes] || 0) + valor;
              fatProj.atrasado.TOTAL += valor;
            }
          }
        }
      }
    }

    // 6. Finalizar cálculos por Líder e por Projeto
    let totalReceitaGeral = 0;
    let totalCustosGeral = 0;
    let totalImpostosGeral = 0;
    let totalMargemGeral = 0;

    const lideresFinais = Object.values(lideresMap)
      .filter((l) => l.receita > 0 || l.custosConsolidados > 0)
      .map((lider) => {
        lider.custosConsolidados = lider.custosConsultores + lider.custosLogistica + lider.repasse;
        lider.impostos = (lider.receita * impostoPct) / 100;
        lider.margem = lider.receita - lider.impostos - lider.custosConsolidados;
        lider.margemPct = lider.receita > 0 ? (lider.margem / lider.receita) * 100 : 0;
        lider.custosPct = lider.receita > 0 ? (lider.custosConsolidados / lider.receita) * 100 : 0;

        if (lider.margemPct >= 15) lider.statusMargem = "saudavel";
        else if (lider.margemPct >= 0) lider.statusMargem = "estavel";
        else lider.statusMargem = "prejuizo";

        totalReceitaGeral += lider.receita;
        totalCustosGeral += lider.custosConsolidados;
        totalImpostosGeral += lider.impostos;
        totalMargemGeral += lider.margem;

        const projetosList = Object.values(lider.projetosMap).map((p: any) => {
          p.custoTotal = p.custoConsultor + p.custoLogistica + p.repasse;
          p.impostos = (p.receita * impostoPct) / 100;
          p.margem = p.receita - p.impostos - p.custoTotal;
          p.margemPct = p.receita > 0 ? (p.margem / p.receita) * 100 : 0;

          const baseRec = p.receita > 0 ? p.receita : 1;
          p.pctImpostos = (p.impostos / baseRec) * 100;
          p.pctCustos = (p.custoConsultor / baseRec) * 100;
          p.pctLogistica = (p.custoLogistica / baseRec) * 100;
          p.pctRepasse = (p.repasse / baseRec) * 100;

          if (p.margemPct >= 15) p.statusMargem = "saudavel";
          else if (p.margemPct >= 0) p.statusMargem = "estavel";
          else p.statusMargem = "prejuizo";

          projetosTotais.push(p);
          return p;
        });

        // Ordenar projetos do líder por receita decrescente
        projetosList.sort((a: any, b: any) => b.receita - a.receita);

        return {
          id: lider.id,
          nome: lider.nome,
          iniciais: lider.iniciais,
          cargo: lider.cargo,
          avatarGradiente: lider.avatarGradiente,
          totalProjetos: projetosList.length,
          receita: lider.receita,
          custosConsultores: lider.custosConsultores,
          custosLogistica: lider.custosLogistica,
          repasse: lider.repasse,
          custosConsolidados: lider.custosConsolidados,
          custosPct: lider.custosPct,
          impostos: lider.impostos,
          margem: lider.margem,
          margemPct: lider.margemPct,
          statusMargem: lider.statusMargem,
          projetos: projetosList,
        };
      });

    // Ordenar líderes por receita decrescente
    lideresFinais.sort((a, b) => b.receita - a.receita);

    // 7. Rankings de Rentabilidade
    // Top rentáveis (maior margem em R$, com receita > 0)
    const ordenadosMargem = [...projetosTotais].sort((a, b) => b.margem - a.margem);
    const top1a10 = ordenadosMargem.slice(0, 10).map((p, idx) => ({ ...p, rank: idx + 1 }));
    const top11a20 = ordenadosMargem.slice(10, 20).map((p, idx) => ({ ...p, rank: idx + 11 }));

    // Bottom menos rentáveis (ordenados pela margem menor / mais negativa)
    const ordenadosMenorMargem = [...projetosTotais]
      .filter((p) => p.margem < 0 || p.margemPct < 10)
      .sort((a, b) => a.margem - b.margem);
    const bottom10 = ordenadosMenorMargem.slice(0, 10).map((p, idx) => ({ ...p, rank: idx + 1 }));

    // 8. Metas por Área
    let totalMetaGeral = 0;
    let totalRealizadoMetaGeral = 0;

    const metasPorArea = Object.entries(METAS_OFICIAIS).map(([area, meta]) => {
      const realizado = receitasPorArea[area] || 0;
      totalMetaGeral += meta;
      totalRealizadoMetaGeral += realizado;

      const atingidoPct = meta > 0 ? (realizado / meta) * 100 : 0;
      const falta = Math.max(0, meta - realizado);
      const faltaPct = meta > 0 ? (falta / meta) * 100 : 0;

      let situacao = "EM ANDAMENTO";
      if (meta === 0) situacao = "SEM META";
      else if (atingidoPct >= 100) situacao = "ATINGIDA";
      else if (atingidoPct < 30) situacao = "ATENÇÃO";

      return {
        area,
        meta,
        realizado,
        atingidoPct,
        falta,
        faltaPct,
        situacao,
      };
    });

    const atingidoGeralPct = totalMetaGeral > 0 ? (totalRealizadoMetaGeral / totalMetaGeral) * 100 : 0;
    const faltaGeral = Math.max(0, totalMetaGeral - totalRealizadoMetaGeral);
    const faltaGeralPct = totalMetaGeral > 0 ? (faltaGeral / totalMetaGeral) * 100 : 0;

    const metaGeral = {
      area: `META GERAL ${anoSelecionado}`,
      meta: totalMetaGeral,
      realizado: totalRealizadoMetaGeral,
      atingidoPct: atingidoGeralPct,
      falta: faltaGeral,
      faltaPct: faltaGeralPct,
      situacao: atingidoGeralPct >= 100 ? "ATINGIDA" : "EM ANDAMENTO",
    };

    // 9. Faturamento por Projeto Lista
    const faturamentoProjetosLista = Object.values(faturamentoProjetosMap).sort(
      (a, b) => (b.previsto.TOTAL || 0) - (a.previsto.TOTAL || 0)
    );

    return NextResponse.json({
      ano: anoSelecionado,
      anosDisponiveis,
      impostoPct,
      totaisGerais: {
        receitaTotal: totalReceitaGeral,
        custosTotais: totalCustosGeral,
        impostosTotais: totalImpostosGeral,
        margemTotal: totalMargemGeral,
        margemPctTotal: totalReceitaGeral > 0 ? (totalMargemGeral / totalReceitaGeral) * 100 : 0,
        totalProjetos: projetosTotais.length,
        totalLideres: lideresFinais.length,
      },
      lideres: lideresFinais,
      rankings: {
        top1a10,
        top11a20,
        bottom10,
      },
      metasPorArea: {
        areas: metasPorArea,
        geral: metaGeral,
      },
      faturamentoProjetos: faturamentoProjetosLista,
    });
  } catch (error: any) {
    console.error("Erro na API Painel por Líder:", error);
    return NextResponse.json(
      { error: error?.message || "Erro interno ao processar dados do Painel por Líder." },
      { status: 500 }
    );
  }
}
