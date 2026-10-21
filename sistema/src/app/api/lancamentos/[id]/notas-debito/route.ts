import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

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
    const { destino, numero } = body; // destino: 'agencia' | 'consultor'

    if (!destino || (destino !== "agencia" && destino !== "consultor")) {
      return NextResponse.json(
        { error: "Destino inválido ('agencia' ou 'consultor')" },
        { status: 400 }
      );
    }

    const db = supabaseAdmin();
    const numLimpo = numero != null && String(numero).trim() !== "" ? String(numero).trim() : null;

    // Verificar se já existe nota para este lancamento e destino
    const { data: existente } = await db
      .from("notas_debito")
      .select("id")
      .eq("lancamento_id", id)
      .eq("destino", destino)
      .maybeSingle();

    if (numLimpo) {
      if (existente) {
        await db
          .from("notas_debito")
          .update({ numero: numLimpo })
          .eq("id", existente.id);
      } else {
        await db.from("notas_debito").insert({
          lancamento_id: id,
          destino,
          numero: numLimpo,
        });
      }
    } else {
      // Se ficou vazio, remove a nota se existia
      if (existente) {
        await db.from("notas_debito").delete().eq("id", existente.id);
      }
    }

    return NextResponse.json({ success: true, numero: numLimpo });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
