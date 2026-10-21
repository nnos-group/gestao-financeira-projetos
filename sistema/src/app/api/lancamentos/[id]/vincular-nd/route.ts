import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const body = await request.json();
    const { destino, numero, valor, repasseManual } = body;

    if (!destino || (destino !== "agencia" && destino !== "consultor" && destino !== "ambos" && destino !== "completa")) {
      return NextResponse.json(
        { error: "Destino inválido ('agencia', 'consultor' ou 'ambos')" },
        { status: 400 }
      );
    }

    const db = supabaseAdmin();
    const numLimpo = numero != null && String(numero).trim() !== "" ? String(numero).trim() : null;
    const valorNum = valor != null && !isNaN(Number(valor)) ? Number(valor) : null;

    // 1. Atualizar ou inserir a nota de débito
    const destinosParaProcessar = destino === "ambos" || destino === "completa"
      ? ["agencia", "consultor"]
      : [destino];

    for (const d of destinosParaProcessar) {
      const { data: existente } = await db
        .from("notas_debito")
        .select("id")
        .eq("lancamento_id", id)
        .eq("destino", d)
        .maybeSingle();

      if (numLimpo) {
        if (existente) {
          await db
            .from("notas_debito")
            .update({ numero: numLimpo, valor: valorNum })
            .eq("id", existente.id);
        } else {
          await db.from("notas_debito").insert({
            lancamento_id: id,
            destino: d,
            numero: numLimpo,
            valor: valorNum,
          });
        }
      } else if (existente) {
        await db.from("notas_debito").delete().eq("id", existente.id);
      }
    }

    // 2. Buscar todas as notas de débito deste lançamento após a alteração
    const { data: todasNotas } = await db
      .from("notas_debito")
      .select("id, destino, numero, valor")
      .eq("lancamento_id", id);

    const notas = todasNotas || [];
    
    // 3. Calcular repasse: soma das NDs válidas ou valor explícito
    let novoRepasse: number | null = null;
    if (repasseManual != null && !isNaN(Number(repasseManual))) {
      novoRepasse = Number(repasseManual);
    } else if (destino === "ambos" || destino === "completa") {
      novoRepasse = valorNum;
    } else {
      const soma = notas.reduce((acc, n) => acc + (Number(n.valor) || 0), 0);
      novoRepasse = soma > 0 ? Math.round(soma * 100) / 100 : null;
    }

    if (novoRepasse != null) {
      await db
        .from("lancamentos")
        .update({
          repasse: novoRepasse,
          atualizado_em: new Date().toISOString(),
        })
        .eq("id", id);
    }

    return NextResponse.json({
      success: true,
      notas_debito: notas,
      repasse: novoRepasse,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
