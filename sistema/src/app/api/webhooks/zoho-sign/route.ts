import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// Endpoint de Webhook do Zoho Sign para receber atualizações de assinaturas em tempo real
export async function POST(req: NextRequest) {
  try {
    let payload: any = null;
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      payload = await req.json();
    } else if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      // Zoho Sign envia os dados dentro do campo 'json_data' ou 'payload'
      const jsonData = formData.get("json_data") || formData.get("payload");
      if (jsonData && typeof jsonData === "string") {
        payload = JSON.parse(jsonData);
      } else {
        const obj: Record<string, any> = {};
        formData.forEach((val, key) => { obj[key] = val; });
        payload = obj;
      }
    } else {
      const text = await req.text();
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { raw: text };
      }
    }

    console.log("🔔 [Zoho Sign Webhook] Evento recebido com sucesso:", JSON.stringify(payload, null, 2));

    // Se for apenas o teste de ping/amostra do Zoho Sign, retorna sucesso imediato
    if (payload?.test || payload?.operation_type === "test" || !payload?.requests) {
      return NextResponse.json({
        status: "success",
        message: "Webhook do Zoho Sign conectado e autenticado com sucesso no sistema NNÓS!",
      }, { status: 200 });
    }

    const requestData = payload.requests || payload;
    const requestId = requestData.request_id || requestData.document_id;
    const docName = requestData.request_name || requestData.document_name || "";
    const actions = requestData.actions || [];

    // Tentar localizar o código do BM pelo nome do documento (ex: "BM 0908" ou "BM-0908")
    const matchBm = docName.match(/BM[\s-_]?(\d{3,5})/i);
    const codigoBm = matchBm ? matchBm[1] : null;

    console.log(`📄 [Zoho Sign] Processando BM Código: ${codigoBm || "Não identificado"}, Request ID: ${requestId}`);

    // Carregar base de BMs para atualização
    const bmsPath = path.resolve(process.cwd(), "src/lib/bms-2026.json");
    if (fs.existsSync(bmsPath) && codigoBm) {
      try {
        const bms = JSON.parse(fs.readFileSync(bmsPath, "utf-8"));
        let alterou = false;

        const bmsAtualizados = bms.map((bm: any) => {
          if (String(bm.codigo) !== String(codigoBm) && bm.id !== `bm-${codigoBm}`) return bm;

          alterou = true;
          // Extrair informações de cada signatário a partir das ações do Zoho
          const logsAtualizados = [...(bm.logs || [])];

          actions.forEach((act: any) => {
            const email = (act.recipient_email || "").toLowerCase();
            const statusAcao = act.action_status || act.status; // "SIGNED", "VIEWED", "PENDING"
            const ip = act.ip_address || "IP Registrado Zoho";
            const dataHoraRaw = act.signed_time || act.action_time;
            
            let dataHoraFmt = "";
            if (dataHoraRaw) {
              const dt = new Date(Number(dataHoraRaw) || dataHoraRaw);
              dataHoraFmt = `${dt.toLocaleDateString("pt-BR")} às ${dt.toLocaleTimeString("pt-BR")}`;
            }

            // Atualiza o log correspondente
            logsAtualizados.forEach((l: any, idx: number) => {
              if (l.email?.toLowerCase() === email || act.recipient_name?.toUpperCase().includes(l.signatario?.toUpperCase())) {
                if (statusAcao === "SIGNED" || statusAcao === "COMPLETED") {
                  l.status = "Assinado";
                  l.dataHora = dataHoraFmt || l.dataHora || new Date().toLocaleString("pt-BR");
                  l.detalhe = `IP: ${ip} • Zoho Sign ID: ${requestId}`;
                }
              }
            });
          });

          // Determinar status global do BM
          const todosAssinaram = logsAtualizados.every((l: any) => l.status === "Assinado");
          const primeiroAssinou = logsAtualizados[0]?.status === "Assinado";
          const segundoAssinou = logsAtualizados[1]?.status === "Assinado";

          let novoStatus = bm.status;
          if (todosAssinaram) {
            novoStatus = "Aprovado & Pronto p/ Faturamento";
          } else if (segundoAssinou) {
            novoStatus = "Aprovado pelo Líder";
          } else if (primeiroAssinou) {
            novoStatus = "Assinado pelo Prestador";
          }

          return {
            ...bm,
            status: novoStatus,
            zohoRequestId: requestId,
            logs: logsAtualizados,
          };
        });

        if (alterou) {
          fs.writeFileSync(bmsPath, JSON.stringify(bmsAtualizados, null, 2), "utf-8");
          console.log(`✅ [Zoho Sign Webhook] BM ${codigoBm} atualizado com sucesso com dados da assinatura Zoho!`);
        }
      } catch (err: any) {
        console.error("Erro ao atualizar base de BMs via webhook:", err.message);
      }
    }

    return NextResponse.json({
      status: "success",
      message: "Webhook processado com sucesso",
      bm: codigoBm,
      requestId,
    }, { status: 200 });

  } catch (err: any) {
    console.error("❌ [Zoho Sign Webhook] Erro:", err);
    // Sempre retornar 200 para o Zoho não desativar o webhook por falhas transitórias
    return NextResponse.json({ status: "error", message: err.message }, { status: 200 });
  }
}

// Aceitar GET para testes simples de conectividade via navegador
export async function GET() {
  return NextResponse.json({
    status: "online",
    service: "NNÓS Gestão Financeira - Zoho Sign Webhook Endpoint",
    timestamp: new Date().toISOString(),
  });
}
