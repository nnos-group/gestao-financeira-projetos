import { gerarPdfOficialBm, AtividadeBmPdf } from "./bm-pdf-generator";

let cachedAccessToken: string | null = null;
let tokenExpiresAt: number = 0;

/**
 * Obtém um Access Token válido utilizando o Refresh Token permanente
 */
export async function getZohoAccessToken(): Promise<string> {
  const now = Date.now();
  // Se o token em cache ainda for válido por mais de 5 minutos, reutiliza
  if (cachedAccessToken && tokenExpiresAt > now + 300000) {
    return cachedAccessToken;
  }

  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;
  const refreshToken = process.env.ZOHO_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Credenciais do Zoho Sign (CLIENT_ID, CLIENT_SECRET ou REFRESH_TOKEN) não configuradas no ambiente.");
  }

  const params = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
  });

  const res = await fetch(`https://accounts.zoho.com/oauth/v2/token?${params.toString()}`, {
    method: "POST",
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Falha ao obter Access Token do Zoho: ${res.status} - ${errText}`);
  }

  const data = await res.json();
  if (data.error) {
    throw new Error(`Erro retornado pelo Zoho OAuth: ${data.error}`);
  }

  cachedAccessToken = data.access_token;
  tokenExpiresAt = now + (data.expires_in || 3600) * 1000;

  return cachedAccessToken!;
}

export interface SignatarioEnvio {
  nome: string;
  email: string;
  papel: "Prestador de Serviços" | "Líder de Projeto" | "Coordenação / Validação Final";
  ordem: number;
}

export interface EnviarBmZohoParams {
  codigoBm: string;
  consultorNome: string;
  consultorRazaoSocial?: string;
  consultorCnpj?: string;
  consultorEndereco?: string;
  consultorEmail: string;
  contrato?: string;
  liderNome: string;
  liderEmail: string;
  responsavelNome: string;
  responsavelEmail: string;
  emailsCopia?: string;
  mesReferencia?: string;
  periodoStr: string;
  totalHoras?: number;
  mediaHora?: number;
  valorTotal: number;
  atividades?: AtividadeBmPdf[];
  pdfBuffer?: Buffer | Uint8Array;
}

/**
 * Cria a solicitação oficial de assinatura no Zoho Sign com os 3 signatários
 */
export async function enviarBmParaZohoSign(params: EnviarBmZohoParams) {
  // 1. Se houver Zoho Flow configurado (Zoho One), despacha diretamente via Webhook do Flow
  const flowUrl = process.env.ZOHO_FLOW_WEBHOOK_URL;
  if (flowUrl) {
    console.log(`🌊 [Zoho Flow] Disparando Webhook BM ${params.codigoBm} diretamente...`);
    try {
      const flowRes = await fetch(flowUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codigo_bm: params.codigoBm,
          consultor_nome: params.consultorNome,
          consultor_email: params.consultorEmail,
          lider_nome: params.liderNome,
          lider_email: params.liderEmail,
          responsavel_nome: params.responsavelNome,
          responsavel_email: params.responsavelEmail,
          emails_copia: params.emailsCopia || "leonardo.campos@nnos.com.br",
          periodo: params.periodoStr,
          valor_total: params.valorTotal,
          link_sistema: "https://gestao-financeira-projetos.vercel.app/medicao",
        }),
      });

      if (flowRes.ok) {
        return {
          success: true,
          status: "sent",
          avisoCreditos: false,
          message: "Boletim de Medição enviado para o fluxo de assinaturas do Zoho Sign!",
        };
      } else {
        const flowErr = await flowRes.text();
        console.warn("Aviso ao disparar pelo Zoho Flow:", flowRes.status, flowErr);
        throw new Error(`Falha no Zoho Flow (${flowRes.status}): ${flowErr}`);
      }
    } catch (e: any) {
      console.error("Erro ao disparar Webhook do Zoho Flow:", e.message);
      throw e;
    }
  }

  // Fallback: API REST direta (caso não haja Zoho Flow)
  const accessToken = await getZohoAccessToken();
  const apiUrl = process.env.ZOHO_API_URL || "https://sign.zoho.com/api/v1";

  const actions: any[] = [
    {
      recipient_name: params.liderNome,
      recipient_email: params.liderEmail,
      action_type: "APPROVER",
      signing_order: 1,
      verify_recipient: false,
    },
    {
      recipient_name: params.consultorNome,
      recipient_email: params.consultorEmail,
      action_type: "SIGN",
      signing_order: 2,
      verify_recipient: false,
    },
    {
      recipient_name: params.responsavelNome,
      recipient_email: params.responsavelEmail,
      action_type: "SIGN",
      signing_order: 3,
      verify_recipient: false,
    },
  ];

  // Adicionar destinatários de cópia (visualizadores)
  if (params.emailsCopia) {
    const copias = params.emailsCopia.split(";").map((e) => e.trim()).filter(Boolean);
    copias.forEach((email) => {
      actions.push({
        recipient_name: "Cópia Financeiro",
        recipient_email: email,
        action_type: "VIEW",
        signing_order: 4,
      });
    });
  }

  const periodoLimpo = (params.periodoStr || "")
    .replace(/\s*\(\s*/g, " - ")
    .replace(/\s*\)\s*/g, "")
    .trim();
  const requestName = `BM ${params.codigoBm} - ${params.consultorNome} - ${periodoLimpo}`;
  const notes = `Prezado(a),\n\nSegue para assinatura eletrônica o Boletim de Medição de Serviços (BM ${params.codigoBm}) referente ao período de ${params.periodoStr}.\nValor apurado: R$ ${params.valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.\n\nPor favor, revise os dados e confirme a sua assinatura.\n\nAtenciosamente,\nNNÓS Consultoria e Treinamento`;

  const requestPayload = {
    requests: {
      request_name: requestName,
      is_sequential: true,
      expiration_days: 7,
      email_reminders: true,
      reminder_period: 2,
      notes: notes,
      actions: actions,
    },
  };

  // Garante geração dinâmica do PDF oficial do BM com layout Print 3 e Text Tags Zoho Sign
  const pdfBuffer = params.pdfBuffer || await gerarPdfOficialBm({
    codigoBm: params.codigoBm,
    consultorNome: params.consultorNome,
    consultorRazaoSocial: params.consultorRazaoSocial,
    consultorCnpj: params.consultorCnpj,
    consultorEndereco: params.consultorEndereco,
    consultorEmail: params.consultorEmail,
    contrato: params.contrato,
    mesReferencia: params.mesReferencia || params.periodoStr,
    periodoStr: params.periodoStr,
    totalHoras: params.totalHoras || 0,
    mediaHora: params.mediaHora || 0,
    valorTotal: params.valorTotal,
    liderNome: params.liderNome,
    responsavelNome: params.responsavelNome,
    atividades: params.atividades || [],
  });

  const formData = new FormData();
  const blob = new Blob([new Uint8Array(pdfBuffer)], { type: "application/pdf" });
  formData.append("file", blob, `BM_${params.codigoBm}.pdf`);
  formData.append("data", JSON.stringify(requestPayload));

  const res = await fetch(`${apiUrl}/requests`, {
    method: "POST",
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("Erro na API do Zoho Sign ao criar documento:", res.status, errText);
    throw new Error(`Falha no Zoho Sign: ${res.status} - ${errText}`);
  }

  const data = await res.json();
  const reqObj = data.requests || data;
  const requestId = reqObj.request_id;
  const documentId = (reqObj.document_ids && reqObj.document_ids[0]?.document_id) || reqObj.zsdocumentid || reqObj.document_id;

  let submitSucesso = false;
  let submitMsg = "";
  let avisoCreditos = false;
  // Disparo dos e-mails
  // Se houver Zoho Flow configurado (Zoho One), usa o Flow para disparar nativamente via Modelo BM
  const flowUrl = process.env.ZOHO_FLOW_WEBHOOK_URL;
  if (flowUrl) {
    try {
      console.log(`🌊 [Zoho Flow] Disparando BM ${params.codigoBm} via Zoho Flow (Modelo BM)...`);
      const flowRes = await fetch(flowUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codigo_bm: params.codigoBm,
          consultor_nome: params.consultorNome,
          consultor_email: params.consultorEmail,
          lider_nome: params.liderNome,
          lider_email: params.liderEmail,
          responsavel_nome: params.responsavelNome,
          responsavel_email: params.responsavelEmail,
          emails_copia: params.emailsCopia || "leonardo.campos@nnos.com.br",
          periodo: params.periodoStr,
          valor_total: params.valorTotal,
          request_id: requestId,
          document_id: documentId,
          link_sistema: "https://gestao-financeira-projetos.vercel.app/medicao",
        }),
      });

      if (flowRes.ok) {
        return {
          success: true,
          requestId: requestId,
          documentId: documentId,
          status: "sent",
          avisoCreditos: false,
          message: "Boletim de Medição disparado com sucesso para assinatura no Zoho Sign!",
        };
      } else {
        console.warn("Aviso ao disparar pelo Zoho Flow:", flowRes.status, await flowRes.text());
      }
    } catch (e: any) {
      console.warn("Falha ao conectar com Zoho Flow:", e.message);
    }
  }

  // Fallback: Tentativa via endpoint direto do Zoho Sign caso Flow não tenha disparado
  if (requestId && !submitSucesso) {
    try {
      const submitRes = await fetch(`${apiUrl}/requests/${requestId}/submit`, {
        method: "POST",
        headers: {
          Authorization: `Zoho-oauthtoken ${accessToken}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "",
      });

      if (submitRes.ok) {
        submitSucesso = true;
        submitMsg = "E-mails de assinatura enviados aos signatários via Zoho Sign!";
      } else {
        const submitErrText = await submitRes.text();
        console.warn("Aviso no submit do Zoho Sign:", submitRes.status, submitErrText);
        if (submitErrText.includes("12000") || submitErrText.includes("créditos") || submitErrText.includes("creditos")) {
          avisoCreditos = true;
          submitMsg = "Documento registrado no Zoho Sign. Para envio automático de e-mails via API externa, a conta Zoho requer créditos de API.";
        } else {
          submitMsg = `Zoho Sign: Documento criado (${submitRes.status}).`;
        }
      }
    } catch (e: any) {
      console.warn("Erro ao submeter request no Zoho Sign:", e.message);
    }
  }

  return {
    success: true,
    requestId: requestId,
    documentId: documentId,
    status: submitSucesso ? "sent" : "draft",
    avisoCreditos,
    message: submitMsg || "Solicitação criada com sucesso no Zoho Sign!",
  };
}

/**
 * Consulta o status e a trilha de auditoria de um documento assinado no Zoho Sign
 */
export async function obterDetalhesDocumentoZoho(requestId: string) {
  const accessToken = await getZohoAccessToken();
  const apiUrl = process.env.ZOHO_API_URL || "https://sign.zoho.com/api/v1";

  const res = await fetch(`${apiUrl}/requests/${requestId}`, {
    method: "GET",
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Falha ao obter documento do Zoho Sign: ${res.status} - ${errText}`);
  }

  return await res.json();
}
