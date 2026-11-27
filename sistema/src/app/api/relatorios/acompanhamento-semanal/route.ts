import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { supabaseAdmin } from "@/lib/supabase-server";
import { dispararEmail } from "@/lib/email-service";
import { lerUsuariosAsync } from "@/lib/usuarios-service";
import { formatarDataBR, formatarDataHoraBR } from "@/lib/date-utils";
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
  const dataHoraGeracaoBR = formatarDataHoraBR(rel.criadoEm || new Date().toISOString());
  const urlBase = process.env.NEXT_PUBLIC_APP_URL || "https://gestao.nnos.com.br";
  const urlRelatorio = `${urlBase}/relatorios/acompanhamento-semanal`;
  const urlLogin = `${urlBase}/login?redirect=${encodeURIComponent("/relatorios/acompanhamento-semanal")}`;
  const urlLogoBranca = `${urlBase}/logo-horizontal-branca.png`;

  const calcVarBadge = (atual: number, ant?: number | null, inverter = false, pill = false) => {
    if (!ant || ant === 0) return "";
    const diff = atual - ant;
    const pct = Math.round((Math.abs(diff) / Math.abs(ant)) * 100);
    const subiu = diff >= 0;
    const bom = inverter ? !subiu : subiu;
    const cor = bom ? "#15803d" : "#be123c";
    const bg = bom ? "#ecfdf5" : "#fff1f2";
    const borda = bom ? "#a7f3d0" : "#fecdd3";
    const seta = subiu ? "▲" : "▼";
    const radius = pill ? "999px" : "6px";
    return `<span style="display:inline-block;padding:3px 10px;border-radius:${radius};font-size:11px;font-weight:700;background-color:${bg};color:${cor};border:1px solid ${borda};white-space:nowrap;">${seta} ${pct}% vs. anterior</span>`;
  };

  const sicoobCaixa = Number(rel.posicaoFinanceira?.sicoob?.caixa) || 0;
  const claraCaixa = Number(rel.posicaoFinanceira?.clara?.caixa) || 0;
  const itauCaixa = Number(rel.posicaoFinanceira?.itau?.caixa) || 0;

  const idSeguranca = `NNOS-FIN-${rel.anoReferencia || 2026}${String(rel.dataReferencia || "").slice(5, 7) || "11"}-${String(Math.abs(Math.round(Number(rel.posicaoFinanceira?.total) || 884))).slice(-3).padStart(3, "0")}`;

  return `
  <div style="background-color:#eef4f8;padding:24px 12px;font-family:'Plus Jakarta Sans','Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#334155;">
    <div style="max-width:760px;margin:0 auto;background-color:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 12px 32px rgba(15,42,74,0.08);">
      <div style="padding:24px 28px;background-color:#ffffff;">

        <!-- Corporate Branded Banner (Background sólido #005a87 + fallback gradient para máxima legibilidade em Gmail/Outlook) -->
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#005a87;background-image:linear-gradient(90deg,#00527c 0%,#005a87 55%,#013f61 100%);border-radius:12px;margin-bottom:22px;border:1px solid #004366;">
          <tr>
            <td style="padding:20px 22px;color:#ffffff;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="vertical-align:middle;">
                    <table cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td style="width:46px;height:46px;background-color:#0b6e99;border:1px solid #38bdf8;border-radius:10px;text-align:center;vertical-align:middle;font-size:22px;color:#e0f2fe;">
                          📅
                        </td>
                        <td style="padding-left:14px;vertical-align:middle;">
                          <div style="font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#bae6fd;line-height:1.2;">
                            ${dataBR}
                          </div>
                          <div style="font-size:21px;font-weight:800;color:#ffffff;letter-spacing:-0.01em;line-height:1.25;margin-top:2px;">
                            ACOMPANHAMENTO SEMANAL <span style="font-weight:400;color:#7dd3fc;margin:0 4px;">|</span> ${rel.mesReferencia}
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right" style="vertical-align:middle;border-left:1px solid rgba(255,255,255,0.22);padding-left:18px;width:170px;">
                    <img src="${urlLogoBranca}" alt="NNÓS" width="135" style="display:block;max-width:135px;height:auto;border:0;color:#ffffff;font-size:20px;font-weight:800;" />
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- Dispatch Metadata & Intro -->
        <div style="margin-bottom:22px;padding-bottom:16px;border-bottom:1px solid #f1f5f9;">
          <div style="font-size:11.5px;font-weight:800;text-transform:uppercase;letter-spacing:0.07em;color:#0369a1;">
            DIRETORIA EXECUTIVA <span style="color:#cbd5e1;margin:0 6px;">•</span> BOLETIM FINANCEIRO
          </div>
          <div style="font-size:12px;color:#475569;margin-top:4px;">
            Posição fechada em <strong style="color:#1e293b;">${dataBR}</strong> • Publicado por <strong style="color:#1e293b;">${rel.criadoPor || "Leonardo Campos"}</strong>
          </div>
          <div style="margin-top:16px;font-size:14px;line-height:1.65;color:#334155;">
            <p style="margin:0 0 8px 0;">Olá, <strong style="color:#0f172a;">${destinatarioNome}</strong>,</p>
            <p style="margin:0;">
              O novo relatório de <strong style="color:#0f172a;">Acompanhamento Semanal (${dataBR})</strong> referente ao mês de <strong style="color:#0f172a;">${rel.mesReferencia}</strong> já está disponível para consulta na Central de Relatórios do Portal Corporativo NNÓS. Confira abaixo o resumo executivo dos principais indicadores financeiros e operacionais:
            </p>
          </div>
        </div>

        <!-- Bloco 1: Posição Financeira Consolidada -->
        <div style="background-color:#ffffff;border:1px solid #e0f2fe;border-radius:12px;padding:18px 20px;margin-bottom:18px;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:10px;">
            <tr>
              <td style="font-size:13px;font-weight:800;color:#075985;text-transform:uppercase;letter-spacing:0.04em;">
                1. POSIÇÃO FINANCEIRA CONSOLIDADA (CAIXA + APLICAÇÕES)
              </td>
              <td align="right">
                ${calcVarBadge(rel.posicaoFinanceira?.total, relAnterior?.posicaoFinanceira?.total, false, true)}
              </td>
            </tr>
          </table>

          <div style="font-size:32px;font-weight:800;color:#005a87;letter-spacing:-0.02em;margin-bottom:14px;">
            R$ ${fmtMoeda(rel.posicaoFinanceira?.total)}
          </div>

          <div style="border:1px solid #f1f5f9;border-radius:10px;overflow:hidden;background-color:#fbfdfd;">
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;font-size:13px;">
              <thead>
                <tr style="background-color:#f8fafc;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:11px;font-weight:700;text-transform:uppercase;">
                  <th align="left" style="padding:10px 12px;">Instituição</th>
                  <th align="right" style="padding:10px 12px;">Caixa</th>
                  <th align="right" style="padding:10px 12px;">Aplicação</th>
                  <th align="right" style="padding:10px 12px;">Rentabilidade</th>
                </tr>
              </thead>
              <tbody>
                <tr style="border-bottom:1px solid #f1f5f9;">
                  <td style="padding:10px 12px;font-weight:800;color:#1e293b;">
                    <span style="display:inline-block;width:18px;height:18px;line-height:18px;text-align:center;border-radius:4px;background-color:#00363a;color:#00ae9d;font-size:10px;margin-right:6px;vertical-align:middle;">◆</span>
                    <span style="vertical-align:middle;">SICOOB</span>
                  </td>
                  <td align="right" style="padding:10px 12px;font-weight:600;color:${sicoobCaixa < 0 ? "#e11d48" : "#334155"};">${fmtMoeda(sicoobCaixa)}</td>
                  <td align="right" style="padding:10px 12px;font-weight:600;color:#334155;">${fmtMoeda(rel.posicaoFinanceira?.sicoob?.aplicacao)}</td>
                  <td align="right" style="padding:10px 12px;font-weight:700;color:#059669;background-color:#f0fdf4;">${rel.posicaoFinanceira?.sicoob?.rentabilidade || "+0,00%"}</td>
                </tr>
                <tr style="border-bottom:1px solid #f1f5f9;">
                  <td style="padding:10px 12px;font-weight:800;color:#1e293b;">
                    <span style="display:inline-block;width:18px;height:18px;line-height:18px;text-align:center;border-radius:999px;background-color:#0f172a;color:#ffffff;font-size:10px;margin-right:6px;vertical-align:middle;">✦</span>
                    <span style="vertical-align:middle;">CLARA</span>
                  </td>
                  <td align="right" style="padding:10px 12px;font-weight:600;color:${claraCaixa < 0 ? "#e11d48" : "#334155"};">${fmtMoeda(claraCaixa)}</td>
                  <td align="right" style="padding:10px 12px;font-weight:600;color:#334155;">${fmtMoeda(rel.posicaoFinanceira?.clara?.aplicacao)}</td>
                  <td align="right" style="padding:10px 12px;font-weight:700;color:#059669;background-color:#f0fdf4;">${rel.posicaoFinanceira?.clara?.rentabilidade || "+0,00%"}</td>
                </tr>
                <tr>
                  <td style="padding:10px 12px;font-weight:800;color:#1e293b;">
                    <span style="display:inline-block;padding:1px 4px;border-radius:4px;background-color:#ec7000;color:#ffffff;font-size:9px;font-weight:800;margin-right:6px;vertical-align:middle;">itaú</span>
                    <span style="vertical-align:middle;">ITAÚ</span>
                  </td>
                  <td align="right" style="padding:10px 12px;font-weight:600;color:${itauCaixa < 0 ? "#e11d48" : "#334155"};">${fmtMoeda(itauCaixa)}</td>
                  <td align="right" style="padding:10px 12px;font-weight:600;color:#334155;">${fmtMoeda(rel.posicaoFinanceira?.itau?.aplicacao)}</td>
                  <td align="right" style="padding:10px 12px;font-weight:700;color:#059669;background-color:#f0fdf4;">${rel.posicaoFinanceira?.itau?.rentabilidade || "+0,00%"}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Bloco 2: Fluxo do Período: Contas a Pagar & Contas a Receber -->
        <div style="background-color:#ffffff;border:1px solid #e0f2fe;border-radius:12px;padding:18px 20px;margin-bottom:18px;">
          <div style="font-size:13px;font-weight:800;color:#075985;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:12px;">
            2. FLUXO DO PERÍODO: CONTAS A PAGAR &amp; CONTAS A RECEBER
          </div>

          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr>
              <!-- Sub-Card: Contas a Pagar -->
              <td width="49%" valign="top" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;">
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:8px;">
                  <tr>
                    <td style="font-size:12.5px;font-weight:700;color:#1e293b;">
                      <span style="display:inline-block;width:8px;height:8px;border-radius:999px;background-color:#f43f5e;margin-right:5px;vertical-align:middle;"></span>
                      Contas a Pagar (Total)
                    </td>
                    <td align="right">
                      ${calcVarBadge(rel.contasAPagar?.totalPeriodo, relAnterior?.contasAPagar?.totalPeriodo, true)}
                    </td>
                  </tr>
                </table>
                <div style="font-size:20px;font-weight:800;color:#0f172a;margin-bottom:10px;">
                  R$ ${fmtMoeda(rel.contasAPagar?.totalPeriodo)}
                </div>
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-top:1px solid #e2e8f0;padding-top:8px;font-size:12px;">
                  <tr>
                    <td width="50%" style="padding:4px 0;">
                      <div style="font-size:11px;color:#64748b;">Vencidos:</div>
                      <div style="font-weight:700;color:#334155;">R$ ${fmtMoeda(rel.contasAPagar?.vencidos)}</div>
                    </td>
                    <td width="50%" style="padding:4px 0;">
                      <div style="font-size:11px;color:#64748b;">Vencem Hoje:</div>
                      <div style="font-weight:700;color:#e11d48;">R$ ${fmtMoeda(rel.contasAPagar?.vencemHoje)}</div>
                    </td>
                  </tr>
                  <tr>
                    <td width="50%" style="padding:4px 0;">
                      <div style="font-size:11px;color:#64748b;">A Vencer:</div>
                      <div style="font-weight:700;color:#334155;">R$ ${fmtMoeda(rel.contasAPagar?.aVencer)}</div>
                    </td>
                    <td width="50%" style="padding:4px 0;">
                      <div style="font-size:11px;color:#64748b;">Pagos:</div>
                      <div style="font-weight:700;color:#047857;">R$ ${fmtMoeda(rel.contasAPagar?.pagos)}</div>
                    </td>
                  </tr>
                </table>
              </td>

              <td width="2%">&nbsp;</td>

              <!-- Sub-Card: Contas a Receber -->
              <td width="49%" valign="top" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;">
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:8px;">
                  <tr>
                    <td style="font-size:12.5px;font-weight:700;color:#1e293b;">
                      <span style="display:inline-block;width:8px;height:8px;border-radius:999px;background-color:#10b981;margin-right:5px;vertical-align:middle;"></span>
                      Contas a Receber (Total)
                    </td>
                    <td align="right">
                      ${calcVarBadge(rel.contasAReceber?.totalPeriodo, relAnterior?.contasAReceber?.totalPeriodo, false)}
                    </td>
                  </tr>
                </table>
                <div style="font-size:20px;font-weight:800;color:#0f172a;margin-bottom:10px;">
                  R$ ${fmtMoeda(rel.contasAReceber?.totalPeriodo)}
                </div>
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-top:1px solid #e2e8f0;padding-top:8px;font-size:12px;">
                  <tr>
                    <td width="50%" style="padding:4px 0;">
                      <div style="font-size:11px;color:#64748b;">Vencidos:</div>
                      <div style="font-weight:700;color:#e11d48;">R$ ${fmtMoeda(rel.contasAReceber?.vencidos)}</div>
                    </td>
                    <td width="50%" style="padding:4px 0;">
                      <div style="font-size:11px;color:#64748b;">Vencem Hoje:</div>
                      <div style="font-weight:700;color:#334155;">R$ ${fmtMoeda(rel.contasAReceber?.vencemHoje)}</div>
                    </td>
                  </tr>
                  <tr>
                    <td width="50%" style="padding:4px 0;">
                      <div style="font-size:11px;color:#64748b;">A Vencer:</div>
                      <div style="font-weight:700;color:#334155;">R$ ${fmtMoeda(rel.contasAReceber?.aVencer)}</div>
                    </td>
                    <td width="50%" style="padding:4px 0;">
                      <div style="font-size:11px;color:#64748b;">Pagos:</div>
                      <div style="font-weight:700;color:#047857;">R$ ${fmtMoeda(rel.contasAReceber?.pagos)}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </div>

        <!-- Bloco 3: Recebíveis & Faturamento de Projetos -->
        <div style="background-color:#ffffff;border:1px solid #e0f2fe;border-radius:12px;padding:18px 20px;margin-bottom:22px;">
          <div style="font-size:13px;font-weight:800;color:#075985;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:12px;">
            3. RECEBÍVEIS &amp; FATURAMENTO DE PROJETOS (${rel.mesReferencia})
          </div>

          <div style="background-color:#f0f9ff;border:1px solid #e0f2fe;border-radius:10px;padding:12px 14px;font-size:13px;color:#334155;">
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="padding:6px 0;">
                  • <strong style="color:#0f172a;">Total a Receber:</strong> R$ ${fmtMoeda(rel.totalAReceber)}
                </td>
                <td align="right" style="padding:6px 0;font-size:12px;color:#475569;">
                  (A Vencer em Aberto: <strong style="color:#0f172a;">R$ ${fmtMoeda(rel.aVencerEmAberto)}</strong>)
                </td>
              </tr>
              <tr>
                <td style="padding:8px 0;border-top:1px solid #e0f2fe;">
                  • <strong style="color:#0f172a;">A Receber em Atraso:</strong> <span style="color:#e11d48;font-weight:800;">R$ ${fmtMoeda(rel.totalAtraso)}</span> (${(rel.aReceberEmAtraso || []).length} títulos)
                </td>
                <td align="right" style="padding:8px 0;border-top:1px solid #e0f2fe;">
                  ${calcVarBadge(rel.totalAtraso, relAnterior?.totalAtraso, true)}
                </td>
              </tr>
              <tr>
                <td style="padding:8px 0;border-top:1px solid #e0f2fe;">
                  • <strong style="color:#0f172a;">Faturamento de Projetos (${rel.mesReferencia}):</strong> <span style="color:#047857;font-weight:800;">R$ ${fmtMoeda(rel.totalProjetos)}</span> (${(rel.projetosMes || []).length} projetos)
                </td>
                <td align="right" style="padding:8px 0;border-top:1px solid #e0f2fe;">
                  ${calcVarBadge(rel.totalProjetos, relAnterior?.totalProjetos, false)}
                </td>
              </tr>
              <tr>
                <td colspan="2" style="padding:8px 0 4px 0;border-top:1px solid #e0f2fe;">
                  • <strong style="color:#0f172a;">Cash Back &amp; Benefícios:</strong> Cash Back <strong style="color:#0f172a;">R$ ${fmtMoeda(rel.cashBack?.totalAcumulado)}</strong> | Clara Desconto na Fatura <strong style="color:#0f172a;">R$ ${fmtMoeda(rel.claraDesconto?.totalAcumulado)}</strong>
                </td>
              </tr>
            </table>
          </div>
        </div>

        <!-- Bloco de Autenticação e Acesso Seguro ao Portal NNÓS -->
        <div style="background-color:#f0f9ff;border:1px solid #bae6fd;border-radius:12px;padding:22px 20px;text-align:center;">
          <div style="font-size:13px;font-weight:800;color:#075985;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:8px;">
            🔒 ACESSO SEGURO AO PAINEL EXECUTIVO
          </div>
          <p style="margin:0 auto 16px auto;max-width:560px;font-size:13px;color:#475569;line-height:1.6;">
            Para visualizar o painel gráfico completo, consultar o histórico comparativo ou baixar a versão em alta definição (<strong>.PNG</strong>), acesse o sistema utilizando seu <strong style="color:#0f172a;">usuário (${destinatarioLogin})</strong> e <strong style="color:#0f172a;">senha corporativa</strong>:
          </p>
          <div style="margin:14px 0;">
            <a href="${urlLogin}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:13px 26px;background-color:#005a87;color:#ffffff;font-size:13.5px;font-weight:700;text-decoration:none;border-radius:8px;">
              Acessar Acompanhamento Semanal no Portal &nbsp;→
            </a>
          </div>
          <p style="margin:12px 0 0 0;font-size:11.5px;color:#475569;">
            Link direto após login:
            <a href="${urlRelatorio}" target="_blank" rel="noopener noreferrer" style="color:#0369a1;text-decoration:underline;font-family:monospace;">
              ${urlRelatorio}
            </a>
          </p>
        </div>

        <!-- Rodapé Corporativo -->
        <div style="margin-top:26px;padding-top:18px;border-top:1px solid #f1f5f9;text-align:center;color:#475569;">
          <div style="font-size:12px;font-weight:600;color:#475569;margin-bottom:4px;">
            NNÓS Gestão Empresarial • Transformando Estratégias em Realidade
          </div>
          <div style="font-size:11px;color:#64748b;margin-bottom:4px;">
            Este é um comunicado financeiro confidencial e destinado exclusivamente ao corpo diretivo.
          </div>
          <div style="font-size:10.5px;color:#94a3b8;">
            Gerado automaticamente em ${dataHoraGeracaoBR} • ID de Segurança: ${idSeguranca}
          </div>
        </div>

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

    // Modo exclusivo de teste de envio de e-mail para um destinatário específico (ex.: leonardo.campos@nnos.com.br)
    if (body.acao === "testar_email_individual") {
      const relId = String(body.relatorioId || historico[0]?.id || "");
      const idxRel = historico.findIndex((r) => r.id === relId);
      const relAlvo = idxRel >= 0 ? historico[idxRel] : historico[0];
      const relAnt = idxRel >= 0 && idxRel + 1 < historico.length ? historico[idxRel + 1] : historico[1] || null;

      if (!relAlvo) {
        return NextResponse.json({ error: "Nenhum relatório encontrado para gerar o e-mail de teste." }, { status: 404 });
      }

      const emailAlvo = String(body.emailDestinatario || "leonardo.campos@nnos.com.br").trim();
      const nomeAlvo = String(body.nomeDestinatario || "Leonardo Campos").trim();
      const loginAlvo = String(body.loginDestinatario || "leonardo.campos").trim();
      const dataBR = formatarDataBR(relAlvo.dataReferencia);
      const assunto = `📊 [TESTE] Acompanhamento Semanal NNÓS (${dataBR} • ${relAlvo.mesReferencia}) | Resumo Executivo`;
      const html = construirHtmlEmailExecutivo(relAlvo, relAnt, nomeAlvo, loginAlvo);

      const resultado = await dispararEmail({
        para: emailAlvo,
        assunto,
        html,
      });

      return NextResponse.json({
        success: true,
        testeIndividual: true,
        destinatario: emailAlvo,
        assunto,
        htmlPreview: html,
        resultado,
      });
    }

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

    const idxNovo = atualizado.findIndex((r) => r.id === novoRelatorio.id);
    const relAnterior = idxNovo >= 0 && idxNovo + 1 < atualizado.length ? atualizado[idxNovo + 1] : null;
    const htmlPreview = construirHtmlEmailExecutivo(
      novoRelatorio,
      relAnterior,
      "Leonardo Campos",
      "leonardo.campos"
    );

    // Disparo automático de e-mail executivo para a Diretoria Executiva e Admin
    const resultadosEmail: { destinatario: string; sucesso: boolean; modo?: string; mensagem?: string }[] = [];
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
          mensagem: resEmail.mensagem,
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
      htmlPreview,
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
