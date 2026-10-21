import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import consultoresBase from "@/lib/consultores-base.json";

function normalizar(str: string): string {
  return (str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function formatarNome(nome: string): string {
  return (nome || "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

const EMAIL_LIDERES_MAP: Record<string, string> = {
  "BEATRIZ PICORELLI": "beatriz.picorelli@nnos.com.br",
  "CAROLINE AMIEVA": "caroline.amieva@nnos.com.br",
  "FABIO CANASSA": "fabio.canassa@nnos.com.br",
  "JEFFERSON SOUZA": "jefferson.souza@nnos.com.br",
  "JOICE LAGE": "joice.lage@nnos.com.br",
  "LEONARDO CAMPOS": "leonardo.campos@nnos.com.br",
  "VINICIUS SOUZA": "vinicius.souza@nnos.com.br",
  "IGOR PICORELLI": "igor.picorelli@nnos.com.br",
};

export async function GET() {
  try {
    const db = supabaseAdmin();
    const { data: dbLideres, error } = await db
      .from("lideres")
      .select("id, nome")
      .order("nome");

    if (error) {
      console.warn("Aviso ao buscar tabela lideres, usando fallback:", error.message);
    }

    const mapa = new Map<string, { id: string; nome: string; email: string }>();

    // 1. Inserir líderes do Supabase
    (dbLideres || []).forEach((l: any) => {
      const nomeFormatado = formatarNome(l.nome);
      const chave = normalizar(l.nome);
      const email = EMAIL_LIDERES_MAP[chave] || `${chave.toLowerCase().replace(/\s+/g, ".")}@nnos.com.br`;
      mapa.set(chave, {
        id: l.id,
        nome: nomeFormatado,
        email,
      });
    });

    // 2. Garantir todos os líderes corporativos conhecidos
    Object.entries(EMAIL_LIDERES_MAP).forEach(([chave, email]) => {
      if (!mapa.has(chave)) {
        mapa.set(chave, {
          id: chave.toLowerCase().replace(/\s+/g, "-"),
          nome: formatarNome(chave),
          email,
        });
      }
    });

    const lista = Array.from(mapa.values()).sort((a, b) => a.nome.localeCompare(b.nome));

    return NextResponse.json(lista);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
