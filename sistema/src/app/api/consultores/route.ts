import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

export async function GET() {
  try {
    const db = supabaseAdmin();
    const { data, error } = await db
      .from("consultores")
      .select("id, nome, tipo, perfil")
      .order("nome", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const db = supabaseAdmin();

    const { nome, tipo = "parceiro", perfil } = body;

    if (!nome || !nome.trim()) {
      return NextResponse.json(
        { error: "O nome do consultor é obrigatório." },
        { status: 400 }
      );
    }

    const payload = {
      nome: nome.trim().toUpperCase(),
      tipo: tipo || "parceiro",
      perfil: perfil || null,
      fornecedor: false,
      ativo: true,
    };

    const { data, error } = await db
      .from("consultores")
      .insert(payload)
      .select("id, nome, tipo, perfil")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
