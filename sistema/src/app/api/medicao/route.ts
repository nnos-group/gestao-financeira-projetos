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

          requests.forEach((req: any) => {
            const docName = req.request_name || "";
            const match = docName.match(/(?:BM[\s-_]?)?(\d{3,5})/i);
            const cod = match ? match[1] : null;

            if (cod && req.request_status === "completed") {
              alterouZoho = true;
              const logsAtualizados = (req.actions || [])
                .filter((act: any) => act.action_type === "SIGN")
                .map((act: any) => {
                  const dataRaw = act.signed_time || act.action_time;
                  let dataFmt = "Assinado via Zoho Sign";
                  if (dataRaw) {
                    const dt = new Date(Number(dataRaw) || dataRaw);
                    dataFmt = `${dt.toLocaleDateString("pt-BR")} às ${dt.toLocaleTimeString("pt-BR")}`;
                  }
                  return {
                    signatario: act.recipient_name,
                    papel: act.role || (act.signing_order === 1 ? "Prestador de Serviços" : act.signing_order === 2 ? "Líder de Projeto" : "Validação Geral"),
                    email: act.recipient_email,
                    status: "Assinado",
                    dataHora: dataFmt,
                    detalhe: `IP: ${act.ip_address || "Registrado Zoho"} • Zoho Sign ID: ${req.request_id}`,
                  };
                });

              mapaStatus[cod] = {
                status: "Aprovado & Pronto p/ Faturamento",
                zohoRequestId: req.request_id,
                logs: logsAtualizados,
                atualizadoEm: new Date().toISOString(),
              };

              bms = bms.map((bm: any) => {
                if (String(bm.codigo) === cod) {
                  return {
                    ...bm,
                    status: "Aprovado & Pronto p/ Faturamento",
                    zohoRequestId: req.request_id,
                    logs: logsAtualizados,
                  };
                }
                return bm;
              });
            }
          });

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
