import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { supabaseAdmin } from "@/lib/supabase-server";
import perfisPadrao from "@/lib/perfis-acesso.json";
import consultoresBase from "@/lib/consultores-base.json";

const FILE_PATH = path.join(process.cwd(), "src/lib/perfis-acesso.json");

function normalizarPerfisSeparados(lista: any[]): { perfis: any[]; migrado: boolean } {
  let migrado = false;
  const copia = lista.map((p) => {
    if (p.id === "ADMIN" && p.nome !== "Administrador") {
      migrado = true;
      return {
        ...p,
        nome: "Administrador",
        descricao:
          "Acesso irrestrito a todos os módulos operacionais, financeiros, societários, relatórios e configuração de permissões do sistema.",
      };
    }
    return p;
  });

  if (!copia.some((p) => p.id === "DIRETORIA")) {
    const padraoDiretoria = (perfisPadrao as any[]).find((p) => p.id === "DIRETORIA");
    if (padraoDiretoria) {
      migrado = true;
      const idxAdmin = copia.findIndex((p) => p.id === "ADMIN");
      if (idxAdmin >= 0) {
        copia.splice(idxAdmin + 1, 0, padraoDiretoria);
      } else {
        copia.unshift(padraoDiretoria);
      }
    }
  }

  return { perfis: copia, migrado };
}

export async function GET() {
  try {
    let perfis: any[] = perfisPadrao as any[];

    if (fs.existsSync(FILE_PATH)) {
      try {
        const raw = fs.readFileSync(FILE_PATH, "utf-8");
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          perfis = parsed;
        }
      } catch {}
    }

    try {
      const sb = supabaseAdmin();
      const { data: cloud } = await sb
        .from("configuracoes")
        .select("descricao")
        .eq("chave", "perfis_acesso_rbac")
        .maybeSingle();

      if (cloud?.descricao) {
        const parsedCloud = JSON.parse(cloud.descricao);
        if (Array.isArray(parsedCloud) && parsedCloud.length > 0) {
          perfis = parsedCloud;
        }
      }

      const norm = normalizarPerfisSeparados(perfis);
      perfis = norm.perfis;
      if (norm.migrado) {
        await sb.from("configuracoes").upsert({
          chave: "perfis_acesso_rbac",
          valor: perfis.length,
          descricao: JSON.stringify(perfis),
        });
        try {
          fs.writeFileSync(FILE_PATH, JSON.stringify(perfis, null, 2), "utf-8");
        } catch {}
      }
    } catch {
      perfis = normalizarPerfisSeparados(perfis).perfis;
    }

    const pessoasDisponiveis = (consultoresBase as any[]).map((c) => ({
      id: c.id,
      nome: c.nome,
      nome_completo: c.nome_completo || c.nome,
      email: c.email || `${String(c.nome || "").toLowerCase().replace(/\s+/g, ".")}@nnos.com.br`,
      cargo: c.cargo || c.perfil || "Consultor",
      tipo: c.tipo || "parceiro",
    }));

    return NextResponse.json({
      perfis,
      perfisPadrao,
      pessoasDisponiveis,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { perfis, restaurarPadrao } = body || {};

    const listaFinal = restaurarPadrao ? perfisPadrao : perfis;
    if (!Array.isArray(listaFinal)) {
      return NextResponse.json({ error: "Formato inválido para lista de perfis." }, { status: 400 });
    }

    try {
      fs.writeFileSync(FILE_PATH, JSON.stringify(listaFinal, null, 2), "utf-8");
    } catch (fsErr: any) {
      console.warn("Aviso ao gravar perfis-acesso.json localmente:", fsErr.message);
    }

    try {
      const sb = supabaseAdmin();
      await sb.from("configuracoes").upsert({
        chave: "perfis_acesso_rbac",
        valor: listaFinal.length,
        descricao: JSON.stringify(listaFinal),
      });
    } catch (sbErr: any) {
      console.warn("Aviso ao salvar perfis_acesso_rbac no Supabase:", sbErr.message);
    }

    return NextResponse.json({ ok: true, perfis: listaFinal });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

