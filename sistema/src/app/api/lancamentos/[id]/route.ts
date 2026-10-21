import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import {
  garantirSolicitacaoAtividade,
  removerSolicitacaoPorLancamento,
} from "@/lib/viagens-service";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const body = await request.json();
    const db = supabaseAdmin();

    // Campos permitidos para atualização
    const camposPermitidos = [
      "projeto_id",
      "consultor_id",
      "atividade",
      "modalidade",
      "local",
      "regiao",
      "data_inicial",
      "data_final",
      "perfil",
      "horas",
      "faturar",
      "repasse",
      "custo_consultor",
      "status",
      "precisa_logistica",
    ];

    const payload: Record<string, unknown> = {
      atualizado_em: new Date().toISOString(),
    };

    for (const key of camposPermitidos) {
      if (key in body) {
        payload[key] = body[key];
      }
    }

    // Validação de Período Operacional: a atividade deve iniciar e terminar no mesmo mês
    const novaDataIni = (payload.data_inicial as string) || (body.data_inicial as string);
    const novaDataFim = (payload.data_final as string) || (body.data_final as string);
    if (novaDataIni && novaDataFim && typeof novaDataIni === "string" && typeof novaDataFim === "string") {
      const mesIni = novaDataIni.slice(0, 7);
      const mesFim = novaDataFim.slice(0, 7);
      if (mesIni !== mesFim) {
        return NextResponse.json(
          {
            error:
              "O período da atividade deve ficar exclusivamente dentro do mesmo mês. Atividades que cruzam a virada do mês devem ser divididas em dois lançamentos distintos.",
          },
          { status: 400 }
        );
      }
    }

    const { data, error } = await db
      .from("lancamentos")
      .update(payload)
      .eq("id", id)
      .select("*, projetos(nome), consultores(nome), viagens(id, agencia, total)")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Atualiza dados de agência e observação de orientações na tabela viagens do Supabase
    if (body.observacao_agencia !== undefined || body.agencia !== undefined) {
      const { data: vExist } = await db
        .from("viagens")
        .select("id")
        .eq("lancamento_id", id)
        .maybeSingle();

      const viagemUpdate: any = {};
      if (body.observacao_agencia !== undefined) viagemUpdate.observacao_agencia = body.observacao_agencia || null;
      if (body.agencia !== undefined) viagemUpdate.agencia = body.agencia || "FÁTIMA";

      if (vExist?.id) {
        await db.from("viagens").update(viagemUpdate).eq("id", vExist.id);
      } else if (data?.precisa_logistica) {
        await db.from("viagens").insert({
          lancamento_id: id,
          agencia: body.agencia || "FÁTIMA",
          observacao_agencia: body.observacao_agencia || null,
          custo_1: 0,
          custo_2: 0,
          custo_3: 0,
          custo_4: 0,
          custo_5: 0,
        });
      }
    }

    // Se demanda logística for confirmada, garante o registro na esteira de viagens
    if (data && data.precisa_logistica) {
      try {
        await garantirSolicitacaoAtividade(id, {
          viagemId: Array.isArray(data.viagens) ? data.viagens[0]?.id : data.viagens?.id,
          projeto: data.projetos?.nome,
          atividade: data.atividade,
          consultor: data.consultores?.nome,
          perfil: data.perfil,
          local: data.local,
          dataInicial: data.data_inicial,
          dataFinal: data.data_final,
          horas: data.horas,
          agencia: body.agencia || (Array.isArray(data.viagens) ? data.viagens[0]?.agencia : data.viagens?.agencia) || "FÁTIMA",
        });
      } catch (errLog) {
        console.warn("Aviso ao sincronizar esteira de logística no PATCH:", errLog);
      }
    }

    return NextResponse.json({ success: true, data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const db = supabaseAdmin();

    // Remove dependências vinculadas se existirem
    try {
      await db.from("notas_debito").delete().eq("lancamento_id", id);
    } catch {}
    try {
      await db.from("viagens").delete().eq("lancamento_id", id);
    } catch {}

    // Limpa esteira de viagens
    try {
      await removerSolicitacaoPorLancamento(id);
    } catch {}

    const { error } = await db.from("lancamentos").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

