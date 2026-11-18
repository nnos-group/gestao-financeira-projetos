import fs from "fs";
import path from "path";
import { supabaseAdmin } from "@/lib/supabase-server";
import perfisPadrao from "@/lib/perfis-acesso.json";
import consultoresBaseFallback from "@/lib/consultores-base.json";
import { lerUsuariosAsync, salvarUsuariosAsync } from "@/lib/usuarios-service";

const PERFIS_PATH = path.join(process.cwd(), "src/lib/perfis-acesso.json");
const PESSOAS_PATH = path.join(process.cwd(), "src/lib/consultores-base.json");

export function normalizarChavePessoa(nome?: string | null): string {
  return String(nome || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export async function carregarPessoasAtualizadas(): Promise<any[]> {
  try {
    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from("configuracoes")
      .select("descricao")
      .eq("chave", "pessoas_base_completa")
      .maybeSingle();

    if (!error && data?.descricao) {
      const parsed = JSON.parse(data.descricao);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e: any) {
    console.warn("[perfis-sync] Supabase indisponível ao ler pessoas_base_completa:", e?.message);
  }

  try {
    if (fs.existsSync(PESSOAS_PATH)) {
      const raw = fs.readFileSync(PESSOAS_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {}

  return Array.isArray(consultoresBaseFallback) ? (consultoresBaseFallback as any[]) : [];
}

export async function carregarPerfisPersistidos(): Promise<any[]> {
  let perfis: any[] = perfisPadrao as any[];

  if (fs.existsSync(PERFIS_PATH)) {
    try {
      const raw = fs.readFileSync(PERFIS_PATH, "utf-8");
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
  } catch {}

  return perfis;
}

export async function salvarPerfisPersistidos(listaFinal: any[]): Promise<void> {
  try {
    fs.writeFileSync(PERFIS_PATH, JSON.stringify(listaFinal, null, 2), "utf-8");
  } catch (fsErr: any) {
    console.warn("Aviso ao gravar perfis-acesso.json localmente:", fsErr?.message);
  }

  try {
    const sb = supabaseAdmin();
    await sb.from("configuracoes").upsert(
      {
        chave: "perfis_acesso_rbac",
        valor: listaFinal.length,
        descricao: JSON.stringify(listaFinal),
      },
      { onConflict: "chave" }
    );
  } catch (sbErr: any) {
    console.warn("Aviso ao salvar perfis_acesso_rbac no Supabase:", sbErr?.message);
  }
}

function construirMapaPessoas(pessoasLista: any[]): Map<string, any> {
  const mapa = new Map<string, any>();
  for (const p of Array.isArray(pessoasLista) ? pessoasLista : []) {
    const chNome = normalizarChavePessoa(p?.nome);
    const chCompleto = normalizarChavePessoa(p?.nome_completo);
    if (chNome && !mapa.has(chNome)) mapa.set(chNome, p);
    if (chCompleto && !mapa.has(chCompleto)) mapa.set(chCompleto, p);
  }
  return mapa;
}

export function reconciliarPerfisComPessoas(
  listaPerfis: any[],
  pessoasLista: any[]
): { perfis: any[]; alterado: boolean } {
  const mapaPessoas = construirMapaPessoas(pessoasLista);
  let alterado = false;

  const perfisAtualizados = (Array.isArray(listaPerfis) ? listaPerfis : []).map((perfil) => {
    if (!Array.isArray(perfil?.usuariosVinculados)) return perfil;

    let usuariosAlterados = false;
    const usuariosVinculados = perfil.usuariosVinculados.map((u: any) => {
      const pessoa = mapaPessoas.get(normalizarChavePessoa(u?.nome));
      if (!pessoa) return u;

      const emailAtualizado = String(pessoa.email || "").trim();
      const cargoPessoa = String(pessoa.cargo || "").trim();
      const deveAtualizarCargo =
        Boolean(cargoPessoa) &&
        (!u?.cargo || perfil.id === "SOCIO" || perfil.id === "CONSULTOR");

      const proximoEmail = emailAtualizado || u.email;
      const proximoCargo = deveAtualizarCargo ? cargoPessoa : u.cargo;

      if (proximoEmail !== u.email || proximoCargo !== u.cargo) {
        usuariosAlterados = true;
        alterado = true;
        return {
          ...u,
          email: proximoEmail,
          cargo: proximoCargo,
        };
      }
      return u;
    });

    return usuariosAlterados ? { ...perfil, usuariosVinculados } : perfil;
  });

  return { perfis: perfisAtualizados, alterado };
}

export async function sincronizarPerfisEUsuariosComPessoas(
  pessoasLista: any[]
): Promise<{ perfisAtualizados: boolean; usuariosAtualizados: boolean }> {
  let perfisAtualizados = false;
  let usuariosAtualizados = false;

  try {
    const perfisAtuais = await carregarPerfisPersistidos();
    const rec = reconciliarPerfisComPessoas(perfisAtuais, pessoasLista);
    if (rec.alterado) {
      await salvarPerfisPersistidos(rec.perfis);
      perfisAtualizados = true;
    }
  } catch (err) {
    console.warn("[perfis-sync] Aviso ao sincronizar perfis vinculados:", err);
  }

  try {
    const mapaPessoas = construirMapaPessoas(pessoasLista);
    const mapaPorId = new Map<string, any>();
    for (const p of Array.isArray(pessoasLista) ? pessoasLista : []) {
      if (p?.id) mapaPorId.set(String(p.id), p);
    }

    const usuariosSistema = await lerUsuariosAsync();
    const usuariosEditados = usuariosSistema.map((u: any) => {
      const pessoaPorId = u?.prestadorIdVinculado
        ? mapaPorId.get(String(u.prestadorIdVinculado))
        : null;
      const pessoa =
        pessoaPorId ||
        mapaPessoas.get(normalizarChavePessoa(u?.nome)) ||
        (u?.liderVinculado && u.liderVinculado !== "TODOS"
          ? mapaPessoas.get(normalizarChavePessoa(u.liderVinculado))
          : null);

      const emailPessoa = String(pessoa?.email || "").trim().toLowerCase();
      if (emailPessoa && String(u?.email || "").trim().toLowerCase() !== emailPessoa) {
        usuariosAtualizados = true;
        return { ...u, email: emailPessoa };
      }
      return u;
    });

    if (usuariosAtualizados) {
      await salvarUsuariosAsync(usuariosEditados);
    }
  } catch (err) {
    console.warn("[perfis-sync] Aviso ao sincronizar e-mail na base de login:", err);
  }

  return { perfisAtualizados, usuariosAtualizados };
}
