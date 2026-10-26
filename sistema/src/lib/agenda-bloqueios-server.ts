import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { AgendaBloqueio } from "./agenda-bloqueios";

const BASE_FILE = path.join(process.cwd(), "src/lib/agenda-bloqueios-base.json");

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export function carregarBloqueiosArquivo(): AgendaBloqueio[] {
  try {
    if (fs.existsSync(BASE_FILE)) {
      const content = fs.readFileSync(BASE_FILE, "utf-8");
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn("Aviso ao ler agenda-bloqueios-base.json:", err);
  }
  return [];
}

export function salvarBloqueiosArquivo(lista: AgendaBloqueio[]): void {
  try {
    fs.writeFileSync(BASE_FILE, JSON.stringify(lista, null, 2), "utf-8");
  } catch (err) {
    console.error("Erro ao salvar agenda-bloqueios-base.json:", err);
  }
}

export async function listarBloqueios(): Promise<AgendaBloqueio[]> {
  try {
    const db = getSupabase();
    const { data, error } = await db
      .from("configuracoes")
      .select("descricao")
      .eq("chave", "agenda_bloqueios")
      .maybeSingle();

    if (!error && data?.descricao) {
      const parsed = JSON.parse(data.descricao);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn("Aviso ao buscar agenda_bloqueios no Supabase:", e);
  }
  return carregarBloqueiosArquivo();
}

export async function salvarBloqueio(novo: Omit<AgendaBloqueio, "id" | "criadoEm">): Promise<AgendaBloqueio> {
  const lista = await listarBloqueios();
  const bloqueioCriado: AgendaBloqueio = {
    ...novo,
    id: `blk-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    criadoEm: new Date().toISOString(),
  };

  const novaLista = [bloqueioCriado, ...lista];
  salvarBloqueiosArquivo(novaLista);

  try {
    const db = getSupabase();
    await db.from("configuracoes").upsert({
      chave: "agenda_bloqueios",
      descricao: JSON.stringify(novaLista),
      atualizado_em: new Date().toISOString(),
    }, { onConflict: "chave" });
  } catch (e) {
    console.warn("Aviso ao persistir agenda_bloqueios no Supabase:", e);
  }

  return bloqueioCriado;
}

export async function removerBloqueio(id: string): Promise<boolean> {
  const lista = await listarBloqueios();
  const novaLista = lista.filter((b) => b.id !== id);
  salvarBloqueiosArquivo(novaLista);

  try {
    const db = getSupabase();
    await db.from("configuracoes").upsert({
      chave: "agenda_bloqueios",
      descricao: JSON.stringify(novaLista),
      atualizado_em: new Date().toISOString(),
    }, { onConflict: "chave" });
  } catch (e) {
    console.warn("Aviso ao remover agenda_bloqueios no Supabase:", e);
  }

  return true;
}
