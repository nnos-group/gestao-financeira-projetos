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

    const db = supabaseAdmin();

    // 1. Deletar todas as notas de débito do lançamento
    await db.from("notas_debito").delete().eq("lancamento_id", id);

    return NextResponse.json({
      success: true,
      message: "Notas de débito desvinculadas com sucesso. Campos reabertos para edição.",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
