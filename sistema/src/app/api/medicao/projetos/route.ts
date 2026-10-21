import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const consultorNome = searchParams.get("consultor_nome") || "";
    const ano = searchParams.get("ano") || "2026";
    const mesNum = Number(searchParams.get("mes")) || 9;

    const db = supabaseAdmin();

    // 1. Buscar lista de consultores para localizar o consultor_id
    const { data: consultoresList, error: errCons } = await db
      .from("consultores")
      .select("id, nome, tipo");

    if (errCons) {
      return NextResponse.json({ error: errCons.message }, { status: 500 });
    }

    const norm = (str: string) =>
      (str || "")
        .toUpperCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();

    const qNome = norm(consultorNome);

    // Encontrar o consultor por matching exato ou parcial
    let matchedConsultor = (consultoresList || []).find((c) => {
      const cNome = norm(c.nome);
      return cNome === qNome || cNome.includes(qNome) || qNome.includes(cNome);
    });

    if (!matchedConsultor && consultorNome) {
      // Tentar primeiras 2 palavras
      const parts = qNome.split(" ");
      if (parts.length >= 2) {
        const twoParts = `${parts[0]} ${parts[1]}`;
        matchedConsultor = (consultoresList || []).find((c) => {
          const cNome = norm(c.nome);
          return cNome.includes(twoParts) || twoParts.includes(cNome);
        });
      }
    }

    // 2. Anos disponíveis na base geral
    const { data: compGeral } = await db
      .from("lancamentos")
      .select("competencia")
      .limit(2000);

    const todosAnos = Array.from(
      new Set(
        (compGeral || [])
          .map((l) => (l.competencia ? Number(l.competencia.split("-")[0]) : 2026))
          .filter((a) => !isNaN(a))
      )
    ).sort();

    if (!todosAnos.includes(2026)) todosAnos.push(2026);
    if (!todosAnos.includes(2027)) todosAnos.push(2027);

    if (!matchedConsultor) {
      return NextResponse.json({
        consultor: null,
        mesesComLancamentos: [],
        anosDisponiveis: todosAnos,
        lancamentos: [],
      });
    }

    // 3. Buscar todas as competências que possuem lançamentos para este consultor
    const { data: todasCompDoConsultor } = await db
      .from("lancamentos")
      .select("competencia")
      .eq("consultor_id", matchedConsultor.id);

    const prefixoAno = `${ano}-`;
    const mesesComLancamentos = Array.from(
      new Set(
        (todasCompDoConsultor || [])
          .filter((l) => l.competencia && l.competencia.startsWith(prefixoAno))
          .map((l) => Number(l.competencia.split("-")[1]))
          .filter((m) => !isNaN(m))
      )
    ).sort((a, b) => a - b);

    // 4. Buscar lançamentos específicos da competência solicitada
    const compAlvo = `${ano}-${String(mesNum).padStart(2, "0")}-01`;
    const { data: lancsCompetencia, error: errLancs } = await db
      .from("lancamentos")
      .select("id, competencia, atividade, horas, custo_consultor, repasse, data_inicial, data_final, status, projetos(nome, centros_custo(codigo, lideres(id, nome)))")
      .eq("consultor_id", matchedConsultor.id)
      .eq("competencia", compAlvo);

    if (errLancs) {
      return NextResponse.json({ error: errLancs.message }, { status: 500 });
    }

    const formatarDataBr = (d: string | null) => {
      if (!d) return null;
      if (d.includes("-")) {
        const [y, m, dia] = d.split("T")[0].split("-");
        return `${dia}/${m}/${y}`;
      }
      return d;
    };

    let liderDetectado: string | null = null;

    // Formatar atividades para uso imediato no BM
    const atividades = (lancsCompetencia || []).map((l: any) => {
      const horas = Number(l.horas) || 0;
      const valorTotal = Number(l.custo_consultor ?? l.repasse ?? 0);
      const valorHora = horas > 0 ? Number((valorTotal / horas).toFixed(2)) : valorTotal;
      const projetoNome = l.projetos?.nome || "PROJETO NNÓS";
      const cc = (l.projetos as any)?.centros_custo;
      const ccCodigo = cc?.codigo || "01.07.010.039";
      const lidNome = cc?.lideres?.nome || null;
      if (lidNome && !liderDetectado) {
        liderDetectado = lidNome;
      }

      return {
        id: l.id,
        centroCusto: ccCodigo,
        projeto: projetoNome,
        liderProjeto: lidNome,
        atividade: l.atividade,
        dataInicial: l.data_inicial || null,
        dataFinal: l.data_final || null,
        dataInicialBr: formatarDataBr(l.data_inicial),
        dataFinalBr: formatarDataBr(l.data_final),
        periodo: l.data_inicial && l.data_final ? `${formatarDataBr(l.data_inicial)} a ${formatarDataBr(l.data_final)}` : `Competência ${mesNum}/${ano}`,
        horas,
        valorHora,
        valorTotal,
        rateioInterno: "0,00%",
      };
    });

    return NextResponse.json({
      consultor: matchedConsultor,
      liderDetectado,
      mesesComLancamentos,
      anosDisponiveis: todosAnos,
      competencia: compAlvo,
      totalLancamentos: atividades.length,
      lancamentos: atividades,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
