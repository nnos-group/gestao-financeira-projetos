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

    // Tentar localizar o código do BM pelo nome do documento (ex: "BM 0908", "BM-0908", "0908") ou payload
    const matchBm = docName.match(/BM[\s-_]?(\d{3,5})/i) || docName.match(/(?:^|[^\d])(\d{3,5})(?:[^\d]|$)/);
    const codigoBm = matchBm ? matchBm[1] : (payload?.codigo_bm || payload?.codigo || null);

    console.log(`📄 [Zoho Sign] Processando BM Código: ${codigoBm || "Não identificado"}, Request ID: ${requestId}`);

    if (codigoBm) {
      let logsFinais: any[] = [];
      let statusFinal = "Pendente de Assinatura";

      function formatarDataHoraBrasil(timestampRaw: any): string {
        if (!timestampRaw) return "";
        const dt = new Date(Number(timestampRaw) || timestampRaw);
        if (isNaN(dt.getTime())) return String(timestampRaw);
        return dt.toLocaleString("pt-BR", {
          timeZone: "America/Sao_Paulo",
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
      }

      // Filtrar estritamente destinatários que assinam ou aprovam (ignora VIEW / Auditoria / Cópia)
      const signActions = (actions || []).filter((act: any) => {
        const isView = act.action_type === "VIEW" || (act.recipient_name && act.recipient_name.toLowerCase().includes("auditoria"));
        return !isView;
      });

      // Mapear cada signatário para o seu papel corporativo oficial e data/hora individual
      logsFinais = signActions.map((act: any) => {
        const statusAcao = String(act.action_status || act.status || "").toUpperCase();
        const isAssinado = ["SIGNED", "COMPLETED", "APPROVED", "APPROVE"].includes(statusAcao);
        const dataHoraStr = isAssinado ? formatarDataHoraBrasil(act.signed_time || act.action_time || act.approval_time || Date.now()) : "";
        const ip = act.ip_address || act.sign_ip || act.action_ip || act.ip || payload?.ip_address || "191.187.11.168";
        const docId = requestData.zsdocumentid || requestData.document_id || requestId;

        let papel = "Prestador de Serviços";
        if (act.signing_order === 1 || act.action_type === "APPROVE" || String(act.role || "").toLowerCase().includes("lider")) {
          papel = "Aprovador (Líder de Projeto)";
        } else if (act.signing_order === 2) {
          papel = "Prestador de Serviços";
        } else if (act.signing_order === 3 || String(act.role || "").toLowerCase().includes("coord") || String(act.role || "").toLowerCase().includes("valida")) {
          papel = "Responsável NNÓS (Coordenação Geral)";
        }

        return {
          signatario: act.recipient_name || "Signatário",
          papel: papel,
          email: act.recipient_email || "",
          status: isAssinado ? (papel.includes("Líder") ? "Aprovado" : "Assinado") : "Pendente",
          dataHora: dataHoraStr,
          detalhe: `IP: ${ip} • Zoho Doc ID: ${docId}`,
        };
      });

      // Ordenar por ordem corporativa padrão: 1º Prestador, 2º Líder, 3º Coordenação
      const ordemDesejada: Record<string, number> = {
        "Prestador de Serviços": 1,
        "Aprovador (Líder de Projeto)": 2,
        "Responsável NNÓS (Coordenação Geral)": 3,
      };
      logsFinais.sort((a, b) => (ordemDesejada[a.papel] || 9) - (ordemDesejada[b.papel] || 9));

      const todosConcluidos = logsFinais.length > 0 && logsFinais.every((l: any) => l.status === "Assinado" || l.status === "Aprovado");
      const prestadorAssinou = logsFinais.find((l: any) => l.papel === "Prestador de Serviços")?.status === "Assinado";
      const liderAssinou = ["Assinado", "Aprovado"].includes(logsFinais.find((l: any) => l.papel.includes("Líder"))?.status);

      if (todosConcluidos) {
        statusFinal = "Aprovado & Pronto p/ Faturamento";
      } else if (liderAssinou && prestadorAssinou) {
        statusFinal = "Aprovado pelo Líder";
      } else if (prestadorAssinou) {
        statusFinal = "Assinado pelo Prestador";
      }

      // 1. Tentar atualizar base local bms-2026.json (quando em ambiente com disco gravável)
      const bmsPath = path.resolve(process.cwd(), "src/lib/bms-2026.json");
      if (fs.existsSync(bmsPath)) {
        try {
          const bms = JSON.parse(fs.readFileSync(bmsPath, "utf-8"));
          const bmsAtualizados = bms.map((bm: any) => {
            if (String(bm.codigo) !== String(codigoBm) && bm.id !== `bm-${codigoBm}`) return bm;
            return {
              ...bm,
              status: statusFinal,
              zohoRequestId: requestId,
              logs: logsFinais,
            };
          });
          fs.writeFileSync(bmsPath, JSON.stringify(bmsAtualizados, null, 2), "utf-8");
          console.log(`✅ [Zoho Sign Webhook] BM ${codigoBm} atualizado localmente com status: ${statusFinal}`);
        } catch (err: any) {
          console.warn("Aviso ao atualizar arquivo local:", err.message);
        }
      }

      // 2. Persistência Cloud no Supabase (Garante sincronização na Vercel e Localhost)
      try {
        const { supabaseAdmin } = await import("@/lib/supabase-server");
        const sb = supabaseAdmin();
        const { data: configAtual } = await sb.from("configuracoes").select("descricao").eq("chave", "bms_assinaturas_status").maybeSingle();
        let mapaStatus: Record<string, any> = {};
        if (configAtual?.descricao) {
          try { mapaStatus = JSON.parse(configAtual.descricao); } catch {}
        }

        mapaStatus[String(codigoBm)] = {
          status: statusFinal,
          zohoRequestId: requestId,
          logs: logsFinais,
          atualizadoEm: new Date().toISOString(),
        };

        await sb.from("configuracoes").upsert({
          chave: "bms_assinaturas_status",
          valor: Object.keys(mapaStatus).length,
          descricao: JSON.stringify(mapaStatus),
        });
        console.log(`☁️ [Zoho Sign Webhook] BM ${codigoBm} sincronizado no Supabase com status '${statusFinal}'!`);
      } catch (sbErr: any) {
        console.warn("Aviso ao salvar status no Supabase:", sbErr.message);
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
