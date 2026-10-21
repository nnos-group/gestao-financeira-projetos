import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { supabaseAdmin } from "@/lib/supabase-server";

const DATA_FILE = path.join(process.cwd(), "src/lib/faturamento-base.json");
const CC_FILE = path.join(process.cwd(), "src/lib/centros-de-custo.json");

const MESES_MAP: Record<number, string> = {
  1: "JANEIRO",
  2: "FEVEREIRO",
  3: "MARÇO",
  4: "ABRIL",
  5: "MAIO",
  6: "JUNHO",
  7: "JULHO",
  8: "AGOSTO",
  9: "SETEMBRO",
  10: "OUTUBRO",
  11: "NOVEMBRO",
  12: "DEZEMBRO",
};

export async function GET() {
  try {
    let faturasSalvas: any[] = [];
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, "utf8");
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        faturasSalvas = parsed
          .filter((f: any) => f.id !== "fat-709" && f.numeroNota !== "TOTAL" && f.area !== "-")
          .map((f: any) => ({
            ...f,
            area: (f.area || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim(),
          }));
      }
    }

    // Carregar mapeamento de Projetos -> Centro de Custo e Área
    const ccMap = new Map<string, { centroDeCusto: string; area: string }>();
    try {
      if (fs.existsSync(CC_FILE)) {
        const ccContent = fs.readFileSync(CC_FILE, "utf8");
        const ccJson = JSON.parse(ccContent);
        if (Array.isArray(ccJson.centrosDeCusto)) {
          ccJson.centrosDeCusto.forEach((c: any) => {
            if (c.projeto) {
              ccMap.set(c.projeto.trim().toUpperCase(), {
                centroDeCusto: c.centroDeCusto || "",
                area: c.area || "",
              });
            }
          });
        }
      }
    } catch (e) {
      console.warn("Aviso ao ler centros-de-custo.json:", e);
    }

    // Regra de Negócio: Buscar lançamentos de Gestão de Projetos que possuem FATURAR preenchido
    try {
      const db = supabaseAdmin();
      let lancamentos: any[] = [];
      let from = 0;
      while (true) {
        const { data: batch, error: bErr } = await db
          .from("lancamentos")
          .select("id, competencia, faturar, perfil, projetos(id, nome)")
          .not("faturar", "is", null)
          .gt("faturar", 0)
          .range(from, from + 999);
        if (bErr || !batch || batch.length === 0) break;
        lancamentos.push(...batch);
        if (batch.length < 1000) break;
        from += 1000;
      }

      if (Array.isArray(lancamentos) && lancamentos.length > 0) {
        // Agrupar somatório por competência, projeto e perfil
        const grupos = new Map<string, {
          competencia: string;
          nomeProjeto: string;
          perfil: string;
          totalFaturar: number;
        }>();

        lancamentos.forEach((l: any) => {
          const valor = Number(l.faturar) || 0;
          if (valor <= 0) return;
          const nomeProj = l.projetos?.nome?.trim();
          if (!nomeProj) return;
          const comp = (l.competencia || "").trim();
          if (!comp) return;

          // Extrair ano e mês da competência (ex: "2026-11-01" ou "2026-12-01")
          const partesComp = comp.split("-");
          const mesNum = parseInt(partesComp[1] || "1", 10);
          // REGRA DE NEGÓCIO: Preservar estritamente o histórico faturado da planilha (Jan a Out)
          // Aplicar a integração APENAS para os lançamentos previstos de Novembro (11) e Dezembro (12)
          if (mesNum < 11) {
            return;
          }

          let pNormalizado = (l.perfil || "").trim().toUpperCase();
          if (!pNormalizado) {
            if (nomeProj.toUpperCase().includes("BACK OFFICE") || nomeProj.toUpperCase().includes("BACKOFFICE")) {
              pNormalizado = "BACK OFFICE";
            } else {
              pNormalizado = "SÊNIOR";
            }
          }

          const chave = `${comp}:::${nomeProj.toUpperCase()}:::${pNormalizado}`;
          const atual = grupos.get(chave);
          if (atual) {
            atual.totalFaturar += valor;
          } else {
            grupos.set(chave, {
              competencia: comp,
              nomeProjeto: nomeProj,
              perfil: pNormalizado,
              totalFaturar: valor,
            });
          }
        });

        // Para cada grupo com FATURAR preenchido, gerar item pré-preenchido no Faturamento
        const idsSalvos = new Set(faturasSalvas.map((f: any) => f.id));

        grupos.forEach(({ competencia, nomeProjeto, perfil, totalFaturar }) => {
          const partesComp = competencia.split("-");
          const anoStr = partesComp[0] || "2026";
          const mesNum = parseInt(partesComp[1] || "1", 10);

          const mesNome = MESES_MAP[mesNum] || (mesNum === 11 ? "NOVEMBRO" : "DEZEMBRO");

          const slug = nomeProjeto.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");
          const perfilSlug = perfil.toLowerCase().replace(/[^a-z0-9]/g, "-");
          const idGerado = `proj-fat-${competencia}-${slug}-${perfilSlug}`;

          // Se já foi cadastrado ou salvo manualmente pelo usuário, preserva o salvo
          if (idsSalvos.has(idGerado)) {
            return;
          }

          const ccInfo = ccMap.get(nomeProjeto.toUpperCase());

          const novoItemPreenchido = {
            id: idGerado,
            realizado: mesNome, // mês de competência
            faturado: "A FATURAR", // A FATURAR
            perfil: perfil, // PERFIL PREENCHIDO (ex: SÊNIOR, PLENO, BACK OFFICE)
            numeroNota: "", // EM BRANCO
            valor: totalFaturar, // SOMATÓRIO DO PROJETO E PERFIL
            valorFormatado: totalFaturar.toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
            pedidoCompras: "", // EM BRANCO
            status: "Aberto",
            vencimento: "", // EM BRANCO
            dataPagto: "", // EM BRANCO
            dias: 0,
            pagtoDescricao: "", // EM BRANCO
            projeto: nomeProjeto,
            centroCusto: ccInfo?.centroDeCusto || "01.00",
            area: ccInfo?.area || "",
            anoCompetencia: anoStr,
            origemProjetos: true,
          };

          faturasSalvas.unshift(novoItemPreenchido);
        });
      }
    } catch (dbErr) {
      console.warn("Aviso ao integrar lançamentos de projetos no faturamento:", dbErr);
    }

    return NextResponse.json(faturasSalvas);
  } catch (err: any) {
    console.error("Erro ao ler faturamento:", err);
    return NextResponse.json({ error: "Erro ao ler base de faturamento" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!Array.isArray(body)) {
      return NextResponse.json({ error: "Payload inválido. Esperava array." }, { status: 400 });
    }

    const limpos = body
      .filter((f: any) => f.id !== "fat-709" && f.numeroNota !== "TOTAL" && f.area !== "-")
      .map((f: any) => ({
        ...f,
        area: (f.area || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim(),
      }));

    fs.writeFileSync(DATA_FILE, JSON.stringify(limpos, null, 2), "utf8");
    return NextResponse.json({ ok: true, count: limpos.length });
  } catch (err: any) {
    console.error("Erro ao salvar faturamento:", err);
    return NextResponse.json({ error: "Erro ao salvar base de faturamento" }, { status: 500 });
  }
}

