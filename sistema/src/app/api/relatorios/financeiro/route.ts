import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { supabaseAdmin } from "@/lib/supabase-server";
import {
  calcularFinancialAnalysis,
  calcularDRE,
  calcularAdministrationMensal,
  parametrosPadrao,
  type LancamentoDRE,
  type ParametrosAno,
} from "@/lib/dre-engine";

export const dynamic = "force-dynamic";

const ARQ = path.join(process.cwd(), "src", "lib", "dre-parametros.json");

function lerParametros(): Record<string, ParametrosAno> {
  try {
    return JSON.parse(fs.readFileSync(ARQ, "utf8"));
  } catch {
    return {};
  }
}

async function buscarLancamentos(ano: number): Promise<LancamentoDRE[]> {
  const db = supabaseAdmin();
  const todos: LancamentoDRE[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("lancamentos")
      .select(
        "competencia, horas, faturar, repasse, custo_consultor, projetos(centros_custo(areas(nome))), viagens(total)"
      )
      .gte("competencia", `${ano}-01-01`)
      .lte("competencia", `${ano}-12-31`)
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    todos.push(...((data ?? []) as unknown as LancamentoDRE[]));
    if (!data || data.length < 1000) break;
  }
  return todos;
}

const FAT_ARQ = path.join(process.cwd(), "src", "lib", "faturamento-base.json");

const MESES_MAP: Record<string, number> = {
  JANEIRO: 1,
  FEVEREIRO: 2,
  MARÇO: 3,
  ABRIL: 4,
  MAIO: 5,
  JUNHO: 6,
  JULHO: 7,
  AGOSTO: 8,
  SETEMBRO: 9,
  OUTUBRO: 10,
  NOVEMBRO: 11,
  DEZEMBRO: 12,
};

function buscarReceitasFaturadas(
  mesInicial: number,
  mesFinal: number
): Partial<Record<string, number>> {
  const receitas: Record<string, number> = {};
  try {
    if (!fs.existsSync(FAT_ARQ)) return receitas;
    const faturas = JSON.parse(fs.readFileSync(FAT_ARQ, "utf8"));
    if (!Array.isArray(faturas)) return receitas;

    for (const f of faturas) {
      const realMesStr = (f.realizado || "").trim().toUpperCase();
      const fatMesStr = (f.faturado || "").trim().toUpperCase();

      // Regra oficial da planilha (Fórmula da Row 6 na aba Financial Analysis - NF):
      // Exclui ADIANTAMENTO, A FATURAR, e perfis de reembolso/repasse: MATERIAL e LOGÍSTICA
      if (fatMesStr === "A FATURAR" || fatMesStr === "ADIANTAMENTO" || realMesStr === "ADIANTAMENTO") continue;

      const perfil = (f.perfil || "").trim().toUpperCase();
      if (perfil === "MATERIAL" || perfil === "LOGÍSTICA") continue;

      const mesNum = MESES_MAP[fatMesStr];
      if (!mesNum || mesNum < mesInicial || mesNum > mesFinal) continue;

      const valor = Number(f.valor) || 0;
      if (valor <= 0) continue;

      const area = (f.area || "").toUpperCase();
      let u = "ADMINISTRATION";
      if (area.includes("HRD") || area.includes("HUMAN")) u = "HRD";
      else if (area.includes("DEALER")) u = "DEALER DEVELOPMENT";
      else if (area.includes("BUSINESS") || area.includes("SOLUTIONS")) u = "BUSINESS SOLUTIONS";
      else if (area.includes("INNOVAT")) u = "INNOVATION";
      else if (area.includes("EDUCA")) u = "EDUCAÇÃO";
      else if (area.includes("OUTSOURCING")) u = "OUTSOURCING";

      receitas[u] = (receitas[u] || 0) + valor;
    }
  } catch (e) {
    console.error("Erro ao calcular receitas faturadas:", e);
  }
  return receitas;
}

export async function GET(req: Request) {
  try {
    const sp = new URL(req.url).searchParams;
    const ano = Number(sp.get("ano")) || new Date().getFullYear();
    const mesInicial = Math.min(12, Math.max(1, Number(sp.get("mesInicial")) || 1));
    const mesFinal = Math.min(12, Math.max(mesInicial, Number(sp.get("mesFinal")) || 12));
    const tipoReceita = sp.get("tipoReceita") === "faturado" ? "faturado" : "previsto";

    const params = lerParametros()[String(ano)] ?? parametrosPadrao();
    const lancs = await buscarLancamentos(ano);

    const receitasFaturadas =
      tipoReceita === "faturado" ? (buscarReceitasFaturadas(mesInicial, mesFinal) as any) : undefined;

    const fa = calcularFinancialAnalysis(lancs, params, mesInicial, mesFinal, receitasFaturadas);
    return NextResponse.json({
      ok: true,
      ano,
      mesInicial,
      mesFinal,
      tipoReceita,
      totalLancamentos: lancs.length,
      parametros: params,
      financialAnalysis: fa,
      dre: calcularDRE(fa),
      dreMensal: Array.from({ length: 12 }, (_, i) =>
        calcularDRE(
          calcularFinancialAnalysis(
            lancs,
            params,
            i + 1,
            i + 1,
            tipoReceita === "faturado" ? (buscarReceitasFaturadas(i + 1, i + 1) as any) : undefined
          )
        )
      ),
      administracaoMensal: calcularAdministrationMensal(lancs, params),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro ao calcular relatório";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// Atualiza os parâmetros mensais (salários, despesas operacionais, resultado financeiro etc.)
export async function PUT(req: Request) {
  try {
    const body = (await req.json()) as { ano: number; parametros: ParametrosAno };
    if (!body?.ano || !body?.parametros?.meses) {
      return NextResponse.json({ ok: false, error: "Payload inválido" }, { status: 400 });
    }
    const todos = lerParametros();
    todos[String(body.ano)] = body.parametros;
    fs.writeFileSync(ARQ, JSON.stringify(todos, null, 2), "utf8");
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro ao salvar parâmetros";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
