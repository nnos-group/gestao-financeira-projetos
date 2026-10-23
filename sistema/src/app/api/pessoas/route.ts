import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const DATA_FILE = path.join(process.cwd(), "src/lib/consultores-base.json");
const CHAVE_CLOUD = "pessoas_base_completa";

function lerArquivoLocal(): any[] {
  try {
    if (!fs.existsSync(DATA_FILE)) return [];
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return [];
  }
}

// GET: prioriza a base persistida no Supabase (fonte da verdade na Vercel); fallback para o JSON local.
export async function GET() {
  try {
    try {
      const { supabaseAdmin } = await import("@/lib/supabase-server");
      const { data } = await supabaseAdmin()
        .from("configuracoes")
        .select("descricao")
        .eq("chave", CHAVE_CLOUD)
        .maybeSingle();
      if (data?.descricao) {
        const parsed = JSON.parse(data.descricao);
        if (Array.isArray(parsed) && parsed.length > 0) return NextResponse.json(parsed);
      }
    } catch (e: any) {
      console.warn("[/api/pessoas] Supabase indisponível, usando arquivo local:", e?.message);
    }
    return NextResponse.json(lerArquivoLocal());
  } catch (err: any) {
    console.error("Erro ao ler pessoas:", err);
    return NextResponse.json({ error: "Erro ao ler base de pessoas" }, { status: 500 });
  }
}

// POST: grava no Supabase (obrigatório) e tenta gravar no arquivo local (somente funciona em ambiente com disco gravável).
export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!Array.isArray(body)) {
      return NextResponse.json({ error: "Payload inválido. Esperava array." }, { status: 400 });
    }

    let salvoCloud = false;
    let erroCloud: string | null = null;
    try {
      const { supabaseAdmin } = await import("@/lib/supabase-server");
      const { error } = await supabaseAdmin().from("configuracoes").upsert({
        chave: CHAVE_CLOUD,
        valor: body.length,
        descricao: JSON.stringify(body),
      });
      if (error) erroCloud = error.message;
      else salvoCloud = true;
    } catch (e: any) {
      erroCloud = e?.message || "Falha Supabase";
    }

    let salvoLocal = false;
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(body, null, 2), "utf8");
      salvoLocal = true;
    } catch {
      // Vercel: filesystem somente leitura — esperado.
    }

    if (!salvoCloud && !salvoLocal) {
      return NextResponse.json(
        { error: `Não foi possível persistir a ficha: ${erroCloud || "sem armazenamento disponível"}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, count: body.length, salvoCloud, salvoLocal });
  } catch (err: any) {
    console.error("Erro ao salvar pessoas:", err);
    return NextResponse.json({ error: "Erro ao salvar base de pessoas" }, { status: 500 });
  }
}
