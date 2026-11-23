import fs from "fs";
import path from "path";
import { supabaseAdmin } from "@/lib/supabase-server";
import creditosIniciais from "@/lib/viagens-creditos-base.json";

export interface CreditoLogisticaItem {
  id: string;
  projeto: string;
  dataInicial: string; // YYYY-MM-DD
  dataFinal: string; // YYYY-MM-DD
  instrutor: string;
  ciaAereaHotel: string;
  valor: number;
  multaTaxa: number;
  credito: number;
  notaDebito: string;
  creditoUtilizado: "SIM" | "NÃO";
  projetoUtilizado: string;
  dataInicialUtilizacao: string; // YYYY-MM-DD
  dataFinalUtilizacao: string; // YYYY-MM-DD
  observacoes?: string;
  atualizadoEm?: string;
  atualizadoPor?: string;
}

const DATA_FILE = path.join(process.cwd(), "src", "lib", "viagens-creditos-base.json");
const CHAVE_CLOUD_CREDITOS = "viagens_controle_creditos_v1";

function lerArquivoLocal(): CreditoLogisticaItem[] {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as CreditoLogisticaItem[];
    }
  } catch (err) {
    console.warn("Aviso ao ler viagens-creditos-base.json:", err);
  }
  return (creditosIniciais as unknown as CreditoLogisticaItem[]) || [];
}

function salvarArquivoLocal(lista: CreditoLogisticaItem[]): void {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(lista, null, 2), "utf8");
  } catch {
    // Em ambiente serverless (Vercel), o FS é somente leitura; a persistência principal ocorre no Supabase
  }
}

export function normalizarItemCredito(raw: Partial<CreditoLogisticaItem>, idPadrao?: string): CreditoLogisticaItem {
  const valor = Number(raw.valor) || 0;
  const multaTaxa = Number(raw.multaTaxa) || 0;
  const creditoCalc =
    raw.credito !== undefined && raw.credito !== null && !Number.isNaN(Number(raw.credito))
      ? Number(raw.credito)
      : Math.max(0, Math.round((valor - multaTaxa) * 100) / 100);

  const utilizadoRaw = String(raw.creditoUtilizado || "NÃO").trim().toUpperCase();
  const creditoUtilizado: "SIM" | "NÃO" =
    utilizadoRaw === "SIM" || utilizadoRaw === "S" || utilizadoRaw === "TRUE" ? "SIM" : "NÃO";

  return {
    id: String(raw.id || idPadrao || `cred-${Date.now()}`),
    projeto: String(raw.projeto || "").trim().toUpperCase(),
    dataInicial: String(raw.dataInicial || "").trim(),
    dataFinal: String(raw.dataFinal || "").trim(),
    instrutor: String(raw.instrutor || "").trim().toUpperCase(),
    ciaAereaHotel: String(raw.ciaAereaHotel || "").trim().toUpperCase(),
    valor: Math.round(valor * 100) / 100,
    multaTaxa: Math.round(multaTaxa * 100) / 100,
    credito: Math.round(creditoCalc * 100) / 100,
    notaDebito: String(raw.notaDebito || "").trim(),
    creditoUtilizado,
    projetoUtilizado: creditoUtilizado === "SIM" ? String(raw.projetoUtilizado || "").trim().toUpperCase() : "",
    dataInicialUtilizacao: creditoUtilizado === "SIM" ? String(raw.dataInicialUtilizacao || "").trim() : "",
    dataFinalUtilizacao: creditoUtilizado === "SIM" ? String(raw.dataFinalUtilizacao || "").trim() : "",
    observacoes: String(raw.observacoes || "").trim(),
    atualizadoEm: raw.atualizadoEm || new Date().toISOString(),
    atualizadoPor: raw.atualizadoPor || "Sistema",
  };
}

export async function listarCreditosLogistica(): Promise<CreditoLogisticaItem[]> {
  const baseLocal = lerArquivoLocal().map((c, idx) =>
    normalizarItemCredito(c, `cred-${String(idx + 1).padStart(3, "0")}`)
  );

  try {
    const db = supabaseAdmin();
    const { data, error } = await db
      .from("configuracoes")
      .select("descricao")
      .eq("chave", CHAVE_CLOUD_CREDITOS)
      .maybeSingle();

    if (!error && data?.descricao) {
      const parsed = JSON.parse(data.descricao);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((c, idx) =>
          normalizarItemCredito(c, `cred-${String(idx + 1).padStart(3, "0")}`)
        );
      }
    } else if (!error && !data) {
      // Inicializa no Supabase na primeira leitura
      await db.from("configuracoes").upsert(
        {
          chave: CHAVE_CLOUD_CREDITOS,
          valor: baseLocal.length,
          descricao: JSON.stringify(baseLocal),
        },
        { onConflict: "chave" }
      );
    }
  } catch (err) {
    console.warn("Aviso ao consultar créditos de logística no Supabase:", err);
  }

  return baseLocal;
}

export async function salvarListaCreditosLogistica(
  lista: CreditoLogisticaItem[]
): Promise<CreditoLogisticaItem[]> {
  const normalizada = lista.map((c, idx) =>
    normalizarItemCredito(c, `cred-${String(idx + 1).padStart(3, "0")}`)
  );

  salvarArquivoLocal(normalizada);

  try {
    const db = supabaseAdmin();
    await db.from("configuracoes").upsert(
      {
        chave: CHAVE_CLOUD_CREDITOS,
        valor: normalizada.length,
        descricao: JSON.stringify(normalizada),
      },
      { onConflict: "chave" }
    );
  } catch (err) {
    console.warn("Aviso ao persistir créditos de logística no Supabase:", err);
  }

  return normalizada;
}
