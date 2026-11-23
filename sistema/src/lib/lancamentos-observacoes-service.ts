import { supabaseAdmin } from "@/lib/supabase-server";

const PREFIXO_OBS_LANCAMENTO = "lancamento_obs_";

export async function carregarMapaObservacoesLancamentos(): Promise<Map<string, string>> {
  const mapa = new Map<string, string>();
  try {
    const db = supabaseAdmin();
    const { data, error } = await db
      .from("configuracoes")
      .select("chave, descricao")
      .like("chave", `${PREFIXO_OBS_LANCAMENTO}%`);

    if (!error && Array.isArray(data)) {
      for (const row of data) {
        if (!row?.chave || !row?.descricao) continue;
        const lancamentoId = String(row.chave).slice(PREFIXO_OBS_LANCAMENTO.length);
        const texto = String(row.descricao).trim();
        if (lancamentoId && texto) {
          mapa.set(lancamentoId, texto);
        }
      }
    }
  } catch (err) {
    console.warn("Aviso ao carregar observações de lançamentos:", err);
  }
  return mapa;
}

export async function salvarObservacaoLancamento(
  lancamentoId: string,
  observacoes: string | null | undefined
): Promise<string | null> {
  if (!lancamentoId) return null;
  const db = supabaseAdmin();
  const chave = `${PREFIXO_OBS_LANCAMENTO}${lancamentoId}`;
  const texto = typeof observacoes === "string" ? observacoes.trim() : "";

  try {
    if (!texto) {
      await db.from("configuracoes").delete().eq("chave", chave);
      return null;
    }

    await db
      .from("configuracoes")
      .upsert(
        { chave, valor: 1, descricao: texto },
        { onConflict: "chave" }
      );
    return texto;
  } catch (err) {
    console.warn("Aviso ao salvar observação do lançamento:", err);
    return texto || null;
  }
}

export async function removerObservacaoLancamento(lancamentoId: string): Promise<void> {
  if (!lancamentoId) return;
  try {
    const db = supabaseAdmin();
    await db
      .from("configuracoes")
      .delete()
      .eq("chave", `${PREFIXO_OBS_LANCAMENTO}${lancamentoId}`);
  } catch (err) {
    console.warn("Aviso ao remover observação do lançamento:", err);
  }
}
