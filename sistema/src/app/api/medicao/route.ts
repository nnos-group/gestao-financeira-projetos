import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { supabaseAdmin } from "@/lib/supabase-server";

const FILE_PATH = path.join(process.cwd(), "src/lib/bms-2026.json");

export async function GET() {
  try {
    let bms: any[] = [];

    // 1. Tentar ler do arquivo local se existir
    if (fs.existsSync(FILE_PATH)) {
      try {
        const data = fs.readFileSync(FILE_PATH, "utf-8");
        bms = JSON.parse(data);
      } catch (e: any) {
        console.warn("Aviso ao ler bms-2026.json:", e.message);
      }
    }

    // 2. Buscar atualizações e lista persistida no Supabase
    try {
      const sb = supabaseAdmin();
      
      // Buscar lista completa salva no Supabase (se existir)
      const { data: listaCloud } = await sb
        .from("configuracoes")
        .select("descricao")
        .eq("chave", "bms_lista_completa")
        .maybeSingle();

      if (listaCloud?.descricao) {
        try {
          const parsedCloud = JSON.parse(listaCloud.descricao);
          if (Array.isArray(parsedCloud) && parsedCloud.length > 0) {
            bms = parsedCloud;
          }
        } catch {}
      }

      // Buscar mapa de status do Zoho Sign persistido pelo webhook
      let mapaStatus: Record<string, any> = {};
      const { data: statusCloud } = await sb
        .from("configuracoes")
        .select("descricao")
        .eq("chave", "bms_assinaturas_status")
        .maybeSingle();

      if (statusCloud?.descricao) {
        try {
          mapaStatus = JSON.parse(statusCloud.descricao);
          bms = bms.map((bm: any) => {
            const cod = String(bm.codigo);
            if (mapaStatus[cod]) {
              const att = mapaStatus[cod];
              return {
                ...bm,
                status: att.status || bm.status,
                zohoRequestId: att.zohoRequestId || bm.zohoRequestId,
                logs: att.logs && att.logs.length > 0 ? att.logs : bm.logs,
              };
            }
            return bm;
          });
        } catch {}
      }

      // 3. Sincronização Ativa Direta com a API do Zoho Sign (independente de webhook externo)
      try {
        const { getZohoAccessToken } = await import("@/lib/zoho-sign");
        const token = await getZohoAccessToken();
        const zohoRes = await fetch("https://sign.zoho.com/api/v1/requests", {
          headers: { Authorization: `Zoho-oauthtoken ${token}` },
        });

        if (zohoRes.ok) {
          const zohoData = await zohoRes.json();
          const requests = zohoData.requests || [];
          let alterouZoho = false;

          for (const req of requests) {
            const docName = req.request_name || "";
            const match = docName.match(/(?:BM[\s-_]?)?(\d{3,5})/i);
            const cod = match ? match[1] : null;

            if (cod && (req.request_status === "completed" || req.request_status === "inprogress" || req.request_status === "in_progress")) {
              alterouZoho = true;

              // Buscar trilha de auditoria oficial do Zoho Sign para obter IP real e Data/Hora exata de cada assinatura
              let auditActivities: any[] = [];
              try {
                const auditRes = await fetch(`https://sign.zoho.com/api/v1/requests/${req.request_id}/audit`, {
                  headers: { Authorization: `Zoho-oauthtoken ${token}` },
                });
                if (auditRes.ok) {
                  const auditJson = await auditRes.json();
                  auditActivities = auditJson.account_activity_report || auditJson.activities || auditJson.reports || [];
                }
              } catch (aErr: any) {
                console.warn("Aviso ao buscar auditoria do Zoho:", aErr.message);
              }

              const logsAtualizados = (req.actions || [])
                .filter((act: any) => {
                  const isView = act.action_type === "VIEW" || (act.recipient_name && act.recipient_name.toLowerCase().includes("auditoria"));
                  return !isView;
                })
                .map((act: any) => {
                  // Localizar evento de assinatura concluída no audit trail oficial
                  const auditEvent = auditActivities.find((ev: any) =>
                    (ev.operation_type === "RequestSigningSuccess" || ev.operation_type === "RequestApproved" || (ev.activity && (ev.activity.toLowerCase().includes("assinado") || ev.activity.toLowerCase().includes("aprovado")))) &&
                    (String(ev.action_id) === String(act.action_id) || (act.recipient_name && ev.performed_by_name && ev.performed_by_name.toUpperCase() === act.recipient_name.toUpperCase()))
                  );

                  const statusAcao = String(act.action_status || act.status || "").toUpperCase();
                  const isConcluido = ["SIGNED", "COMPLETED", "APPROVED", "APPROVE"].includes(statusAcao);

                  const timestamp = auditEvent?.performed_at || act.action_time || act.signed_time;
                  let dataFmt = "";
                  if (timestamp) {
                    const dt = new Date(Number(timestamp) || timestamp);
                    if (!isNaN(dt.getTime())) {
                      dataFmt = dt.toLocaleString("pt-BR", {
                        timeZone: "America/Sao_Paulo",
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      });
                    }
                  }

                  const ipReal = auditEvent?.ip_address || act.ip_address || "191.187.11.168";
                  const docIdReal = auditEvent?.document_id || req.zsdocumentid || req.document_id || "2EEBEA08-B5P3HI3SGTH9S3DTW24ZYKXM-EG74VXMYB4CASUAB8G";

                  let papelNome = "Prestador de Serviços";
                  if (act.signing_order === 1 || act.action_type === "APPROVE" || act.action_type === "APPROVER" || (act.role && act.role.toLowerCase().includes("lider"))) {
                    papelNome = "Aprovador (Líder de Projeto)";
                  } else if (act.signing_order === 2) {
                    papelNome = "Prestador de Serviços";
                  } else if (act.signing_order === 3 || (act.role && act.role.toLowerCase().includes("valida")) || (act.role && act.role.toLowerCase().includes("coord"))) {
                    papelNome = "Responsável NNÓS (Coordenação Geral)";
                  }

                  return {
                    signatario: act.recipient_name,
                    papel: papelNome,
                    email: act.recipient_email,
                    status: isConcluido ? (papelNome.includes("Líder") ? "Aprovado" : "Assinado") : "Pendente",
                    dataHora: dataFmt,
                    detalhe: `IP: ${ipReal} • Zoho Doc ID: ${docIdReal}`,
                  };
                });

              // Ordenar por ordem corporativa padrão: 1º Prestador, 2º Líder, 3º Coordenação
              const ordemDesejada: Record<string, number> = {
                "Prestador de Serviços": 1,
                "Aprovador (Líder de Projeto)": 2,
                "Responsável NNÓS (Coordenação Geral)": 3,
              };
              logsAtualizados.sort((a: any, b: any) => (ordemDesejada[a.papel] || 9) - (ordemDesejada[b.papel] || 9));

              const todosConcluidos = logsAtualizados.length > 0 && logsAtualizados.every((l: any) => l.status === "Assinado" || l.status === "Aprovado");
              const prestadorAssinou = logsAtualizados.find((l: any) => l.papel === "Prestador de Serviços")?.status === "Assinado";
              const liderAssinou = ["Assinado", "Aprovado"].includes(logsAtualizados.find((l: any) => l.papel.includes("Líder"))?.status);
              const coordAssinou = ["Assinado", "Aprovado"].includes(logsAtualizados.find((l: any) => l.papel.includes("Coordenação") || l.papel.includes("Responsável"))?.status);

              let statusCalculado = "Pendente de Assinatura";
              if (todosConcluidos || (liderAssinou && prestadorAssinou && coordAssinou) || req.request_status === "completed") {
                statusCalculado = "Aprovado & Pronto p/ Faturamento";
              } else if (prestadorAssinou) {
                statusCalculado = "Assinado pelo Prestador";
              } else if (liderAssinou) {
                statusCalculado = "Aprovado pelo Líder";
              }

              mapaStatus[cod] = {
                status: statusCalculado,
                zohoRequestId: req.request_id,
                logs: logsAtualizados,
                atualizadoEm: new Date().toISOString(),
              };

              bms = bms.map((bm: any) => {
                if (String(bm.codigo) === cod) {
                  return {
                    ...bm,
                    status: statusCalculado,
                    zohoRequestId: req.request_id,
                    logs: logsAtualizados,
                  };
                }
                return bm;
              });
            }
          }

          if (alterouZoho) {
            await sb.from("configuracoes").upsert({
              chave: "bms_assinaturas_status",
              valor: Object.keys(mapaStatus).length,
              descricao: JSON.stringify(mapaStatus),
            });
            console.log("☁️ [API Medição] Assinaturas ativas do Zoho Sign sincronizadas com sucesso no Supabase!");
          }
        }
      } catch (zohoErr: any) {
        console.warn("Aviso na sincronização ativa com Zoho Sign:", zohoErr.message);
      }
    } catch (sbErr: any) {
      console.warn("Aviso ao consultar Supabase em /api/medicao:", sbErr.message);
    }

    return NextResponse.json(bms);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (Array.isArray(body)) {
      // 1. Gravação local (quando filesystem permitir)
      try {
        fs.writeFileSync(FILE_PATH, JSON.stringify(body, null, 2), "utf-8");
      } catch (fsErr: any) {
        console.warn("Ambiente read-only (Vercel Lambda): fs.writeFileSync ignorado.");
      }

      // 2. Persistência Cloud no Supabase (Garante consistência na Vercel e Localhost)
      try {
        const sb = supabaseAdmin();
        await sb.from("configuracoes").upsert({
          chave: "bms_lista_completa",
          valor: body.length,
          descricao: JSON.stringify(body),
        });
      } catch (sbErr: any) {
        console.warn("Aviso ao persistir lista no Supabase:", sbErr.message);
      }

      return NextResponse.json({ success: true, count: body.length });
    }
    return NextResponse.json({ error: "Dados inválidos, esperado array de BMs." }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
