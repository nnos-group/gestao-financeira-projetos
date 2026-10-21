import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { garantirSolicitacaoAtividade } from "@/lib/viagens-service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const db = supabaseAdmin();

    const {
      projeto_id,
      consultor_id,
      competencia,
      atividade,
      modalidade,
      local,
      regiao = "BRA",
      data_inicial,
      data_final,
      perfil,
      horas,
      faturar,
      repasse,
      custo_consultor,
      status = "CONFIRMADO",
      precisa_logistica = false,
    } = body;

    if (!projeto_id) {
      return NextResponse.json({ error: "O Projeto é obrigatório." }, { status: 400 });
    }

    if (!atividade || !atividade.trim()) {
      return NextResponse.json({ error: "O nome da Atividade é obrigatório." }, { status: 400 });
    }

    // Validação de Período Operacional: a atividade deve iniciar e terminar no mesmo mês
    if (data_inicial && data_final && typeof data_inicial === "string" && typeof data_final === "string") {
      const mesIni = data_inicial.slice(0, 7);
      const mesFim = data_final.slice(0, 7);
      if (mesIni !== mesFim) {
        return NextResponse.json(
          {
            error:
              "O período da atividade deve ficar exclusivamente dentro do mesmo mês. Atividades que cruzam a virada do mês devem ser desmembradas em dois lançamentos (ex: até o último dia do mês e do primeiro dia em diante no mês seguinte). A logística completa deve ser vinculada ao primeiro lançamento.",
          },
          { status: 400 }
        );
      }
    }

    // Deriva a competência a partir da data_inicial se disponível, para manter consistência cronológica
    let compFinal = competencia;
    if (data_inicial && typeof data_inicial === "string" && data_inicial.length >= 7) {
      compFinal = `${data_inicial.slice(0, 7)}-01`;
    }

    if (!compFinal) {
      return NextResponse.json({ error: "A competência é obrigatória." }, { status: 400 });
    }

    const payload = {
      projeto_id,
      consultor_id: consultor_id || null,
      competencia: compFinal,
      atividade: atividade.trim(),
      modalidade: modalidade || null,
      local: local?.trim() || null,
      regiao: regiao || "BRA",
      data_inicial: data_inicial || null,
      data_final: data_final || null,
      perfil: perfil || null,
      horas: horas != null && !isNaN(Number(horas)) ? Number(horas) : null,
      faturar: faturar != null && !isNaN(Number(faturar)) ? Number(faturar) : null,
      repasse: repasse != null && !isNaN(Number(repasse)) ? Number(repasse) : null,
      custo_consultor: custo_consultor != null && !isNaN(Number(custo_consultor)) ? Number(custo_consultor) : null,
      status: status || "CONFIRMADO",
      precisa_logistica: !!precisa_logistica,
      criado_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
    };

    const { data: lancamento, error } = await db
      .from("lancamentos")
      .insert(payload)
      .select("*, projetos(id, nome), consultores(id, nome, tipo), viagens(*)")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Se demanda logística for verdadeira, inicializa o registro de viagem com agência e instruções
    if (precisa_logistica && lancamento) {
      const { data: viagem } = await db
        .from("viagens")
        .insert({
          lancamento_id: lancamento.id,
          agencia: body.agencia || "FÁTIMA",
          observacao_agencia: body.observacao_agencia || null,
          custo_1: 0,
          custo_2: 0,
          custo_3: 0,
          custo_4: 0,
          custo_5: 0,
        })
        .select()
        .single();

      if (viagem) {
        lancamento.viagens = [viagem];
      }

      // Dispara esteira do Módulo Viagens & Logística de forma assíncrona/segura
      try {
        await garantirSolicitacaoAtividade(lancamento.id, {
          viagemId: viagem?.id,
          projeto: body.projeto_nome,
          atividade: body.atividade,
          consultor: body.consultor_nome,
          perfil: body.perfil,
          local: body.local,
          dataInicial: body.data_inicial,
          dataFinal: body.data_final,
          horas: body.horas,
          agencia: body.agencia || "FÁTIMA",
          observacoes: body.observacao_agencia,
        });
      } catch (errLog) {
        console.warn("Aviso ao abrir solicitação de logística:", errLog);
      }
    }

    return NextResponse.json({ success: true, data: lancamento }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projetoId = searchParams.get("projeto_id");
    const projetoNome = searchParams.get("projeto_nome");
    const competencia = searchParams.get("competencia");
    const db = supabaseAdmin();

    if (!projetoId && (!projetoNome || !projetoNome.trim())) {
      // Exige obrigatoriamente projeto para não carregar excesso de atividades de outros projetos
      return NextResponse.json({ success: true, data: [] });
    }

    let query = db
      .from("lancamentos")
      .select("id, atividade, competencia, data_inicial, data_final, repasse, consultores(id, nome), projetos(id, nome)")
      .order("data_inicial", { ascending: false });

    if (projetoId) {
      query = query.eq("projeto_id", projetoId);
    } else if (projetoNome && projetoNome.trim()) {
      const termo = projetoNome.trim();
      const { data: proj } = await db
        .from("projetos")
        .select("id, nome")
        .ilike("nome", `%${termo}%`)
        .limit(1);

      if (proj && proj[0]) {
        query = query.eq("projeto_id", proj[0].id);
      } else {
        return NextResponse.json({ success: true, data: [] });
      }
    }

    if (competencia && competencia.trim()) {
      query = query.ilike("competencia", `${competencia.trim()}%`);
    }

    const { data, error } = await query.limit(100);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: data || [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, repasse } = body;
    if (!id) {
      return NextResponse.json({ error: "ID do lançamento é obrigatório." }, { status: 400 });
    }

    const db = supabaseAdmin();
    const { data, error } = await db
      .from("lancamentos")
      .update({ repasse: Number(repasse) || 0, atualizado_em: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
