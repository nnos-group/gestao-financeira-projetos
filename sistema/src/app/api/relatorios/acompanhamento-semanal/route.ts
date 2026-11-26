import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { supabaseAdmin } from "@/lib/supabase-server";
import { dispararEmail } from "@/lib/email-service";
import { lerUsuariosAsync } from "@/lib/usuarios-service";
import { formatarDataBR } from "@/lib/date-utils";
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

function fmtMoeda(v: number | undefined | null): string {
  const n = Number(v) || 0;
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

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

async function calcularDadosBaseEmTempoReal(dataReferenciaISO: string) {
  const dataRef = parseDataISO(dataReferenciaISO);
  const anoRef = dataRef.getFullYear();
  const mesNum = dataRef.getMonth() + 1;
  const mesNome = MESES_NOMES[mesNum - 1] || "NOVEMBRO";
  const competenciaMes = `${anoRef}-${String(mesNum).padStart(2, "0")}-01`;

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

function construirHtmlEmailExecutivo(rel: any, relAnterior: any | null, destinatarioNome: string, destinatarioLogin: string) {
  const dataBR = formatarDataBR(rel.dataReferencia);
  const urlBase = process.env.NEXT_PUBLIC_APP_URL || "https://gestao.nnos.com.br";
  const urlLogin = `${urlBase}/login`;
  const urlRelatorio = `${urlBase}/relatorios/acompanhamento-semanal`;

  const calcVarStr = (atual: number, ant?: number | null, inverter = false) => {
    if (!ant || ant === 0) return "";
    const diff = atual - ant;
    const pct = Math.round((Math.abs(diff) / Math.abs(ant)) * 100);
    const subiu = diff >= 0;
    const bom = inverter ? !subiu : subiu;
    const cor = bom ? "#059669" : "#e11d48";
    const bg = bom ? "#ecfdf5" : "#fff1f2";
    const seta = subiu ? "▲" : "▼";
    return `<span style="display:inline-block;margin-left:6px;padding:2px 7px;border-radius:999px;font-size:11px;font-weight:700;background-color:${bg};color:${cor};">${seta} ${pct}% vs. anterior</span>`;
  };

  return `
  <div style="background-color:#f1f5f9;padding:28px 16px;">
    <div style="max-width:680px;margin:0 auto;background-color:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 10px 30px rgba(15,42,74,0.08);">
      <!-- Banner Superior -->
      <div style="background:linear-gradient(90deg,#0099c8 0%,#0973ae 45%,#004c8c 100%);padding:24px 28px;color:#ffffff;">
        <div style="font-size:11px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#bae6fd;margin-bottom:4px;">
          DIRETORIA EXECUTIVA • BOLETIM FINANCEIRO
        </div>
        <h1 style="margin:0;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.01em;">
          Acompanhamento Semanal | ${rel.mesReferencia}/${rel.anoReferencia}
        </h1>
        <div style="margin-top:6px;font-size:13px;color:#e0f2fe;font-weight:600;">
          Posição fechada em <strong>${dataBR}</strong> • Publicado por ${rel.criadoPor || "Controladoria & Finanças"}
        </div>
      </div>

      <!-- Corpo -->
      <div style="padding:26px 28px;color:#1e293b;">
        <p style="margin:0 0 14px 0;font-size:14.5px;line-height:1.6;">
          Olá, <strong>${destinatarioNome}</strong>,
        </p>
        <p style="margin:0 0 20px 0;font-size:14px;line-height:1.65;color:#334155;">
          O novo relatório de <strong>Acompanhamento Semanal (${dataBR})</strong> referente ao mês de <strong>${rel.mesReferencia}</strong> já está disponível para consulta na Central de Relatórios do Portal Corporativo NNÓS. Confira abaixo o resumo executivo dos principais indicadores financeiros e operacionais:
        </p>

        <!-- Resumo Executivo em Cards -->
        <table style="width:100%;border-collapse:separate;border-spacing:0 10px;">
          <tr>
            <td style="padding:14px 16px;background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;">
              <div style="font-size:11px;font-weight:800;color:#0284c7;text-transform:uppercase;letter-spacing:0.04em;">
                1. Posição Financeira Consolidada (Caixa + Aplicações)
              </div>
              <div style="font-size:22px;font-weight:800;color:#0f172a;margin-top:4px;">
                R$ ${fmtMoeda(rel.posicaoFinanceira?.total)}
                ${calcVarStr(rel.posicaoFinanceira?.total, relAnterior?.posicaoFinanceira?.total)}
              </div>
              <div style="font-size:12px;color:#475569;margin-top:6px;line-height:1.5;">
                • <strong>Sicoob:</strong> Caixa R$ ${fmtMoeda(rel.posicaoFinanceira?.sicoob?.caixa)} | Aplicação R$ ${fmtMoeda(rel.posicaoFinanceira?.sicoob?.aplicacao)} (${rel.posicaoFinanceira?.sicoob?.rentabilidade})<br/>
                • <strong>Clara:</strong> Caixa R$ ${fmtMoeda(rel.posicaoFinanceira?.clara?.caixa)} | Aplicação R$ ${fmtMoeda(rel.posicaoFinanceira?.clara?.aplicacao)} (${rel.posicaoFinanceira?.clara?.rentabilidade})<br/>
                • <strong>Itaú:</strong> Caixa R$ ${fmtMoeda(rel.posicaoFinanceira?.itau?.caixa)} | Aplicação R$ ${fmtMoeda(rel.posicaoFinanceira?.itau?.aplicacao)} (${rel.posicaoFinanceira?.itau?.rentabilidade})
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding:14px 16px;background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;">
              <div style="font-size:11px;font-weight:800;color:#0284c7;text-transform:uppercase;letter-spacing:0.04em;">
                2. Fluxo do Período: Contas a Pagar &amp; Contas a Receber
              </div>
              <div style="font-size:13px;color:#1e293b;margin-top:6px;line-height:1.6;">
                • <strong>Contas a Pagar (Total):</strong> R$ ${fmtMoeda(rel.contasAPagar?.totalPeriodo)} ${calcVarStr(rel.contasAPagar?.totalPeriodo, relAnterior?.contasAPagar?.totalPeriodo, true)}<br/>
                <span style="font-size:12px;color:#64748b;">Pagos: R$ ${fmtMoeda(rel.contasAPagar?.pagos)} | Vencem Hoje: R$ ${fmtMoeda(rel.contasAPagar?.vencemHoje)} | A Vencer: R$ ${fmtMoeda(rel.contasAPagar?.aVencer)}</span><br/>
                • <strong>Contas a Receber (Total):</strong> R$ ${fmtMoeda(rel.contasAReceber?.totalPeriodo)} ${calcVarStr(rel.contasAReceber?.totalPeriodo, relAnterior?.contasAReceber?.totalPeriodo)}<br/>
                <span style="font-size:12px;color:#64748b;">Pagos: R$ ${fmtMoeda(rel.contasAReceber?.pagos)} | Vencidos: R$ ${fmtMoeda(rel.contasAReceber?.vencidos)} | A Vencer: R$ ${fmtMoeda(rel.contasAReceber?.aVencer)}</span>
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding:14px 16px;background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;">
              <div style="font-size:11px;font-weight:800;color:#0284c7;text-transform:uppercase;letter-spacing:0.04em;">
                3. Recebíveis &amp; Faturamento de Projetos (${rel.mesReferencia})
              </div>
              <div style="font-size:13px;color:#1e293b;margin-top:6px;line-height:1.6;">
                • <strong>Total a Receber:</strong> R$ ${fmtMoeda(rel.totalAReceber)} (A Vencer em Aberto: <strong>R$ ${fmtMoeda(rel.aVencerEmAberto)}</strong>)<br/>
                • <strong>A Receber em Atraso:</strong> <span style="color:#dc2626;font-weight:700;">R$ ${fmtMoeda(rel.totalAtraso)}</span> (${(rel.aReceberEmAtraso || []).length} títulos) ${calcVarStr(rel.totalAtraso, relAnterior?.totalAtraso, true)}<br/>
                • <strong>Faturamento de Projetos (${rel.mesReferencia}):</strong> <span style="color:#059669;font-weight:800;">R$ ${fmtMoeda(rel.totalProjetos)}</span> (${(rel.projetosMes || []).length} projetos) ${calcVarStr(rel.totalProjetos, relAnterior?.totalProjetos)}<br/>
                • <strong>Cash Back &amp; Benefícios:</strong> Cash Back R$ ${fmtMoeda(rel.cashBack?.totalAcumulado)} | Clara Desconto R$ ${fmtMoeda(rel.claraDesconto?.totalAcumulado)}
              </div>
            </td>
          </tr>
        </table>

        <!-- Box de Acesso mediante Login e Senha -->
        <div style="margin-top:18px;padding:18px 20px;background-color:#f0f9ff;border:1px solid #bae6fd;border-radius:14px;text-align:center;">
          <div style="font-size:12px;font-weight:800;color:#0369a1;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:6px;">
            🔒 ACESSO SEGURO AO PAINEL EXECUTIVO
          </div>
          <p style="margin:0 0 14px 0;font-size:13px;color:#334155;line-height:1.55;">
            Para visualizar o painel gráfico completo, consultar o histórico comparativo ou baixar a versão em alta definição (<strong>.PNG</strong>), acesse o sistema utilizando seu <strong>usuário (${destinatarioLogin}) e senha corporativa</strong>:
          </p>
          <a href="${urlLogin}" style="display:inline-block;padding:12px 26px;background:linear-gradient(135deg,#0083ca 0%,#004c8c 100%);color:#ffffff;font-size:13.5px;font-weight:800;text-decoration:none;border-radius:10px;">
            Acessar Acompanhamento Semanal no Portal →
          </a>
          <div style="margin-top:10px;font-size:11.5px;color:#64748b;">
            Link direto após login: <a href="${urlRelatorio}" style="color:#0284c7;text-decoration:underline;">${urlRelatorio}</a>
          </div>
        </div>
      </div>

      <!-- Rodapé -->
      <div style="padding:14px 28px;background-color:#f8fafc;border-top:1px solid #e2e8f0;font-size:11.5px;color:#64748b;text-align:center;">
        NNÓS Consultoria &amp; Treinamento • Sistema de Gestão Financeira &amp; Projetos
      </div>
    </div>
  </div>`;
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

    const dadosBase = body.usarDadosBaseTempoReal
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
      criadoPor: String(body.criadoPor || "Leonardo Campos"),
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

    // Identificar o relatório anterior ao recém-salvo para compor as variações no resumo executivo do e-mail
    const idxNovo = atualizado.findIndex((r) => r.id === novoRelatorio.id);
    const relAnterior = idxNovo >= 0 && idxNovo + 1 < atualizado.length ? atualizado[idxNovo + 1] : null;

    // Disparo automático de e-mail executivo para a Diretoria Executiva e Admin
    const resultadosEmail: { destinatario: string; sucesso: boolean; modo?: string }[] = [];
    try {
      const todosUsuarios: any[] = await lerUsuariosAsync();
      const destinatariosDiretoria = todosUsuarios.filter(
        (u: any) =>
          String(u?.status || "ATIVO").toUpperCase() === "ATIVO" &&
          u.email &&
          (u.perfilId === "DIRETORIA" || u.perfilId === "ADMIN")
      );

      const dataBR = formatarDataBR(novoRelatorio.dataReferencia);
      const assunto = `📊 Acompanhamento Semanal NNÓS (${dataBR} • ${novoRelatorio.mesReferencia}) | Resumo Executivo`;

      for (const dest of destinatariosDiretoria) {
        const html = construirHtmlEmailExecutivo(novoRelatorio, relAnterior, dest.nome, dest.login);
        const resEmail = await dispararEmail({
          para: dest.email,
          assunto,
          html,
        });
        resultadosEmail.push({
          destinatario: dest.email,
          sucesso: resEmail.sucesso,
          modo: resEmail.modo,
        });
      }
    } catch (e) {
      console.warn("Aviso ao disparar e-mails do Acompanhamento Semanal:", e);
    }

    return NextResponse.json({
      success: true,
      relatorio: novoRelatorio,
      historico: atualizado,
      emailsDisparados: resultadosEmail,
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
