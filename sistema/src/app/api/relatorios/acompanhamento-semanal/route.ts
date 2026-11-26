import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { supabaseAdmin } from "@/lib/supabase-server";
import historicoBase from "@/lib/acompanhamento-semanal-base.json";

const DATA_FILE = path.join(process.cwd(), "src/lib/acompanhamento-semanal-base.json");
const FATURAMENTO_FILE = path.join(process.cwd(), "src/lib/faturamento-base.json");
const CHAVE_CLOUD = "relatorios_acompanhamento_semanal_v1";

const MESES_NOMES = [
  "JANEIRO",
  "FEVEREIRO",
  "MARÇO",
  "ABRIL",
  "MAIO",
  "JUNHO",
  "JULHO",
  "AGOSTO",
  "SETEMBRO",
  "OUTUBRO",
  "NOVEMBRO",
  "DEZEMBRO",
];

function lerHistoricoLocal(): any[] {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn("Aviso ao ler acompanhamento-semanal-base.json:", e);
  }
  return Array.isArray(historicoBase) ? [...historicoBase] : [];
}

function salvarHistoricoLocal(lista: any[]) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(lista, null, 2), "utf8");
  } catch {
    // Em serverless (Vercel), o armazenamento primário é o Supabase
  }
}

async function obterHistoricoRelatorios(): Promise<any[]> {
  const local = lerHistoricoLocal();
  try {
    const db = supabaseAdmin();
    const { data, error } = await db
      .from("configuracoes")
      .select("descricao")
      .eq("chave", CHAVE_CLOUD)
      .maybeSingle();

    if (!error && data?.descricao) {
      const remoto = JSON.parse(data.descricao);
      if (Array.isArray(remoto) && remoto.length > 0) {
        return remoto.sort((a, b) => String(b.dataReferencia).localeCompare(String(a.dataReferencia)));
      }
    } else if (local.length > 0) {
      await db
        .from("configuracoes")
        .upsert({ chave: CHAVE_CLOUD, descricao: JSON.stringify(local) }, { onConflict: "chave" });
    }
  } catch (e) {
    console.warn("Aviso ao consultar Supabase para acompanhamento semanal:", e);
  }
  return local.sort((a, b) => String(b.dataReferencia).localeCompare(String(a.dataReferencia)));
}

function parseDataBR(str: string): Date | null {
  if (!str) return null;
  const parts = String(str).trim().split("/");
  if (parts.length !== 3) return null;
  const dia = parseInt(parts[0], 10);
  const mes = parseInt(parts[1], 10) - 1;
  const ano = parseInt(parts[2], 10);
  if (isNaN(dia) || isNaN(mes) || isNaN(ano)) return null;
  return new Date(ano, mes, dia, 0, 0, 0, 0);
}

function parseDataISO(str: string): Date {
  const parts = String(str || "").trim().split("-");
  if (parts.length === 3) {
    return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 0, 0, 0, 0);
  }
  const hj = new Date();
  hj.setHours(0, 0, 0, 0);
  return hj;
}

export async function calcularDadosBaseEmTempoReal(dataReferenciaISO: string) {
  const dataRef = parseDataISO(dataReferenciaISO);
  const anoRef = dataRef.getFullYear();
  const mesNum = dataRef.getMonth() + 1;
  const mesNome = MESES_NOMES[mesNum - 1] || "NOVEMBRO";
  const competenciaMes = `${anoRef}-${String(mesNum).padStart(2, "0")}-01`;

  // 1. Ler base de Faturamento para A Receber em Atraso, A Vencer em Aberto e Total a Receber
  let faturas: any[] = [];
  try {
    if (fs.existsSync(FATURAMENTO_FILE)) {
      const content = fs.readFileSync(FATURAMENTO_FILE, "utf8");
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        faturas = parsed.filter(
          (f: any) =>
            f &&
            f.id !== "fat-709" &&
            f.numeroNota !== "TOTAL" &&
            f.projeto !== "TOTAL" &&
            f.area !== "-"
        );
      }
    }
  } catch (e) {
    console.warn("Aviso ao ler faturamento-base.json:", e);
  }

  const aReceberEmAtraso: any[] = [];
  let totalAtraso = 0;
  let aVencerEmAberto = 0;

  for (const f of faturas) {
    const st = String(f.status || "").trim().toLowerCase();
    if (st === "pago") continue;

    const valor = Number(f.valor) || 0;
    if (valor <= 0) continue;

    const dtVenc = parseDataBR(f.vencimento);
    if (dtVenc && dtVenc.getTime() <= dataRef.getTime()) {
      const diffDias = Math.max(1, Math.round((dataRef.getTime() - dtVenc.getTime()) / (1000 * 60 * 60 * 24)));
      aReceberEmAtraso.push({
        realizado: String(f.realizado || "").trim().toUpperCase(),
        faturado: String(f.faturado || "").trim().toUpperCase(),
        projeto: String(f.projeto || "").trim().toUpperCase(),
        perfil: String(f.perfil || "").trim().toUpperCase(),
        numeroNota: String(f.numeroNota || "—").trim(),
        valor: Math.round(valor * 100) / 100,
        dias: diffDias,
        vencimento: String(f.vencimento || "").trim(),
      });
      totalAtraso += valor;
    } else {
      aVencerEmAberto += valor;
    }
  }

  // 2. Ler Projetos do Mês Corrente na tabela lancamentos do Supabase
  const mapaProjetos = new Map<string, number>();
  try {
    const db = supabaseAdmin();
    const { data: lancs } = await db
      .from("lancamentos")
      .select("faturar, status, projetos(nome)")
      .eq("competencia", competenciaMes)
      .not("faturar", "is", null)
      .gt("faturar", 0);

    for (const l of lancs || []) {
      const st = String((l as any).status || "").trim().toUpperCase();
      if (st === "CANCELADO") continue;
      const valor = Number((l as any).faturar) || 0;
      if (valor <= 0) continue;
      const projObj = Array.isArray((l as any).projetos) ? (l as any).projetos[0] : (l as any).projetos;
      const nomeProj = String(projObj?.nome || "").trim().toUpperCase();
      if (!nomeProj) continue;
      mapaProjetos.set(nomeProj, Math.round(((mapaProjetos.get(nomeProj) || 0) + valor) * 100) / 100);
    }
  } catch (e) {
    console.warn("Aviso ao consultar lançamentos do mês corrente:", e);
  }

  const projetosMes = Array.from(mapaProjetos.entries())
    .map(([projeto, valor]) => ({ projeto, valor: Math.round(valor * 100) / 100 }))
    .sort((a, b) => a.projeto.localeCompare(b.projeto, "pt-BR"));

  const totalProjetos = Math.round(projetosMes.reduce((acc, p) => acc + p.valor, 0) * 100) / 100;
  totalAtraso = Math.round(totalAtraso * 100) / 100;
  aVencerEmAberto = Math.round(aVencerEmAberto * 100) / 100;
  const totalAReceber = Math.round((totalAtraso + aVencerEmAberto) * 100) / 100;

  return {
    dataReferencia: dataReferenciaISO,
    mesReferencia: mesNome,
    anoReferencia: anoRef,
    aReceberEmAtraso,
    totalAtraso,
    aVencerEmAberto,
    totalAReceber,
    projetosMes,
    totalProjetos,
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const acao = searchParams.get("acao");
    const dataRef = searchParams.get("dataReferencia") || new Date().toISOString().slice(0, 10);

    if (acao === "calcular_base") {
      const dadosBase = await calcularDadosBaseEmTempoReal(dataRef);
      return NextResponse.json({ success: true, dadosBase });
    }

    const historico = await obterHistoricoRelatorios();
    const dadosBaseTempoReal = await calcularDadosBaseEmTempoReal(dataRef);

    return NextResponse.json({
      success: true,
      historico,
      ultimoRelatorio: historico[0] || null,
      dadosBaseTempoReal,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Erro ao carregar acompanhamento semanal" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const historico = await obterHistoricoRelatorios();

    const dataReferencia = String(body.dataReferencia || new Date().toISOString().slice(0, 10)).trim();
    const dt = parseDataISO(dataReferencia);
    const mesReferencia = String(body.mesReferencia || MESES_NOMES[dt.getMonth()] || "NOVEMBRO").trim().toUpperCase();
    const anoReferencia = Number(body.anoReferencia) || dt.getFullYear();
    const id = String(body.id || `sem-${dataReferencia}`);

    // Se o usuário pediu para recalcular os blocos de base de dados no momento do salvamento, ou enviou no payload
    let dadosBase = body.usarDadosBaseTempoReal
      ? await calcularDadosBaseEmTempoReal(dataReferencia)
      : null;

    const sicoobCaixa = Number(body.posicaoFinanceira?.sicoob?.caixa) || 0;
    const sicoobAplic = Number(body.posicaoFinanceira?.sicoob?.aplicacao) || 0;
    const claraCaixa = Number(body.posicaoFinanceira?.clara?.caixa) || 0;
    const claraAplic = Number(body.posicaoFinanceira?.clara?.aplicacao) || 0;
    const itauCaixa = Number(body.posicaoFinanceira?.itau?.caixa) || 0;
    const itauAplic = Number(body.posicaoFinanceira?.itau?.aplicacao) || 0;

    const totalPosicaoCalculado =
      Math.round((sicoobCaixa + sicoobAplic + claraCaixa + claraAplic + itauCaixa + itauAplic) * 100) / 100;

    const capVencidos = Number(body.contasAPagar?.vencidos) || 0;
    const capHoje = Number(body.contasAPagar?.vencemHoje) || 0;
    const capAVencer = Number(body.contasAPagar?.aVencer) || 0;
    const capPagos = Number(body.contasAPagar?.pagos) || 0;
    const capTotal =
      body.contasAPagar?.totalPeriodo !== undefined && body.contasAPagar?.totalPeriodo !== null
        ? Number(body.contasAPagar.totalPeriodo)
        : Math.round((capVencidos + capHoje + capAVencer + capPagos) * 100) / 100;

    const carVencidos = Number(body.contasAReceber?.vencidos) || 0;
    const carHoje = Number(body.contasAReceber?.vencemHoje) || 0;
    const carAVencer = Number(body.contasAReceber?.aVencer) || 0;
    const carPagos = Number(body.contasAReceber?.pagos) || 0;
    const carTotal =
      body.contasAReceber?.totalPeriodo !== undefined && body.contasAReceber?.totalPeriodo !== null
        ? Number(body.contasAReceber.totalPeriodo)
        : Math.round((carVencidos + carHoje + carAVencer + carPagos) * 100) / 100;

    const cbAnos = {
      "2023": Number(body.cashBack?.anos?.["2023"]) || 0,
      "2024": Number(body.cashBack?.anos?.["2024"]) || 0,
      "2025": Number(body.cashBack?.anos?.["2025"]) || 0,
      "2026": Number(body.cashBack?.anos?.["2026"]) || 0,
    };
    const cbTotal =
      body.cashBack?.totalAcumulado !== undefined && body.cashBack?.totalAcumulado !== null
        ? Number(body.cashBack.totalAcumulado)
        : Math.round((cbAnos["2023"] + cbAnos["2024"] + cbAnos["2025"] + cbAnos["2026"]) * 100) / 100;

    const clAnos = {
      "2023": Number(body.claraDesconto?.anos?.["2023"]) || 0,
      "2024": Number(body.claraDesconto?.anos?.["2024"]) || 0,
      "2025": Number(body.claraDesconto?.anos?.["2025"]) || 0,
      "2026": Number(body.claraDesconto?.anos?.["2026"]) || 0,
    };
    const clTotal =
      body.claraDesconto?.totalAcumulado !== undefined && body.claraDesconto?.totalAcumulado !== null
        ? Number(body.claraDesconto.totalAcumulado)
        : Math.round((clAnos["2023"] + clAnos["2024"] + clAnos["2025"] + clAnos["2026"]) * 100) / 100;

    const novoRelatorio = {
      id,
      dataReferencia,
      mesReferencia,
      anoReferencia,
      criadoEm: new Date().toISOString(),
      criadoPor: String(body.criadoPor || "Diretoria Executiva"),
      posicaoFinanceira: {
        total: totalPosicaoCalculado,
        sicoob: {
          caixa: sicoobCaixa,
          aplicacao: sicoobAplic,
          rentabilidade: String(body.posicaoFinanceira?.sicoob?.rentabilidade || "+0,00%"),
        },
        clara: {
          caixa: claraCaixa,
          aplicacao: claraAplic,
          rentabilidade: String(body.posicaoFinanceira?.clara?.rentabilidade || "+0,00%"),
        },
        itau: {
          caixa: itauCaixa,
          aplicacao: itauAplic,
          rentabilidade: String(body.posicaoFinanceira?.itau?.rentabilidade || "+0,00%"),
        },
      },
      contasAPagar: {
        vencidos: capVencidos,
        vencemHoje: capHoje,
        aVencer: capAVencer,
        pagos: capPagos,
        totalPeriodo: capTotal,
      },
      contasAReceber: {
        vencidos: carVencidos,
        vencemHoje: carHoje,
        aVencer: carAVencer,
        pagos: carPagos,
        totalPeriodo: carTotal,
      },
      cashBack: {
        totalAcumulado: cbTotal,
        anos: cbAnos,
      },
      claraDesconto: {
        totalAcumulado: clTotal,
        anos: clAnos,
      },
      aReceberEmAtraso: dadosBase
        ? dadosBase.aReceberEmAtraso
        : Array.isArray(body.aReceberEmAtraso)
        ? body.aReceberEmAtraso
        : [],
      totalAtraso: dadosBase ? dadosBase.totalAtraso : Number(body.totalAtraso) || 0,
      aVencerEmAberto: dadosBase ? dadosBase.aVencerEmAberto : Number(body.aVencerEmAberto) || 0,
      totalAReceber: dadosBase ? dadosBase.totalAReceber : Number(body.totalAReceber) || 0,
      projetosMes: dadosBase
        ? dadosBase.projetosMes
        : Array.isArray(body.projetosMes)
        ? body.projetosMes
        : [],
      totalProjetos: dadosBase ? dadosBase.totalProjetos : Number(body.totalProjetos) || 0,
    };

    const atualizado = [novoRelatorio, ...historico.filter((r) => r.id !== id && r.dataReferencia !== dataReferencia)].sort(
      (a, b) => String(b.dataReferencia).localeCompare(String(a.dataReferencia))
    );

    salvarHistoricoLocal(atualizado);

    try {
      const db = supabaseAdmin();
      await db
        .from("configuracoes")
        .upsert({ chave: CHAVE_CLOUD, descricao: JSON.stringify(atualizado) }, { onConflict: "chave" });
    } catch (e) {
      console.warn("Aviso ao salvar histórico no Supabase:", e);
    }

    return NextResponse.json({
      success: true,
      relatorio: novoRelatorio,
      historico: atualizado,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Erro ao salvar relatório semanal" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "ID do relatório é obrigatório" }, { status: 400 });
    }

    const historico = await obterHistoricoRelatorios();
    if (historico.length <= 1) {
      return NextResponse.json(
        { error: "Não é permitido excluir o único relatório do histórico." },
        { status: 400 }
      );
    }

    const atualizado = historico.filter((r) => r.id !== id);
    salvarHistoricoLocal(atualizado);

    try {
      const db = supabaseAdmin();
      await db
        .from("configuracoes")
        .upsert({ chave: CHAVE_CLOUD, descricao: JSON.stringify(atualizado) }, { onConflict: "chave" });
    } catch {}

    return NextResponse.json({
      success: true,
      historico: atualizado,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Erro ao excluir relatório semanal" }, { status: 500 });
  }
}
