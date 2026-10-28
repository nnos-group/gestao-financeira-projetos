import { sincronizarSolicitacoesIniciais } from "@/lib/viagens-service";
import ViagensDashboardClient from "@/components/viagens/ViagensDashboardClient";
import { supabaseAdmin } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

interface SearchParamsProps {
  ano?: string;
  mes?: string;
}

export default async function ViagensPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsProps>;
}) {
  const sp = await searchParams;
  const db = supabaseAdmin();

  // Anos disponíveis: menor e maior competência (1 linha cada, em paralelo) em vez de baixar 3000 linhas
  const [minCompRes, maxCompRes] = await Promise.all([
    db.from("lancamentos").select("competencia").not("competencia", "is", null).order("competencia", { ascending: true }).limit(1),
    db.from("lancamentos").select("competencia").not("competencia", "is", null).order("competencia", { ascending: false }).limit(1),
  ]);
  const anoDe = (r: { data: { competencia: string | null }[] | null }) => {
    const c = r.data?.[0]?.competencia;
    return c ? Number(c.split("-")[0]) : NaN;
  };
  const anoMin = Math.max(2020, anoDe(minCompRes));
  const anoMax = anoDe(maxCompRes);

  const anosDisponiveis: number[] = [];
  if (!isNaN(anoMin) && !isNaN(anoMax)) {
    for (let a = anoMin; a <= anoMax; a++) anosDisponiveis.push(a);
  }

  if (anosDisponiveis.length === 0) {
    anosDisponiveis.push(2025, 2026, 2027);
  }

  const anoSelecionado = anosDisponiveis.includes(Number(sp.ano))
    ? Number(sp.ano)
    : 2026;

  // Se sp.mes não for informado ou for vazio, mesSelecionado é null (modo Ano Inteiro)
  const mesSelecionado = sp.mes ? Math.min(12, Math.max(1, Number(sp.mes))) : null;

  // Sincroniza e obtém as solicitações do ano
  const todasSolicitacoes = await sincronizarSolicitacoesIniciais(String(anoSelecionado));

  let listaFinal = todasSolicitacoes;

  if (mesSelecionado) {
    // Filtro por mês específico
    const prefixoMes = `${anoSelecionado}-${String(mesSelecionado).padStart(2, "0")}`;
    const filtradas = todasSolicitacoes.filter((s) => s.dataInicial && s.dataInicial.startsWith(prefixoMes));
    listaFinal = filtradas;
  } else {
    // Filtro por ano completo (todos os dados do ano)
    const prefixoAno = `${anoSelecionado}-`;
    const filtradas = todasSolicitacoes.filter((s) => s.dataInicial && s.dataInicial.startsWith(prefixoAno));
    listaFinal = filtradas.length > 0 ? filtradas : todasSolicitacoes;
  }

  return (
    <ViagensDashboardClient
      solicitacoesIniciais={listaFinal}
      anoSelecionado={anoSelecionado}
      mesSelecionado={mesSelecionado}
      anosDisponiveis={anosDisponiveis}
    />
  );
}

